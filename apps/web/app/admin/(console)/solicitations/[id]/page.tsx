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
  contracts,
  eq,
  inArray,
  solicitations,
  vendorProspects,
  vendorQuotes,
  vendors,
  withOrg,
} from "@hermes/db";

import { Badge, Card, PageHeader, Section, Select } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { humanizeStatus, isOutcomeRecordableStatus } from "@/lib/admin-board";
import { formatUsd } from "@/lib/portal";
import { requireAdmin } from "@/lib/auth-guard";

import { approveSourcing } from "../../approvals/actions";
import { markNoGo, recordOutcome, selectQuote, shortlistQuote } from "../actions";

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

    const [contract] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.solicitationId, id)))
      .limit(1);

    return { sol, quotes, names, hasWinner, hasContract: Boolean(contract) };
  });

  if (!data) notFound();
  const { sol, quotes, names, hasWinner, hasContract } = data;

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
      />
      {(sol.status === "PROPOSAL_DRAFT" || sol.status === "SUBMITTED") && (
        <p>
          <Link href={`/admin/solicitations/${sol.id}/proposal`}>
            → Review the priced bid decision-brief
          </Link>
        </p>
      )}

      <Section title="Triage recommendation">
        <Card>
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
                <Card as="li" key={q.id} size="sm" testId={`quote-${q.id}`}>
                  <div className={c.rowBetween}>
                    <div>
                      <strong>{name}</strong>
                      <div className={c.row}>
                        <Badge>{humanizeStatus(q.status)}</Badge>
                        <span className={c.meta}>
                          {q.totalPrice ?? "—"} · AI rank {q.aiRank ?? "?"}
                        </span>
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

      <Section title="Government award outcome">
        {isOutcomeRecordableStatus(sol.status) ? (
          <Card>
            <p className={c.meta}>
              Record the government&apos;s actual decision on this submitted bid. On AWARD this creates the
              subcontract record from your selected winning quote and drafts the (unsigned) subcontract
              agreement for your review — nothing is sent to the vendor or e-signed automatically.
            </p>
            <form action={recordOutcome}>
              <input type="hidden" name="solicitationId" value={sol.id} />
              <Select label="Outcome" name="outcome" defaultValue="AWARDED" required>
                <option value="AWARDED">Awarded to us</option>
                <option value="REJECTED">Lost (awarded to another offeror)</option>
                <option value="CLOSED">Cancelled / no award</option>
              </Select>
              <Field label="Awarded contract number (PIID)" name="awardedPiid" maxLength={100} />
              <Field label="Awarded value (USD)" name="awardedValue" type="number" step="0.01" min={0} />
              <Field label="Award date" name="awardDate" type="date" />
              <Field label="Contracting officer name" name="coContactName" maxLength={200} />
              <Field label="Contracting officer email" name="coContactEmail" type="email" />
              <Field label="Contracting officer phone" name="coContactPhone" maxLength={40} />
              <label className={c.row}>
                <input type="checkbox" name="debriefRequested" />
                <span>Debrief requested</span>
              </label>
              <Field label="Debrief notes" name="debriefNotes" />
              <Select label="Protest status" name="protestStatus" defaultValue="NONE">
                <option value="NONE">None</option>
                <option value="CONSIDERING">Considering</option>
                <option value="FILED">Filed</option>
                <option value="RESOLVED_SUSTAINED">Resolved — sustained</option>
                <option value="RESOLVED_DENIED">Resolved — denied</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </Select>
              <Field label="Protest notes" name="protestNotes" />
              <Field label="Outcome notes (loss reason / cancellation context)" name="outcomeNotes" />
              <Button type="submit">Record outcome</Button>
            </form>
          </Card>
        ) : sol.outcomeRecordedBy ? (
          <Card>
            <ul className={c.list}>
              <li className={c.rowBetween}>
                <span className={c.meta}>Outcome</span>
                <Badge>{humanizeStatus(sol.status)}</Badge>
              </li>
              {sol.awardedPiid && (
                <li className={c.rowBetween}>
                  <span className={c.meta}>Awarded PIID</span>
                  <span>{sol.awardedPiid}</span>
                </li>
              )}
              {sol.awardedValue && (
                <li className={c.rowBetween}>
                  <span className={c.meta}>Awarded value</span>
                  <span>{formatUsd(sol.awardedValue)}</span>
                </li>
              )}
              {sol.protestStatus !== "NONE" && (
                <li className={c.rowBetween}>
                  <span className={c.meta}>Protest</span>
                  <span>{humanizeStatus(sol.protestStatus)}</span>
                </li>
              )}
              {sol.outcomeNotes && (
                <li className={c.rowBetween}>
                  <span className={c.meta}>Notes</span>
                  <span>{sol.outcomeNotes}</span>
                </li>
              )}
            </ul>
            {sol.status === "AWARDED" && hasContract && (
              <p>
                <Link href={`/admin/solicitations/${sol.id}/subcontract`}>
                  → Review the subcontract agreement
                </Link>
              </p>
            )}
            {sol.status === "AWARDED" && !hasContract && (
              <p className={c.meta}>
                The subcontract record has not been created yet (the drafting workflow may still be
                running, or the winning quote&apos;s subcontractor is not yet a vetted vendor — see
                /admin/vendors).
              </p>
            )}
          </Card>
        ) : (
          <p className={c.empty}>
            The government outcome can be recorded once this bid has actually been submitted.
          </p>
        )}
      </Section>
    </main>
  );
}
