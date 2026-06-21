import Link from "next/link";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import {
  and,
  asc,
  eq,
  solicitations,
  vendorQuoteLineItems,
  vendorQuotes,
  withVendorRole,
} from "@hermes/db";

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { formatUsd, humanizeStatus } from "@/lib/portal";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/**
 * "My Quote" detail + line items. RLS (0009 for the quote, 0010 EXISTS-to-parent for the line items)
 * guarantees a vendor can only ever load its OWN quote; a non-owned or unknown id renders notFound().
 * `notes` is untrusted free text rendered as data (JSX autoescapes) — never as instructions (§5).
 */
export default async function MyQuoteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await withVendorRole(orgId, vendorId, async (tx) => {
    const [quote] = await tx
      .select({
        id: vendorQuotes.id,
        status: vendorQuotes.status,
        totalPrice: vendorQuotes.totalPrice,
        periodOfPerformance: vendorQuotes.periodOfPerformance,
        payWhenPaid: vendorQuotes.payWhenPaid,
        notes: vendorQuotes.notes,
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
      .where(
        and(eq(vendorQuotes.orgId, orgId), eq(vendorQuotes.id, id), eq(vendorQuotes.vendorId, vendorId)),
      )
      .limit(1);
    if (!quote) return null;

    const lines = await tx
      .select({
        id: vendorQuoteLineItems.id,
        costType: vendorQuoteLineItems.costType,
        description: vendorQuoteLineItems.description,
        quantity: vendorQuoteLineItems.quantity,
        unitRate: vendorQuoteLineItems.unitRate,
        extendedAmount: vendorQuoteLineItems.extendedAmount,
      })
      .from(vendorQuoteLineItems)
      .where(and(eq(vendorQuoteLineItems.orgId, orgId), eq(vendorQuoteLineItems.quoteId, id)))
      .orderBy(asc(vendorQuoteLineItems.createdAt));

    return { quote, lines };
  });

  if (!data) notFound();
  const { quote, lines } = data;

  return (
    <main>
      <PageHeader
        title={quote.solicitationTitle}
        back={
          <Link href="/portal/quotes" className={c.crumb}>
            ← My quotes
          </Link>
        }
        lede={`Notice ${quote.noticeId}`}
        actions={
          <span data-testid="quote-status">
            <Badge tone={quote.status === "SUBMITTED" ? "success" : "info"}>
              {humanizeStatus(quote.status)}
            </Badge>
          </span>
        }
      />

      <Card>
        <ul className={c.list}>
          <li className={c.rowBetween}>
            <span className={c.meta}>Total price</span>
            <span className={c.tableNum}>{formatUsd(quote.totalPrice)}</span>
          </li>
          <li className={c.rowBetween}>
            <span className={c.meta}>Period of performance</span>
            <span>{quote.periodOfPerformance ?? "—"}</span>
          </li>
          <li className={c.rowBetween}>
            <span className={c.meta}>Pay-when-paid</span>
            <span>{quote.payWhenPaid ? "Yes" : "No"}</span>
          </li>
        </ul>
      </Card>

      {quote.notes ? (
        <Section title="Notes">
          <p className={c.scope} data-testid="quote-notes">
            {quote.notes}
          </p>
        </Section>
      ) : null}

      <Section title="Line items">
        {lines.length === 0 ? (
          <p className={c.empty}>No line items.</p>
        ) : (
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="quote-lines">
              <thead>
                <tr>
                  <th>Cost type</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit rate</th>
                  <th>Extended</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{humanizeStatus(l.costType)}</td>
                    <td>{l.description}</td>
                    <td className={c.tableNum}>{Number(l.quantity)}</td>
                    <td className={c.tableNum}>{formatUsd(l.unitRate)}</td>
                    <td className={c.tableNum}>{formatUsd(l.extendedAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={c.tfoot}>
                  <td colSpan={4}>Total</td>
                  <td className={c.tableNum}>{formatUsd(quote.totalPrice)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>
    </main>
  );
}
