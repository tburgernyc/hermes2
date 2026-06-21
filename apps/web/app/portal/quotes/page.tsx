import Link from "next/link";
import type { JSX } from "react";

import { and, desc, eq, solicitations, vendorQuotes, withVendorRole } from "@hermes/db";

import { Badge, PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
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
        createdAt: vendorQuotes.createdAt,
        solicitationTitle: solicitations.title,
        agency: solicitations.agency,
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
      <PageHeader title="My quotes" lede="Quotes you've submitted, with their current review status." />
      {rows.length === 0 ? (
        <p className={c.empty} data-testid="quotes-empty">
          You have not submitted any quotes yet.
        </p>
      ) : (
        <div className={c.tableWrap}>
          <table className={c.table} data-testid="quotes-table">
            <thead>
              <tr>
                <th>Solicitation</th>
                <th>Agency</th>
                <th>Total</th>
                <th>Submitted</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/portal/quotes/${q.id}`}>{q.solicitationTitle}</Link>
                  </td>
                  <td>{q.agency ?? "—"}</td>
                  <td className={c.tableNum}>{formatUsd(q.totalPrice)}</td>
                  <td className={c.tableNum}>{q.createdAt.toISOString().slice(0, 10)}</td>
                  <td>
                    <Badge tone={q.status === "SUBMITTED" ? "success" : "info"}>
                      {humanizeStatus(q.status)}
                    </Badge>
                  </td>
                  <td>
                    <Link href={`/portal/quotes/${q.id}`}>View</Link>
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
