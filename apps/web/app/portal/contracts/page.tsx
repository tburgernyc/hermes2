import type { JSX } from "react";

import { and, contracts, desc, eq, solicitations, withVendorRole } from "@hermes/db";

import { Badge, PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { formatUsd, humanizeStatus } from "@/lib/portal";

export const dynamic = "force-dynamic";

/**
 * "My Subcontracts" — contracts awarded to this vendor. hermes_vendor RLS (migration 0009) keys
 * contracts on awarded_vendor_id, so a vendor only ever sees its own. The solicitation join is LEFT
 * because contracts.solicitation_id is nullable.
 *
 * §3.2 baseline audit: milestone progress is NOT rendered here, though the spec names it explicitly. This
 * is a genuine, investigated blocker, not an oversight: migration 0009 grants hermes_vendor SELECT on
 * vendors/vendor_quotes/proposals/contracts/documents ONLY — contract_milestones has NO grant and NO RLS
 * policy for hermes_vendor at all, so querying it under withVendorRole would fail closed with a
 * permission-denied error on every real page load (not a silent gap — a broken page). Fixing this needs a
 * new migration (a GRANT SELECT + an org/vendor-scoped RLS policy on contract_milestones), which is a
 * packages/db schema change — explicitly out of this unit's file scope (§3.2 may not touch packages/db).
 * Querying it under the org-wide hermes_app role instead (bypassing hermes_vendor's RLS) was rejected as a
 * worse alternative: it would leak cross-tenant/role isolation into a vendor-facing page. The honest
 * resolution here is the visible explanation rendered below the table — a future unit that owns
 * packages/db should add the grant/policy and then wire the read.
 */
export default async function MySubcontractsPage(): Promise<JSX.Element> {
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;

  const rows = await withVendorRole(orgId, vendorId, async (tx) =>
    tx
      .select({
        id: contracts.id,
        status: contracts.status,
        esignStatus: contracts.esignStatus,
        contractType: contracts.contractType,
        totalValue: contracts.totalValue,
        solicitationTitle: solicitations.title,
      })
      .from(contracts)
      .leftJoin(
        solicitations,
        and(
          eq(solicitations.orgId, contracts.orgId),
          eq(solicitations.id, contracts.solicitationId),
        ),
      )
      .where(and(eq(contracts.orgId, orgId), eq(contracts.awardedVendorId, vendorId)))
      .orderBy(desc(contracts.createdAt)),
  );

  return (
    <main>
      <PageHeader title="My Subcontracts" />
      {rows.length === 0 ? (
        <p className={c.empty} data-testid="contracts-empty">
          You have no subcontracts yet.
        </p>
      ) : (
        <div className={c.tableWrap}>
          <table className={c.table} data-testid="contracts-table">
            <thead>
              <tr>
                <th>Solicitation</th>
                <th>Type</th>
                <th>Value</th>
                <th>Status</th>
                <th>E-sign</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.solicitationTitle ?? "—"}</td>
                  <td>{row.contractType}</td>
                  <td>{formatUsd(row.totalValue)}</td>
                  <td>
                    <Badge>{humanizeStatus(row.status)}</Badge>
                  </td>
                  <td>
                    <Badge tone="neutral">{humanizeStatus(row.esignStatus)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={c.meta} data-testid="milestones-unavailable-note">
        Milestone progress is not shown here yet — the vendor portal is waiting on a database read-grant
        that has not been added (this is a known, tracked gap, not a bug). Contact your Burger Consulting
        point of contact for milestone status in the meantime.
      </p>
    </main>
  );
}
