/**
 * /admin/contracts/[id] — the §3.3 financial-flow detail surface: government invoices (receivables) with
 * their own 14/30-day Prompt-Payment clock, subcontractor payables whose due date is DERIVED from the
 * linked invoice's paid_at (never stored), and CPARS past-performance capture. requireAdmin guards the
 * page; every mutation lives in ./actions and re-checks the session itself.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import {
  and,
  asc,
  contractMilestones,
  contracts,
  desc,
  eq,
  invoices,
  pastPerformanceRecords,
  subcontractorPayables,
  vendors,
  withOrg,
} from "@hermes/db";
import { governmentPaymentDeadline, subcontractorPaymentDeadline } from "@hermes/core";

import { Badge, Card, PageHeader, Section, Select } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { humanizeStatus } from "@/lib/admin-board";
import { formatUsd } from "@/lib/portal";
import { requireAdmin } from "@/lib/auth-guard";

import {
  linkPayableInvoice,
  markInvoicePaid,
  markInvoiceSubmitted,
  markPayablePaid,
  recordCparsRating,
  recordInvoice,
  recordPayable,
} from "../actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DeadlineTone = "neutral" | "success" | "warn" | "danger";
function toneForStatus(status: "UNKNOWN" | "ON_TRACK" | "AT_RISK" | "MISSED"): DeadlineTone {
  if (status === "MISSED") return "danger";
  if (status === "AT_RISK") return "warn";
  if (status === "ON_TRACK") return "success";
  return "neutral";
}

export const dynamic = "force-dynamic";

export default async function ContractDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await withOrg(orgId, async (tx) => {
    const [contract] = await tx
      .select({
        id: contracts.id,
        contractType: contracts.contractType,
        status: contracts.status,
        totalValue: contracts.totalValue,
        acceleratedPayments: contracts.acceleratedPayments,
        vendorName: vendors.companyName,
      })
      .from(contracts)
      .leftJoin(vendors, eq(vendors.id, contracts.awardedVendorId))
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, id)))
      .limit(1);
    if (!contract) return null;

    const milestones = await tx
      .select()
      .from(contractMilestones)
      .where(and(eq(contractMilestones.orgId, orgId), eq(contractMilestones.contractId, id)))
      .orderBy(asc(contractMilestones.sequence));

    const invoiceRows = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.contractId, id)))
      .orderBy(desc(invoices.createdAt));

    const payableRows = await tx
      .select()
      .from(subcontractorPayables)
      .where(and(eq(subcontractorPayables.orgId, orgId), eq(subcontractorPayables.contractId, id)))
      .orderBy(desc(subcontractorPayables.createdAt));

    const cparsRows = await tx
      .select()
      .from(pastPerformanceRecords)
      .where(and(eq(pastPerformanceRecords.orgId, orgId), eq(pastPerformanceRecords.contractId, id)))
      .orderBy(desc(pastPerformanceRecords.recordedAt));

    return { contract, milestones, invoiceRows, payableRows, cparsRows };
  });

  if (!data) notFound();
  const { contract, milestones, invoiceRows, payableRows, cparsRows } = data;
  const invoiceById = new Map(invoiceRows.map((inv) => [inv.id, inv]));

  return (
    <main>
      <PageHeader
        title={contract.vendorName ?? "Contract"}
        back={
          <Link href="/admin/contracts" className={c.crumb}>
            ← Contracts
          </Link>
        }
        lede={`${contract.contractType} · ${humanizeStatus(contract.status)} · total ${formatUsd(contract.totalValue)} · accelerated payments ${contract.acceleratedPayments ? "yes (15-day)" : "no (7-day)"}`}
        actions={
          <Link href={`/admin/solicitations/${id}`} className={c.crumb}>
            Subcontract review →
          </Link>
        }
      />

      {/* --- Government invoices (receivables) --- */}
      <Section title="Government invoices (receivables)" count={invoiceRows.length}>
        <Card>
          <form action={recordInvoice}>
            <input type="hidden" name="contractId" value={id} />
            <div className={c.row}>
              <Field label="Invoice number" name="invoiceNumber" required maxLength={100} />
              <Field label="Amount (USD)" name="amount" type="number" step="0.01" min={0} required />
            </div>
            <div className={c.row}>
              <Select label="Kind" name="kind" defaultValue="PROGRESS">
                <option value="PROGRESS">Progress (14-day gov clock)</option>
                <option value="FINAL">Final (30-day gov clock)</option>
              </Select>
              <Select label="Milestone (optional)" name="milestoneId" defaultValue="">
                <option value="">None</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.sequence} — {m.description}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" size="sm">
              Record invoice
            </Button>
          </form>
        </Card>

        {invoiceRows.length === 0 ? (
          <p className={c.empty}>No invoices recorded yet.</p>
        ) : (
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="invoices-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Kind</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Paid</th>
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
                      <td>{inv.invoiceNumber}</td>
                      <td>{inv.kind}</td>
                      <td>{formatUsd(inv.amount)}</td>
                      <td>
                        <Badge tone={inv.status === "PAID" ? "success" : "neutral"}>
                          {humanizeStatus(inv.status)}
                        </Badge>
                      </td>
                      <td>{inv.submittedAt ? inv.submittedAt.toISOString().slice(0, 10) : "—"}</td>
                      <td>{inv.paidAt ? inv.paidAt.toISOString().slice(0, 10) : "—"}</td>
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
                        {inv.status === "DRAFT" ? (
                          <form action={markInvoiceSubmitted}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input type="hidden" name="contractId" value={id} />
                            <Button type="submit" size="sm" variant="secondary">
                              Mark submitted
                            </Button>
                          </form>
                        ) : inv.status === "SUBMITTED" ? (
                          <form action={markInvoicePaid}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input type="hidden" name="contractId" value={id} />
                            <Button type="submit" size="sm" variant="secondary">
                              Confirm government paid
                            </Button>
                          </form>
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

      {/* --- Subcontractor payables --- */}
      <Section title="Subcontractor payables" count={payableRows.length}>
        <Card>
          <form action={recordPayable}>
            <input type="hidden" name="contractId" value={id} />
            <div className={c.row}>
              <Field label="Amount (USD)" name="amount" type="number" step="0.01" min={0} required />
              <Select label="Milestone (optional)" name="milestoneId" defaultValue="">
                <option value="">None</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.sequence} — {m.description}
                  </option>
                ))}
              </Select>
            </div>
            <Select label="Government invoice (optional — link once known)" name="governmentInvoiceId" defaultValue="">
              <option value="">Not yet linked</option>
              {invoiceRows.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} ({humanizeStatus(inv.status)})
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm">
              Record payable
            </Button>
          </form>
        </Card>

        {payableRows.length === 0 ? (
          <p className={c.empty}>No payables recorded yet.</p>
        ) : (
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="payables-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Linked invoice</th>
                  <th>Prompt-Payment deadline</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payableRows.map((p) => {
                  const linkedInvoice = p.governmentInvoiceId ? invoiceById.get(p.governmentInvoiceId) : undefined;
                  const deadline = subcontractorPaymentDeadline({
                    upstreamPaymentDate: linkedInvoice?.paidAt ?? null,
                    accelerated: contract.acceleratedPayments,
                  });
                  return (
                    <tr key={p.id}>
                      <td>{formatUsd(p.amount)}</td>
                      <td>
                        <Badge tone={p.status === "PAID" ? "success" : "neutral"}>{humanizeStatus(p.status)}</Badge>
                      </td>
                      <td>
                        {linkedInvoice ? (
                          linkedInvoice.invoiceNumber
                        ) : p.status === "PENDING" ? (
                          <form action={linkPayableInvoice} className={c.row}>
                            <input type="hidden" name="payableId" value={p.id} />
                            <input type="hidden" name="contractId" value={id} />
                            <select name="governmentInvoiceId" defaultValue="" required>
                              <option value="" disabled>
                                Link invoice…
                              </option>
                              {invoiceRows.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.invoiceNumber}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm" variant="ghost">
                              Link
                            </Button>
                          </form>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-testid="payable-deadline">
                        <Badge tone={toneForStatus(deadline.status)}>
                          {deadline.status === "UNKNOWN"
                            ? "not yet started"
                            : `${deadline.status.toLowerCase()} · ${deadline.dueDate?.toISOString().slice(0, 10)}`}
                        </Badge>
                      </td>
                      <td>
                        {p.status === "PENDING" ? (
                          <form action={markPayablePaid}>
                            <input type="hidden" name="payableId" value={p.id} />
                            <input type="hidden" name="contractId" value={id} />
                            <Button type="submit" size="sm" variant="secondary">
                              Mark paid
                            </Button>
                          </form>
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

      {/* --- CPARS / past performance --- */}
      <Section title="Past performance (CPARS)" count={cparsRows.length}>
        <Card>
          <p className={c.meta}>
            Typically recorded at contract closeout. Feeds future proposal past-performance narratives —
            the single most influential input to winning competitive awards.
          </p>
          <form action={recordCparsRating}>
            <input type="hidden" name="contractId" value={id} />
            <Select label="Rating" name="rating" defaultValue="SATISFACTORY" required>
              <option value="EXCEPTIONAL">Exceptional</option>
              <option value="VERY_GOOD">Very good</option>
              <option value="SATISFACTORY">Satisfactory</option>
              <option value="MARGINAL">Marginal</option>
              <option value="UNSATISFACTORY">Unsatisfactory</option>
            </Select>
            <div className={c.row}>
              <Field label="Rating period start" name="ratingPeriodStart" type="date" />
              <Field label="Rating period end" name="ratingPeriodEnd" type="date" />
            </div>
            <div className={c.row}>
              <Field label="Evaluator name" name="evaluatorName" maxLength={200} />
              <Field label="Evaluator email" name="evaluatorEmail" type="email" maxLength={254} />
            </div>
            <label className={c.field}>
              <span className={c.fieldLabel}>Narrative</span>
              <textarea name="narrative" rows={4} maxLength={5000} className={c.scope} />
            </label>
            <Button type="submit" size="sm">
              Record rating
            </Button>
          </form>
        </Card>

        {cparsRows.length === 0 ? (
          <p className={c.empty}>No past-performance ratings recorded yet.</p>
        ) : (
          <ul className={c.list}>
            {cparsRows.map((r) => (
              <Card as="li" key={r.id} size="sm">
                <div className={c.rowBetween}>
                  <Badge tone="info">{humanizeStatus(r.rating)}</Badge>
                  <span className={c.meta}>{r.recordedAt.toISOString().slice(0, 10)}</span>
                </div>
                {r.narrative ? <p className={c.meta}>{r.narrative}</p> : null}
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
