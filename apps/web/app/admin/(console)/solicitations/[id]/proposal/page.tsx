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

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { humanizeStatus } from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";
import { isCounselAutofill, isSubmitTestMode } from "@/lib/test-mode";

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
  typeof v === "number" && Number.isFinite(v)
    ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "—";

function Checklist({ items }: { items: ChecklistItem[] }): JSX.Element {
  if (items.length === 0) return <p className={c.empty}>None.</p>;
  return (
    <ul className={c.list}>
      {items.map((ci, i) => (
        <li key={i} className={c.row}>
          <Badge tone={ci.passed ? "success" : "warn"}>{ci.passed ? "PASS" : "REVIEW"}</Badge>
          <span>
            {ci.item}
            {ci.note ? ` — ${ci.note}` : ""}
          </span>
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
  const testMode = isSubmitTestMode();
  const counselAutofill = isCounselAutofill();

  return (
    <main>
      <PageHeader
        title="Bid decision-brief"
        back={
          <Link href={`/admin/solicitations/${sol.id}`} className={c.crumb}>
            ← {sol.title}
          </Link>
        }
        lede={
          <>
            Proposal status: {humanizeStatus(proposal.status)} · contract type {proposal.contractType}
            {compliance.provisional ? " · PROVISIONAL (dry-run baseline)" : ""}
          </>
        }
      />
      {pricing.watermark && (
        <p data-testid="watermark">
          <Badge tone="warn">{pricing.watermark}</Badge>
        </p>
      )}
      {testMode && (
        <div className={c.testBanner} data-testid="test-mode-banner" role="status">
          <strong>TEST MODE.</strong> Submissions are simulated — no bid is transmitted to any agency.
          Every submit attempt is recorded to the audit trail as{" "}
          <code className={c.code}>BID_SUBMIT_TEST_MODE</code> and the proposal stays in its current state.
          {counselAutofill
            ? " Counsel review is auto-resolved from the provisional baseline; SAM/CAGE/actual-rate blockers still compute honestly below."
            : ""}
        </div>
      )}

      <Section title="Pricing scenarios" count={scenarios.length}>
        {scenarios.length === 0 ? (
          <p className={c.empty}>No scenarios.</p>
        ) : (
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="pricing-scenarios">
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
                    <td className={c.tableNum}>{usd(s.price)}</td>
                    <td className={c.tableNum}>{pct(s.feePct)}</td>
                    <td className={c.tableNum}>{pct(s.marginPct)}</td>
                    <td className={c.tableNum}>{pct(s.vsBenchmarkMedianPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={c.meta}>
          Scenarios are a decision aid — you choose the number; the system never picks one (CLAUDE.md §6).
        </p>
      </Section>

      <div className={c.split}>
        <div>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Compliance checklist</h2>
          </div>
          <Card>
            <Checklist items={compliance.compliance?.checklist ?? []} />
          </Card>
        </div>
        <div>
          <div className={c.sectionHead}>
            <h2 className={c.sectionTitle}>Bid checklist (§3)</h2>
          </div>
          <Card>
            <Checklist items={compliance.bidChecklist?.checklist ?? []} />
          </Card>
        </div>
      </div>

      <section data-testid="live-blockers" className={c.section}>
        <h2 className={c.sectionTitle}>Live-submission blockers</h2>
        {liveReady ? (
          <p>No blockers — this bid is cleared for live submission.</p>
        ) : (
          <Card className={c.blockerCard}>
            <p>
              This bid <strong>cannot</strong> be submitted yet. The following must be resolved before any
              real bid leaves the building:
            </p>
            <ul className={c.bulletList}>
              {blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Section title="Review workflow">
        {proposal.status === "DRAFT" && (
          <form action={counselReviewProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <Button type="submit">
              {counselAutofill ? "Auto-resolve counsel review (TEST MODE)" : "Record counsel review"}
            </Button>
            {counselAutofill && (
              <p className={c.meta}>
                Resolves from the provisional baseline rather than a real external review (audited as a test
                autofill).
              </p>
            )}
          </form>
        )}
        {proposal.status === "COUNSEL_REVIEW" && (
          <form action={markProposalReady}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <Button type="submit">Mark ready to submit</Button>
          </form>
        )}
        {proposal.status === "READY_TO_SUBMIT" && (
          <form action={submitProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <Button type="submit">Submit to agency</Button>
            <p className={c.meta}>
              {testMode
                ? "TEST MODE: Submit records a sandboxed no-op (BID_SUBMIT_TEST_MODE) — nothing is transmitted and the status does not change."
                : "Submitting is blocked unless every live-submission gate passes (it does not on the provisional baseline). No bid is transmitted automatically."}
            </p>
          </form>
        )}
        {proposal.status === "SUBMITTED" && <p>Submitted by a human.</p>}
      </Section>

      {compliance.disclaimer && <p className={c.rationale}>{compliance.disclaimer}</p>}
    </main>
  );
}
