import type { JSX } from "react";

import { and, contracts, desc, eq, solicitations, withVendorRole } from "@hermes/db";

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
      <h1>My Subcontracts</h1>
      {rows.length === 0 ? (
        <p data-testid="contracts-empty">You have no subcontracts yet.</p>
      ) : (
        <table data-testid="contracts-table">
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
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.solicitationTitle ?? "—"}</td>
                <td>{c.contractType}</td>
                <td>{formatUsd(c.totalValue)}</td>
                <td>{humanizeStatus(c.status)}</td>
                <td>{humanizeStatus(c.esignStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
