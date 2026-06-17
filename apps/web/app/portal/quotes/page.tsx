import Link from "next/link";
import type { JSX } from "react";

import { and, desc, eq, solicitations, vendorQuotes, withVendorRole } from "@hermes/db";

import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { formatUsd, humanizeStatus } from "@/lib/portal";

export const dynamic = "force-dynamic";

/**
 * "My Quotes" — every quote this vendor submitted, across solicitations. The hermes_vendor RESTRICTIVE
 * RLS (migration 0009) already narrows vendor_quotes to this vendor's own rows; the explicit vendorId
 * predicate is defense in depth. A competitor's quote in the same org is structurally invisible.
 */
export default async function MyQuotesPage(): Promise<JSX.Element> {
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;

  const rows = await withVendorRole(orgId, vendorId, async (tx) =>
    tx
      .select({
        id: vendorQuotes.id,
        status: vendorQuotes.status,
        totalPrice: vendorQuotes.totalPrice,
        solicitationTitle: solicitations.title,
        noticeId: solicitations.noticeId,
      })
      .from(vendorQuotes)
      .innerJoin(
        solicitations,
        and(
          eq(solicitations.orgId, vendorQuotes.orgId),
          eq(solicitations.id, vendorQuotes.solicitationId),
        ),
      )
      .where(and(eq(vendorQuotes.orgId, orgId), eq(vendorQuotes.vendorId, vendorId)))
      .orderBy(desc(vendorQuotes.createdAt)),
  );

  return (
    <main>
      <h1>My Quotes</h1>
      {rows.length === 0 ? (
        <p data-testid="quotes-empty">You have not submitted any quotes yet.</p>
      ) : (
        <table data-testid="quotes-table">
          <thead>
            <tr>
              <th>Solicitation</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <td>
                  <Link href={`/portal/quotes/${q.id}`}>{q.solicitationTitle}</Link>
                </td>
                <td>{humanizeStatus(q.status)}</td>
                <td>{formatUsd(q.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
