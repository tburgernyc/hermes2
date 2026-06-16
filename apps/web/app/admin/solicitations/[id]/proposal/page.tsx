/**
 * /admin/solicitations/[id]/proposal — the priced bid decision-brief review surface. Renders the
 * DETERMINISTIC brief drafted by the Inngest workflow (pricing scenarios + compliance + §3 bid checklist)
 * stored on the proposals row, and lets a HUMAN walk it DRAFT → COUNSEL_REVIEW → READY_TO_SUBMIT → submit.
 * All stored JSON is rendered as DATA (JSX autoescapes). The live-submission blockers are shown prominently
 * — they are the no-real-bid proof: on the provisional baseline the submit is structurally blocked
 * (CLAUDE.md §2/§6). Nothing here sends or submits to the government automatically.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import { and, desc, eq, proposals, solicitations, withOrg } from "@hermes/db";

import { requireAdmin } from "@/lib/auth-guard";
import { humanizeStatus } from "@/lib/admin-board";

import { counselReviewProposal, markProposalReady, submitProposal } from "./actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

interface Scenario {
  label: string;
  feePct: number;
  price: number;
  marginPct: number;
  vsBenchmarkMedianPct?: number | null;
}
interface PricingJson {
  scenarios?: Scenario[];
  watermark?: string | null;
  disclaimer?: string;
}
interface ChecklistItem {
  item: string;
  passed: boolean;
  note?: string;
}
interface ComplianceJson {
  compliance?: { checklist?: ChecklistItem[]; blocking?: boolean };
  bidChecklist?: { checklist?: ChecklistItem[]; blocking?: boolean };
  liveSubmission?: { ready?: boolean; blockers?: string[] };
  provisional?: boolean;
  watermark?: string | null;
  disclaimer?: string;
}

const pct = (v: number | null | undefined): string =>
  typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
const usd = (v: number | null | undefined): string =>
  typeof v === "number" && Number.isFinite(v) ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—";

function Checklist({ items }: { items: ChecklistItem[] }): JSX.Element {
  if (items.length === 0) return <p>None.</p>;
  return (
    <ul>
      {items.map((c, i) => (
        <li key={i}>
          <strong>{c.passed ? "PASS" : "REVIEW"}</strong> · {c.item}
          {c.note ? ` — ${c.note}` : ""}
        </li>
      ))}
    </ul>
  );
}

export default async function ProposalReview({
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
      .select({ id: solicitations.id, title: solicitations.title, status: solicitations.status })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, id)))
      .limit(1);
    if (!sol) return null;

    const [proposal] = await tx
      .select()
      .from(proposals)
      .where(and(eq(proposals.orgId, orgId), eq(proposals.solicitationId, id)))
      .orderBy(desc(proposals.createdAt))
      .limit(1);
    if (!proposal) return null;
    return { sol, proposal };
  });

  if (!data) notFound();
  const { sol, proposal } = data;
  const pricing = (proposal.pricingScenarios ?? {}) as PricingJson;
  const compliance = (proposal.complianceChecklist ?? {}) as ComplianceJson;
  const scenarios = pricing.scenarios ?? [];
  const blockers = compliance.liveSubmission?.blockers ?? [];
  const liveReady = compliance.liveSubmission?.ready === true;

  return (
    <main>
      <p>
        <Link href={`/admin/solicitations/${sol.id}`}>← {sol.title}</Link>
      </p>
      <h1>Bid decision-brief</h1>
      <p>
        Proposal status: {humanizeStatus(proposal.status)} · contract type {proposal.contractType}
        {compliance.provisional ? " · PROVISIONAL (dry-run baseline)" : ""}
      </p>
      {pricing.watermark && <p data-testid="watermark">{pricing.watermark}</p>}

      <section>
        <h2>Pricing scenarios ({scenarios.length})</h2>
        {scenarios.length === 0 ? (
          <p>No scenarios.</p>
        ) : (
          <table data-testid="pricing-scenarios">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Price</th>
                <th>Fee %</th>
                <th>Margin %</th>
                <th>vs. benchmark median</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => (
                <tr key={i} data-testid={`scenario-${i}`}>
                  <td>{s.label}</td>
                  <td>{usd(s.price)}</td>
                  <td>{pct(s.feePct)}</td>
                  <td>{pct(s.marginPct)}</td>
                  <td>{pct(s.vsBenchmarkMedianPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p>
          Scenarios are a decision aid — you choose the number; the system never picks one (CLAUDE.md §6).
        </p>
      </section>

      <section>
        <h2>Compliance checklist</h2>
        <Checklist items={compliance.compliance?.checklist ?? []} />
      </section>

      <section>
        <h2>Bid checklist (§3)</h2>
        <Checklist items={compliance.bidChecklist?.checklist ?? []} />
      </section>

      <section data-testid="live-blockers">
        <h2>Live-submission blockers</h2>
        {liveReady ? (
          <p>No blockers — this bid is cleared for live submission.</p>
        ) : (
          <>
            <p>
              This bid <strong>cannot</strong> be submitted yet. The following must be resolved before any
              real bid leaves the building:
            </p>
            <ul>
              {blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Review workflow</h2>
        {proposal.status === "DRAFT" && (
          <form action={counselReviewProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button type="submit">Record counsel review</button>
          </form>
        )}
        {proposal.status === "COUNSEL_REVIEW" && (
          <form action={markProposalReady}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button type="submit">Mark ready to submit</button>
          </form>
        )}
        {proposal.status === "READY_TO_SUBMIT" && (
          <form action={submitProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button type="submit">Submit to agency</button>
            <p>
              Submitting is blocked unless every live-submission gate passes (it does not on the provisional
              baseline). No bid is transmitted automatically.
            </p>
          </form>
        )}
        {proposal.status === "SUBMITTED" && <p>Submitted by a human.</p>}
      </section>

      {compliance.disclaimer && <p style={{ fontStyle: "italic" }}>{compliance.disclaimer}</p>}
    </main>
  );
}
