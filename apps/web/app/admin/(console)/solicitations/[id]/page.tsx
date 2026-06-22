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

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { humanizeStatus, recommendationLabel, recommendationTone } from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";

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
        aiScore: vendorQuotes.aiScore,
        aiRisks: vendorQuotes.aiRisks,
        prospectId: vendorQuotes.prospectId,
        vendorId: vendorQuotes.vendorId,
      })
      .from(vendorQuotes)
      .where(and(eq(vendorQuotes.orgId, orgId), eq(vendorQuotes.solicitationId, id)))
      .orderBy(asc(vendorQuotes.aiRank));

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
      <PageHeader
        title={sol.title}
        back={
          <Link href="/admin/solicitations" className={c.crumb}>
            ← Solicitations
          </Link>
        }
        lede={
          <>
            {sol.agency ?? "Agency unknown"} · {humanizeStatus(sol.status)}
            {sol.responseDeadline ? ` · due ${sol.responseDeadline.toISOString()}` : ""}
          </>
        }
        actions={
          <>
            {sol.triageRecommendation && (
              <Badge tone={recommendationTone(sol.triageRecommendation)}>
                {recommendationLabel(sol.triageRecommendation)}
              </Badge>
            )}
            <Badge tone="info">feasibility {sol.feasibilityScore ?? "?"}</Badge>
            <Badge>{sol.contractType ?? "—"}</Badge>
          </>
        }
      />
      {(sol.status === "PROPOSAL_DRAFT" || sol.status === "SUBMITTED") && (
        <p>
          <Link href={`/admin/solicitations/${sol.id}/proposal`}>
            → Review the priced bid decision-brief
          </Link>
        </p>
      )}

      {sol.quoteInjectionAttempts && sol.quoteInjectionAttempts.length > 0 && (
        <Card className={c.blockerCard} testId="injection-warning">
          <strong>
            ⚠ {sol.quoteInjectionAttempts.length} quote(s) attempted to influence the AI ranking and
            were ignored.
          </strong>
          <ul className={c.bulletList}>
            {sol.quoteInjectionAttempts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      <Section title="Triage recommendation">
        <Card>
          <div className={c.row}>
            {sol.triageRecommendation && (
              <Badge tone={recommendationTone(sol.triageRecommendation)}>
                {recommendationLabel(sol.triageRecommendation)}
              </Badge>
            )}
            <span className={c.metaMono}>
              NAICS {sol.naicsCode ?? "?"} · zero-float fit {sol.zeroFloatFit ?? "?"} · contract type{" "}
              {sol.contractType ?? "?"}
            </span>
          </div>
          {sol.triageSummary && <p className={c.rationale}>{sol.triageSummary}</p>}
          {sol.rejectionReasons && sol.rejectionReasons.length > 0 && (
            <>
              <strong>Flagged concerns</strong>
              <ul className={c.bulletList}>
                {sol.rejectionReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
          {sol.status === "TRIAGE_COMPLETE" && (
            <div className={c.row}>
              <form action={approveSourcing}>
                <input type="hidden" name="solicitationId" value={sol.id} />
                <Button type="submit" size="sm">
                  Approve sourcing
                </Button>
              </form>
              <form action={markNoGo}>
                <input type="hidden" name="solicitationId" value={sol.id} />
                <Button type="submit" size="sm" variant="ghost">
                  No-go
                </Button>
              </form>
            </div>
          )}
        </Card>
      </Section>

      {sol.scopeText && (
        <Section title="Scope (from SAM.gov)">
          <p className={c.scope}>{sol.scopeText.slice(0, 4000)}</p>
        </Section>
      )}

      <Section title="Subcontractor quotes" count={quotes.length}>
        {quotes.length === 0 ? (
          <p className={c.empty}>No quotes received yet.</p>
        ) : (
          <ul className={c.list}>
            {quotes.map((q) => {
              const name =
                (q.prospectId && names.get(q.prospectId)) ||
                (q.vendorId && names.get(q.vendorId)) ||
                "subcontractor";
              return (
                <Card as="li" key={q.id} size="sm" testId={`quote-${q.id}`} className={c.hoverable}>
                  <div className={c.rowBetween}>
                    <div>
                      <div className={c.row}>
                        {typeof q.aiRank === "number" ? (
                          <span className={c.rankPill}>#{q.aiRank}</span>
                        ) : null}
                        <strong>{name}</strong>
                        {q.aiScore != null && (
                          <Badge tone="info">AI score {Number(q.aiScore).toFixed(0)}</Badge>
                        )}
                      </div>
                      <div className={c.row}>
                        <Badge>{humanizeStatus(q.status)}</Badge>
                        <span className={c.metaMono}>{q.totalPrice ?? "—"}</span>
                      </div>
                    </div>
                    <div className={c.row}>
                      {(q.status === "SUBMITTED" || q.status === "UNDER_REVIEW") && (
                        <form action={shortlistQuote}>
                          <input type="hidden" name="quoteId" value={q.id} />
                          <Button type="submit" size="sm">
                            Shortlist
                          </Button>
                        </form>
                      )}
                      {q.status === "SHORTLISTED" && !hasWinner && (
                        <form action={selectQuote}>
                          <input type="hidden" name="quoteId" value={q.id} />
                          <Button type="submit" size="sm">
                            Select winner
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                  {q.aiRationale && <div className={c.rationale}>{q.aiRationale}</div>}
                  {q.aiRisks && q.aiRisks.length > 0 && (
                    <div className={c.rationale}>
                      <strong>Risks flagged</strong>
                      <ul className={c.bulletList}>
                        {q.aiRisks.map((risk, i) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              );
            })}
          </ul>
        )}
        <p className={c.meta}>
          Selecting a winner records your choice; the priced bid draft is generated for your review in a
          later step — nothing is submitted to the government automatically.
        </p>
      </Section>
    </main>
  );
}
