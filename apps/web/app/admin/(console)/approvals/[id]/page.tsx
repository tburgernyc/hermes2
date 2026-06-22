/**
 * /admin/approvals/[id] — outreach-campaign approval detail (read surface). [id] is an
 * outreach_campaigns row; the page resolves its parent solicitation and the FULL cohort of SIBLING
 * campaigns still PENDING_APPROVAL for that solicitation (one prospect each). RSC + org-scoped (withOrg):
 * rendering only reads. The interactive right pane + release gate live in <ApprovalCohort> (the only writers,
 * via the existing approveOutreach/rejectOutreach actions — CLAUDE.md §2). requireAdmin is defense in depth
 * behind the /admin middleware gate.
 */
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { and, desc, eq, outreachCampaigns, solicitations, vendorProspects, withOrg } from "@hermes/db";

import { Badge, PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireAdmin } from "@/lib/auth-guard";

import { ApprovalCohort, type RecipientRow } from "./ApprovalCohort";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A prospect is low-confidence when its general discovery score is weak and/or it is still early-stage. */
const LOW_CONFIDENCE_SCORE = 60;
const EARLY_STATUSES = new Set(["NEW", "SCREENED"]);

function isLowConfidence(discoveryScore: number | null, prospectStatus: string): boolean {
  if (discoveryScore === null || discoveryScore < LOW_CONFIDENCE_SCORE) return true;
  return EARLY_STATUSES.has(prospectStatus);
}

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const data = await withOrg(orgId, async (tx) => {
    const campaign = await tx
      .select({ solicitationId: outreachCampaigns.solicitationId })
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.id, id)))
      .limit(1);
    const campaignRow = campaign[0];
    if (!campaignRow) return null;
    const solicitationId = campaignRow.solicitationId;

    const sol = await tx
      .select({
        title: solicitations.title,
        agency: solicitations.agency,
        noticeId: solicitations.noticeId,
        scopeText: solicitations.scopeText,
        feasibilityScore: solicitations.feasibilityScore,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)))
      .limit(1);
    const solRow = sol[0];
    if (!solRow) return null;

    const recipients = await tx
      .select({
        outreachId: outreachCampaigns.id,
        prospectName: vendorProspects.companyName,
        discoveryScore: vendorProspects.discoveryScore,
        prospectStatus: vendorProspects.status,
        capabilitiesText: vendorProspects.capabilitiesText,
        matchScore: outreachCampaigns.aiMatchScore,
        capabilityMatch: outreachCampaigns.aiCapabilityMatch,
        strengths: outreachCampaigns.aiStrengths,
        gaps: outreachCampaigns.aiGaps,
        recommendation: outreachCampaigns.aiRecommendation,
      })
      .from(outreachCampaigns)
      .innerJoin(
        vendorProspects,
        and(
          eq(vendorProspects.orgId, outreachCampaigns.orgId),
          eq(vendorProspects.id, outreachCampaigns.prospectId),
        ),
      )
      .where(
        and(
          eq(outreachCampaigns.orgId, orgId),
          eq(outreachCampaigns.solicitationId, solicitationId),
          eq(outreachCampaigns.status, "PENDING_APPROVAL"),
        ),
      )
      .orderBy(desc(vendorProspects.discoveryScore));

    return { sol: solRow, recipients };
  });

  if (!data) notFound();
  const { sol, recipients } = data;

  const cohort: RecipientRow[] = recipients.map((r) => ({
    outreachId: r.outreachId,
    prospectName: r.prospectName,
    discoveryScore: r.discoveryScore,
    prospectStatus: r.prospectStatus,
    capabilitiesText: r.capabilitiesText,
    lowConfidence: isLowConfidence(r.discoveryScore, r.prospectStatus),
    matchScore: r.matchScore,
    // ai_capability_match is a numeric column (string at the driver) — coerce for display.
    capabilityMatch: r.capabilityMatch != null ? Number(r.capabilityMatch) : null,
    strengths: r.strengths ?? [],
    gaps: r.gaps ?? [],
    recommendation: r.recommendation,
  }));

  // scope_text is raw SOW data — rendered as text (JSX autoescape), never executed (CLAUDE.md §5).
  const sourceLines = (sol.scopeText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const source =
    sourceLines.length > 0 ? (
      sourceLines.map((line, i) => (
        <div key={i} className={c.docLine}>
          {line}
        </div>
      ))
    ) : (
      <p className={c.docLine}>No scope text on file for this solicitation.</p>
    );

  return (
    <main>
      <PageHeader
        title={sol.title}
        lede={`${sol.agency ?? "Agency unknown"} · Notice ${sol.noticeId}`}
        back={
          <Link href="/admin/approvals" className={c.crumb}>
            ← Approvals
          </Link>
        }
        actions={
          <Badge tone="info">
            Feasibility {sol.feasibilityScore !== null ? `${sol.feasibilityScore}/10` : "—"}
          </Badge>
        }
      />

      <p className={c.meta}>
        Discovery score is an AI prospect score computed at discovery — not a per-solicitation match score.
      </p>

      <ApprovalCohort recipients={cohort} source={source} />
    </main>
  );
}
