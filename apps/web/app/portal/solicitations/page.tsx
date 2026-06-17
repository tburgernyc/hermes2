import type { JSX } from "react";
import Link from "next/link";

import { and, desc, eq, inArray, solicitations, withVendorRole } from "@hermes/db";

import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { OPEN_RFQ_STATUSES } from "@/lib/portal";

export const dynamic = "force-dynamic";

/**
 * "Open RFQs" — solicitations the firm is currently sourcing subcontractor quotes for. These are shared
 * within the org (every vendor sees the same list), so the hermes_vendor policy is org-scoped only
 * (migration 0010, no per-vendor narrowing). OPEN_RFQ_STATUSES is the shared status window. SAM-sourced
 * title/agency are rendered as data (JSX autoescape).
 */
export default async function OpenRfqsPage(): Promise<JSX.Element> {
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;

  const rows = await withVendorRole(orgId, vendorId, async (tx) =>
    tx
      .select({
        id: solicitations.id,
        noticeId: solicitations.noticeId,
        title: solicitations.title,
        agency: solicitations.agency,
        naicsCode: solicitations.naicsCode,
        responseDeadline: solicitations.responseDeadline,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), inArray(solicitations.status, OPEN_RFQ_STATUSES)))
      .orderBy(desc(solicitations.responseDeadline)),
  );

  return (
    <main>
      <h1>Open RFQs</h1>
      <p>Solicitations the firm is currently sourcing subcontractor quotes for.</p>
      {rows.length === 0 ? (
        <p data-testid="rfqs-empty">No open RFQs right now.</p>
      ) : (
        <table data-testid="rfqs-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Agency</th>
              <th>NAICS</th>
              <th>Response deadline</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td>{s.agency ?? "—"}</td>
                <td>{s.naicsCode ?? "—"}</td>
                <td>{s.responseDeadline ? s.responseDeadline.toISOString().slice(0, 10) : "—"}</td>
                <td>
                  <Link href={`/portal/solicitations/${s.id}/quote`}>Submit quote</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
