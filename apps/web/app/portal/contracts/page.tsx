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
      <PageHeader
        title="My subcontracts"
        lede="Contracts awarded to you, with execution and e-signature status."
      />
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
                  <td className={c.tableNum}>{formatUsd(row.totalValue)}</td>
                  <td>
                    <Badge tone={row.status === "ACTIVE" ? "success" : "info"}>
                      {humanizeStatus(row.status)}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={row.esignStatus === "SIGNED" ? "success" : "warn"}>
                      {humanizeStatus(row.esignStatus)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
