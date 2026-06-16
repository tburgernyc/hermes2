/**
 * /admin/solicitations/[id] — solicitation detail + the AI-ranked quotes. Shows the (recommendation-
 * only) triage verdict and, once quotes are in, the ranked subcontractor quotes with the human
 * shortlist / select-winner decisions. The AI rationale and vendor notes are displayed as data (JSX
 * autoescapes); they never drive a state change here (CLAUDE.md §2/§5). requireAdmin guards the page.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import {
  and,
  asc,
  eq,
  inArray,
  solicitations,
  vendorProspects,
  vendorQuotes,
  vendors,
  withOrg,
} from "@hermes/db";

import { requireAdmin } from "@/lib/auth-guard";
import { humanizeStatus } from "@/lib/admin-board";

import { approveSourcing } from "../../approvals/actions";
import { markNoGo, selectQuote, shortlistQuote } from "../actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function SolicitationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await withOrg(orgId, async (tx) => {
    const [sol] = await tx
      .select()
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, id)))
      .limit(1);
    if (!sol) return null;

    const quotes = await tx
      .select({
        id: vendorQuotes.id,
        status: vendorQuotes.status,
        totalPrice: vendorQuotes.totalPrice,
        aiRank: vendorQuotes.aiRank,
        aiRationale: vendorQuotes.aiRationale,
        prospectId: vendorQuotes.prospectId,
        vendorId: vendorQuotes.vendorId,
      })
      .from(vendorQuotes)
      .where(and(eq(vendorQuotes.orgId, orgId), eq(vendorQuotes.solicitationId, id)))
      .orderBy(asc(vendorQuotes.aiRank));

    // Resolve a display name per quote (prospect or vetted vendor).
    const names = new Map<string, string>();
    const prospectIds = quotes.map((q) => q.prospectId).filter((v): v is string => Boolean(v));
    const vendorIds = quotes.map((q) => q.vendorId).filter((v): v is string => Boolean(v));
    if (prospectIds.length > 0) {
      const ps = await tx
        .select({ id: vendorProspects.id, name: vendorProspects.companyName })
        .from(vendorProspects)
        .where(and(eq(vendorProspects.orgId, orgId), inArray(vendorProspects.id, prospectIds)));
      for (const p of ps) names.set(p.id, p.name);
    }
    if (vendorIds.length > 0) {
      const vs = await tx
        .select({ id: vendors.id, name: vendors.companyName })
        .from(vendors)
        .where(and(eq(vendors.orgId, orgId), inArray(vendors.id, vendorIds)));
      for (const v of vs) names.set(v.id, v.name);
    }

    const hasWinner = quotes.some((q) => q.status === "SELECTED");
    return { sol, quotes, names, hasWinner };
  });

  if (!data) notFound();
  const { sol, quotes, names, hasWinner } = data;

  return (
    <main>
      <p>
        <Link href="/admin/solicitations">← Solicitations</Link>
      </p>
      <h1>{sol.title}</h1>
      <p>
        {sol.agency ?? "Agency unknown"} · {humanizeStatus(sol.status)}
        {sol.responseDeadline ? ` · due ${sol.responseDeadline.toISOString()}` : ""}
      </p>
      {(sol.status === "PROPOSAL_DRAFT" || sol.status === "SUBMITTED") && (
        <p>
          <Link href={`/admin/solicitations/${sol.id}/proposal`}>→ Review the priced bid decision-brief</Link>
        </p>
      )}

      <section>
        <h2>Triage recommendation</h2>
        <p>
          Feasibility {sol.feasibilityScore ?? "?"} / 10 · zero-float fit {sol.zeroFloatFit ?? "?"} ·
          contract type {sol.contractType ?? "?"} · NAICS {sol.naicsCode ?? "?"}
        </p>
        {sol.rejectionReasons && sol.rejectionReasons.length > 0 && (
          <>
            <h3>Flagged concerns</h3>
            <ul>
              {sol.rejectionReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
        {sol.status === "TRIAGE_COMPLETE" && (
          <div>
            <form action={approveSourcing} style={{ display: "inline" }}>
              <input type="hidden" name="solicitationId" value={sol.id} />
              <button type="submit">Approve sourcing</button>
            </form>{" "}
            <form action={markNoGo} style={{ display: "inline" }}>
              <input type="hidden" name="solicitationId" value={sol.id} />
              <button type="submit">No-go</button>
            </form>
          </div>
        )}
      </section>

      {sol.scopeText && (
        <section>
          <h2>Scope (from SAM.gov)</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{sol.scopeText.slice(0, 4000)}</p>
        </section>
      )}

      <section>
        <h2>Subcontractor quotes ({quotes.length})</h2>
        {quotes.length === 0 ? (
          <p>No quotes received yet.</p>
        ) : (
          <ul>
            {quotes.map((q) => {
              const name =
                (q.prospectId && names.get(q.prospectId)) ||
                (q.vendorId && names.get(q.vendorId)) ||
                "subcontractor";
              return (
                <li key={q.id} data-testid={`quote-${q.id}`}>
                  <strong>{name}</strong> · {q.totalPrice ?? "—"} · AI rank {q.aiRank ?? "?"} ·{" "}
                  {humanizeStatus(q.status)}
                  {q.aiRationale && <div style={{ fontStyle: "italic" }}>{q.aiRationale}</div>}
                  {(q.status === "SUBMITTED" || q.status === "UNDER_REVIEW") && (
                    <form action={shortlistQuote} style={{ display: "inline" }}>
                      <input type="hidden" name="quoteId" value={q.id} />
                      <button type="submit">Shortlist</button>
                    </form>
                  )}
                  {q.status === "SHORTLISTED" && !hasWinner && (
                    <form action={selectQuote} style={{ display: "inline" }}>
                      <input type="hidden" name="quoteId" value={q.id} />
                      <button type="submit">Select winner</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p>
          Selecting a winner records your choice; the priced bid draft is generated for your review in a
          later step — nothing is submitted to the government automatically.
        </p>
      </section>
    </main>
  );
}
