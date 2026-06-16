"use server";

/**
 * Proposal review gates for the operator console. The drafting workflow (Inngest) produces a DRAFT
 * proposal; a HUMAN walks it through DRAFT → COUNSEL_REVIEW → READY_TO_SUBMIT → SUBMITTED here. Every
 * action is behind requireAdmin (role + satisfied TOTP), runs in an org-scoped transaction, appends an
 * ADMIN audit row, and emits NO events and performs NO outbound work (CLAUDE.md §2). The final submit is
 * STRUCTURALLY blocked by readyForLiveSubmission for as long as the firm runs on the provisional baseline
 * (no counsel-confirmed thresholds, no actual rates, no SAM/CAGE) — so no real bid can leave the system.
 * The proposals no-auto-submit + counsel CHECKs are the final DB backstop.
 */
import { revalidatePath } from "next/cache";

import {
  and,
  eq,
  hasUnconfirmedCounselThresholds,
  orgs,
  parseDirectives,
  proposals,
  withOrg,
} from "@hermes/db";
import { readyForLiveSubmission } from "@hermes/ai";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

function revalidateProposal(solicitationId: string | null): void {
  if (solicitationId) revalidatePath(`/admin/solicitations/${solicitationId}/proposal`);
}

/** Record that counsel has reviewed the draft (DRAFT → COUNSEL_REVIEW). A human decision; no outbound. */
export async function counselReviewProposal(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const proposalId = readId(formData, "proposalId");

  const solicitationId = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(proposals)
      .set({ status: "COUNSEL_REVIEW", counselReviewedBy: userId, counselReviewedAt: new Date() })
      .where(
        and(eq(proposals.orgId, orgId), eq(proposals.id, proposalId), eq(proposals.status, "DRAFT")),
      )
      .returning({ solicitationId: proposals.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROPOSAL_COUNSEL_REVIEWED",
      entityType: "proposals",
      entityId: proposalId,
    });
    return row.solicitationId;
  });

  revalidateProposal(solicitationId);
}

/** Mark a counsel-reviewed proposal ready (COUNSEL_REVIEW → READY_TO_SUBMIT). No outbound. */
export async function markProposalReady(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const proposalId = readId(formData, "proposalId");

  const solicitationId = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(proposals)
      .set({ status: "READY_TO_SUBMIT" })
      .where(
        and(
          eq(proposals.orgId, orgId),
          eq(proposals.id, proposalId),
          eq(proposals.status, "COUNSEL_REVIEW"),
        ),
      )
      .returning({
        solicitationId: proposals.solicitationId,
        counselReviewedBy: proposals.counselReviewedBy,
      });
    const row = rows[0];
    // Defense in depth alongside the DB CHECK: a COUNSEL_REVIEW row always has a recorded reviewer.
    if (!row || !row.counselReviewedBy) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROPOSAL_MARKED_READY",
      entityType: "proposals",
      entityId: proposalId,
    });
    return row.solicitationId;
  });

  revalidateProposal(solicitationId);
}

/**
 * The structural no-real-bid proof. A human attempts to submit (READY_TO_SUBMIT → SUBMITTED), but the
 * bid only leaves the building if readyForLiveSubmission passes — which it cannot on the provisional
 * baseline. We recompute the gates from CURRENT directives (they may have changed since drafting). On a
 * block we audit BID_SUBMIT_BLOCKED and DO NOT change status. Still no event, no network; the two
 * proposals CHECKs are the final backstop.
 */
export async function submitProposal(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const proposalId = readId(formData, "proposalId");

  const solicitationId = await withOrg(orgId, async (tx) => {
    const [proposal] = await tx
      .select({
        solicitationId: proposals.solicitationId,
        status: proposals.status,
        counselReviewedBy: proposals.counselReviewedBy,
      })
      .from(proposals)
      .where(and(eq(proposals.orgId, orgId), eq(proposals.id, proposalId)))
      .limit(1);
    if (!proposal || proposal.status !== "READY_TO_SUBMIT") return null;

    const [org] = await tx
      .select({ directives: orgs.directives })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    const dir = parseDirectives(org?.directives);

    const { ready, blockers } = readyForLiveSubmission({
      counselConfirmed: !hasUnconfirmedCounselThresholds(dir),
      actualRatesLoaded: !dir.provisionalRatesMode,
      samRegistrationActive: dir.registration.samRegistrationActive,
      cageAssigned: dir.registration.cageAssigned,
      humanSignature: true, // the human is performing this submit action
      counselReviewed: proposal.counselReviewedBy != null,
    });

    if (!ready) {
      await writeAudit(tx, {
        orgId,
        actorType: "ADMIN",
        actorUserId: userId,
        actorEmail: session.user.email ?? null,
        action: "BID_SUBMIT_BLOCKED",
        entityType: "proposals",
        entityId: proposalId,
        after: { blockers },
      });
      return proposal.solicitationId; // unchanged — stays READY_TO_SUBMIT
    }

    // Only reachable OFF the provisional baseline. The status-guard + counsel-non-null predicate mirror
    // the DB CHECKs (proposals_submit_requires_human/_counsel) — the final backstop.
    await tx
      .update(proposals)
      .set({ status: "SUBMITTED", submittedBy: userId, submittedAt: new Date() })
      .where(
        and(
          eq(proposals.orgId, orgId),
          eq(proposals.id, proposalId),
          eq(proposals.status, "READY_TO_SUBMIT"),
        ),
      );
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROPOSAL_SUBMITTED",
      entityType: "proposals",
      entityId: proposalId,
    });
    return proposal.solicitationId;
  });

  revalidateProposal(solicitationId);
}
