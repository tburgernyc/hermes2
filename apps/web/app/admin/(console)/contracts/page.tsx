/**
 * /admin/contracts — the contract list (§3.3). Each row drills into the detail page where government
 * invoices (receivables), subcontractor payables, and CPARS closeout capture live. Contracts themselves
 * are created only by the §3.1 award cascade (draftSubcontract) — this surface is read + drill-down only.
 */
import Link from "next/link";
import type { JSX } from "react";

import { contracts, desc, eq, vendors, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { humanizeStatus } from "@/lib/admin-board";
import { formatUsd } from "@/lib/portal";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function ContractsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const rows = await withOrg(orgId, (tx) =>
    tx
      .select({
        id: contracts.id,
        contractType: contracts.contractType,
        status: contracts.status,
        totalValue: contracts.totalValue,
        esignStatus: contracts.esignStatus,
        vendorName: vendors.companyName,
      })
      .from(contracts)
      .leftJoin(vendors, eq(vendors.id, contracts.awardedVendorId))
      .where(eq(contracts.orgId, orgId))
      .orderBy(desc(contracts.createdAt))
      .limit(100),
  );

  return (
    <main>
      <PageHeader
        title="Contracts"
        lede="Government receivables, subcontractor payables, and CPARS capture for each awarded contract."
        actions={
          <Link href="/admin/financials" className={c.crumb}>
            Financials rollup →
          </Link>
        }
      />

      <Section title="Contracts" count={rows.length}>
        {rows.length === 0 ? (
          <p className={c.empty}>No contracts yet — a contract is created automatically when an award is recorded.</p>
        ) : (
          <ul className={c.list}>
            {rows.map((r) => (
              <Card as="li" key={r.id} size="sm">
                <div className={c.rowBetween}>
                  <Link href={`/admin/contracts/${r.id}`}>{r.vendorName ?? "Unassigned vendor"}</Link>
                  <span className={c.meta}>
                    {r.contractType} · {formatUsd(r.totalValue)}
                  </span>
                </div>
                <div className={c.rowBetween}>
                  <Badge tone="neutral">{humanizeStatus(r.status)}</Badge>
                  <span className={c.meta}>e-sign {humanizeStatus(r.esignStatus)}</span>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
