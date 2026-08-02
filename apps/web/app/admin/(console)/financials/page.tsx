/**
 * /admin/financials — the cross-contract §3.3 rollup: every government invoice (receivable) and every
 * subcontractor payable, org-wide, with computed Prompt-Payment deadline status. Read-only; every
 * mutation lives on the per-contract detail page (linked from each row).
 */
import Link from "next/link";
import type { JSX } from "react";

import { contracts, desc, eq, invoices, subcontractorPayables, vendors, withOrg } from "@hermes/db";
import { governmentPaymentDeadline, subcontractorPaymentDeadline } from "@hermes/core";

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { humanizeStatus } from "@/lib/admin-board";
import { formatUsd } from "@/lib/portal";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

type DeadlineTone = "neutral" | "success" | "warn" | "danger";
function toneForStatus(status: "UNKNOWN" | "ON_TRACK" | "AT_RISK" | "MISSED"): DeadlineTone {
  if (status === "MISSED") return "danger";
  if (status === "AT_RISK") return "warn";
  if (status === "ON_TRACK") return "success";
  return "neutral";
}

export default async function FinancialsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const data = await withOrg(orgId, async (tx) => {
    const invoiceRows = await tx
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        kind: invoices.kind,
        amount: invoices.amount,
        status: invoices.status,
        submittedAt: invoices.submittedAt,
        paidAt: invoices.paidAt,
        contractId: invoices.contractId,
        vendorName: vendors.companyName,
      })
      .from(invoices)
      .leftJoin(contracts, eq(contracts.id, invoices.contractId))
      .leftJoin(vendors, eq(vendors.id, contracts.awardedVendorId))
      .where(eq(invoices.orgId, orgId))
      .orderBy(desc(invoices.createdAt))
      .limit(200);

    const payableRows = await tx
      .select({
        id: subcontractorPayables.id,
        amount: subcontractorPayables.amount,
        status: subcontractorPayables.status,
        contractId: subcontractorPayables.contractId,
        accelerated: contracts.acceleratedPayments,
        vendorName: vendors.companyName,
        govInvoicePaidAt: invoices.paidAt,
      })
      .from(subcontractorPayables)
      .leftJoin(contracts, eq(contracts.id, subcontractorPayables.contractId))
      .leftJoin(vendors, eq(vendors.id, contracts.awardedVendorId))
      .leftJoin(invoices, eq(invoices.id, subcontractorPayables.governmentInvoiceId))
      .where(eq(subcontractorPayables.orgId, orgId))
      .orderBy(desc(subcontractorPayables.createdAt))
      .limit(200);

    return { invoiceRows, payableRows };
  });

  const { invoiceRows, payableRows } = data;

  return (
    <main>
      <PageHeader
        title="Financials"
        lede="Government receivables and subcontractor payables, org-wide, with computed Prompt-Payment deadline status."
      />

      <Section title="Government invoices (receivables)" count={invoiceRows.length}>
        {invoiceRows.length === 0 ? (
          <p className={c.empty}>No invoices recorded yet.</p>
        ) : (
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="financials-invoices-table">
              <thead>
                <tr>
                  <th>Vendor / contract</th>
                  <th>Number</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Government payment deadline</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((inv) => {
                  const deadline =
                    inv.status === "SUBMITTED"
                      ? governmentPaymentDeadline({ invoiceSubmittedAt: inv.submittedAt, invoiceKind: inv.kind })
                      : null;
                  return (
                    <tr key={inv.id}>
                      <td>{inv.vendorName ?? "—"}</td>
                      <td>{inv.invoiceNumber}</td>
                      <td>{formatUsd(inv.amount)}</td>
                      <td>
                        <Badge tone={inv.status === "PAID" ? "success" : "neutral"}>
                          {humanizeStatus(inv.status)}
                        </Badge>
                      </td>
                      <td>
                        {deadline ? (
                          <Badge tone={toneForStatus(deadline.status)}>
                            {deadline.status.toLowerCase()} · {deadline.dueDate?.toISOString().slice(0, 10)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {inv.contractId ? (
                          <Link href={`/admin/contracts/${inv.contractId}`} className={c.crumb}>
                            Open →
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Subcontractor payables" count={payableRows.length}>
        {payableRows.length === 0 ? (
          <p className={c.empty}>No payables recorded yet.</p>
        ) : (
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="financials-payables-table">
              <thead>
                <tr>
                  <th>Vendor / contract</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Prompt-Payment deadline</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payableRows.map((p) => {
                  const deadline = subcontractorPaymentDeadline({
                    upstreamPaymentDate: p.govInvoicePaidAt,
                    accelerated: p.accelerated ?? true,
                  });
                  return (
                    <tr key={p.id}>
                      <td>{p.vendorName ?? "—"}</td>
                      <td>{formatUsd(p.amount)}</td>
                      <td>
                        <Badge tone={p.status === "PAID" ? "success" : "neutral"}>{humanizeStatus(p.status)}</Badge>
                      </td>
                      <td data-testid="financials-payable-deadline">
                        <Badge tone={toneForStatus(deadline.status)}>
                          {deadline.status === "UNKNOWN"
                            ? "not yet started"
                            : `${deadline.status.toLowerCase()} · ${deadline.dueDate?.toISOString().slice(0, 10)}`}
                        </Badge>
                      </td>
                      <td>
                        {p.contractId ? (
                          <Link href={`/admin/contracts/${p.contractId}`} className={c.crumb}>
                            Open →
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Card size="sm">
        <p className={c.meta}>
          A payable&rsquo;s due date is always <em>derived</em> from its linked government invoice&rsquo;s
          paid date — never stored. &ldquo;Not yet started&rdquo; means no invoice is linked yet, or the
          linked invoice hasn&rsquo;t been confirmed paid.
        </p>
      </Card>
    </main>
  );
}
