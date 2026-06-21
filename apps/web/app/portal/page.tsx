import Link from "next/link";
import type { JSX } from "react";

import {
  and,
  contracts,
  desc,
  documents,
  eq,
  inArray,
  solicitations,
  vendorQuotes,
  vendors,
  withVendorRole,
} from "@hermes/db";

import { Badge, Card, PageHeader, Section, Stat } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireVendor } from "@/lib/auth-guard";
import { OPEN_RFQ_STATUSES, formatUsd, humanizeStatus } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Quotes in these states are closed out; everything else is an "active" quote for the stat tile. */
const TERMINAL_QUOTE_STATUSES = new Set(["REJECTED", "WITHDRAWN"]);

/**
 * Subcontractor dashboard — an aggregate that COMPOSES the same per-page reads (open RFQs, my quotes,
 * my contracts, my documents) into one withVendorRole transaction, so the counts + previews are the real
 * RLS-scoped data a vendor would see on each full page (never synthetic rows). An unlinked vendor (no
 * session vendorId) gets the pending-vetting notice instead — requireVendor (not …WithVendorId) lets them
 * reach the shell. Rendering only reads.
 */
export default async function PortalHome(): Promise<JSX.Element> {
  const session = await requireVendor();
  const orgId = session.user.orgId;
  const vendorId = session.user.vendorId;

  if (!vendorId) {
    return (
      <main>
        <PageHeader title="Subcontractor dashboard" lede={`Signed in as ${session.user.email}.`} />
        <Card>
          <p data-testid="vendor-link">
            Account pending vetting — an administrator must link your account before you can submit quotes.
          </p>
        </Card>
      </main>
    );
  }

  const data = await withVendorRole(orgId, vendorId, async (tx) => {
    const vendorRow = await tx
      .select({ name: vendors.companyName })
      .from(vendors)
      .where(and(eq(vendors.orgId, orgId), eq(vendors.id, vendorId)))
      .limit(1);

    const openRfqs = await tx
      .select({
        id: solicitations.id,
        title: solicitations.title,
        agency: solicitations.agency,
        naicsCode: solicitations.naicsCode,
        responseDeadline: solicitations.responseDeadline,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), inArray(solicitations.status, OPEN_RFQ_STATUSES)))
      .orderBy(desc(solicitations.responseDeadline));

    const myQuotes = await tx
      .select({
        id: vendorQuotes.id,
        status: vendorQuotes.status,
        totalPrice: vendorQuotes.totalPrice,
        solicitationTitle: solicitations.title,
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
      .orderBy(desc(vendorQuotes.createdAt));

    const myContracts = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.awardedVendorId, vendorId)));

    const myDocuments = await tx
      .select({
        id: documents.id,
        kind: documents.kind,
        magicByteValidated: documents.magicByteValidated,
      })
      .from(documents)
      .where(eq(documents.orgId, orgId))
      .orderBy(desc(documents.createdAt));

    return { vendorRow, openRfqs, myQuotes, myContracts, myDocuments };
  });

  const vendorName = data.vendorRow[0]?.name ?? session.user.email ?? "Subcontractor";
  const activeQuotes = data.myQuotes.filter((q) => !TERMINAL_QUOTE_STATUSES.has(q.status)).length;
  const rfqPreview = data.openRfqs.slice(0, 2);
  const quotePreview = data.myQuotes.slice(0, 4);
  const docPreview = data.myDocuments.slice(0, 3);

  return (
    <main>
      <PageHeader
        title="Subcontractor dashboard"
        lede={`Welcome back, ${vendorName}. Here's what needs your attention.`}
      />
      <p className={c.meta} data-testid="vendor-link">
        Vendor account linked.
      </p>

      <div className={c.statGrid}>
        <Stat label="Open RFQs to bid" value={data.openRfqs.length} />
        <Stat label="Active quotes" value={activeQuotes} />
        <Stat label="Subcontracts" value={data.myContracts.length} />
        <Stat label="Documents" value={data.myDocuments.length} />
      </div>

      <Section
        title="Open RFQs"
        count={data.openRfqs.length}
        actions={
          <Link href="/portal/solicitations" className={c.crumb}>
            View all
          </Link>
        }
      >
        {rfqPreview.length === 0 ? (
          <p className={c.empty}>No open RFQs right now.</p>
        ) : (
          <ul className={c.list}>
            {rfqPreview.map((s) => (
              <Card as="li" key={s.id} size="sm" className={c.hoverable}>
                <div className={c.rowBetween}>
                  <div>
                    <Link href={`/portal/solicitations/${s.id}/quote`}>{s.title}</Link>
                    <div className={c.metaMono}>
                      {s.agency ?? "Agency unknown"} · NAICS {s.naicsCode ?? "—"}
                    </div>
                  </div>
                  <span className={c.metaMono}>
                    {s.responseDeadline ? `due ${s.responseDeadline.toISOString().slice(0, 10)}` : "no deadline"}
                  </span>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="My quotes"
        actions={
          <Link href="/portal/quotes" className={c.crumb}>
            View all
          </Link>
        }
      >
        {quotePreview.length === 0 ? (
          <p className={c.empty}>You have not submitted any quotes yet.</p>
        ) : (
          <ul className={c.list}>
            {quotePreview.map((q) => (
              <Card as="li" key={q.id} size="sm" className={c.hoverable}>
                <div className={c.rowBetween}>
                  <Link href={`/portal/quotes/${q.id}`}>{q.solicitationTitle}</Link>
                  <div className={c.row}>
                    <span className={c.tableNum}>{formatUsd(q.totalPrice)}</span>
                    <Badge tone={q.status === "SUBMITTED" ? "success" : "info"}>
                      {humanizeStatus(q.status)}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Compliance documents"
        actions={
          <Link href="/portal/documents" className={c.crumb}>
            Manage
          </Link>
        }
      >
        {docPreview.length === 0 ? (
          <p className={c.empty}>No documents yet.</p>
        ) : (
          <ul className={c.list}>
            {docPreview.map((d) => (
              <Card as="li" key={d.id} size="sm">
                <div className={c.rowBetween}>
                  <span className={c.metaMono}>{humanizeStatus(d.kind)}</span>
                  <Badge tone={d.magicByteValidated ? "success" : "neutral"}>
                    {d.magicByteValidated ? "Validated" : "Unvalidated"}
                  </Badge>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
