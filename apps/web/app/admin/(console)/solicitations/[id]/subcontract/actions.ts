"use server";

/**
 * §3.1.4 human gates on the drafted subcontract agreement: this is a BINDING LEGAL DOCUMENT headed to a
 * third party, so it gets at least the same care as the counsel-review gate on the government-facing
 * proposal (CLAUDE.md §2/§6). Two SEPARATE, explicit admin actions:
 *   1. confirmSubcontractReview — the admin reads (and may edit) the drafted text, then confirms review.
 *      This records `agreement_reviewed_by/at`, which the `contracts_esign_requires_review` DB CHECK
 *      requires before esign_status may leave NOT_STARTED (Phase A). Always stores the CONFIRMED text as a
 *      new SUBCONTRACT_DRAFT document revision (append-only — the original AI draft is never overwritten,
 *      mirrors the documents-table no-history-erasure doctrine) so the reviewed version is the artifact of
 *      record.
 *   2. startEsign — a SEPARATE, explicit action (never automatic the instant review is confirmed). This is
 *      a STUB that flips esign_status NOT_STARTED/EXPIRED → SENT; the real e-signature vendor integration
 *      is a later phase (§7.3). No email/outbound happens here — only a status flip + audit row.
 *
 * §3.2 baseline audit additions (below): the post-award lifecycle had no writers past this point.
 * recordEsignSigned/recordEsignExpired record EXTERNAL facts about a SENT agreement (never a real
 * e-signature integration). activateContract/completeContract/terminateContract/closeOutContract advance
 * contract_status (PENDING_SIGNATURE → ACTIVE → COMPLETED → CLOSED_OUT, or → TERMINATED at any
 * non-terminal point) — every one a deliberate human business decision, never inferred. startMilestone/
 * completeMilestone advance milestone_status PENDING → IN_PROGRESS → COMPLETED; INVOICED/PAID are
 * deliberately out of scope here (§3.3 finance flow / Wave 2c).
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  and,
  contractMilestones,
  contracts,
  documents,
  eq,
  inArray,
  isNotNull,
  isNull,
  withOrg,
} from "@hermes/db";
import { contractDocumentKey, getStorage, sha256Hex } from "@hermes/core";
import { writeAudit } from "@hermes/inngest";

import {
  ACTIVATABLE_CONTRACT_STATUSES,
  CLOSEOUTABLE_CONTRACT_STATUSES,
  COMPLETABLE_CONTRACT_STATUSES,
  COMPLETABLE_MILESTONE_STATUSES,
  ESIGN_RESOLVABLE_STATUSES,
  ESIGN_STARTABLE_STATUSES,
  STARTABLE_MILESTONE_STATUSES,
  TERMINATABLE_CONTRACT_STATUSES,
} from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";

// Node runtime (getStorage() needs the AWS SDK) is set on the invoking page.tsx — a "use server" module may
// only export async functions (CLAUDE.md convention), so the route-segment config cannot live here.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DRAFT_TEXT = 100_000;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

/**
 * Record the admin's explicit review (and any edits) of the drafted subcontract agreement. One-time gate:
 * a contract that has already been reviewed cannot be silently re-reviewed by this action (mirrors
 * linkVendorUser's isNull one-time-binding guard) — a genuine re-review after edits is a deliberate
 * follow-on, not this action.
 */
export async function confirmSubcontractReview(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");
  const draftText = String(formData.get("draftText") ?? "").slice(0, MAX_DRAFT_TEXT);
  if (draftText.trim().length === 0) throw new Error("Reviewed text cannot be empty");

  const reviewed = await withOrg(orgId, async (tx) => {
    // One atomic conditional UPDATE (mirrors selectQuote's single-winner guard): only an existing,
    // NOT-yet-reviewed contract in THIS org can be confirmed — no read-then-write TOCTOU window, and a
    // contract that was already reviewed (or does not exist) is simply a no-op, never a silent overwrite.
    const updated = await tx
      .update(contracts)
      .set({ agreementReviewedBy: userId, agreementReviewedAt: new Date() })
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, contractId), isNull(contracts.agreementReviewedBy)))
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const contract = updated[0];
    if (!contract) return null; // not found, or already reviewed — no-op

    // Store the CONFIRMED text as a new, append-only SUBCONTRACT_DRAFT revision (the AI-drafted original
    // is never overwritten — mirrors the documents table's no-history-erasure doctrine).
    const documentId = randomUUID();
    const bytes = new TextEncoder().encode(draftText);
    const key = contractDocumentKey(orgId, contractId, documentId, "md");
    await getStorage().put(key, bytes, "text/markdown");
    await tx.insert(documents).values({
      id: documentId,
      orgId,
      entityType: "CONTRACT",
      contractId,
      kind: "SUBCONTRACT_DRAFT",
      storageKey: key,
      contentType: "text/markdown",
      byteSize: bytes.byteLength,
      sha256: sha256Hex(bytes),
      magicByteValidated: true, // system-generated bytes, not a client upload
    });

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_AGREEMENT_REVIEWED",
      entityType: "contracts",
      entityId: contractId,
      after: { documentId },
    });
    return contract.solicitationId;
  });

  if (reviewed) {
    revalidatePath(`/admin/solicitations/${reviewed}/subcontract`);
  }
}

/**
 * STUB: flip esign_status → SENT, from NOT_STARTED (first send) or EXPIRED (an explicit admin resend after
 * a lapsed agreement — never automatic). This is a SEPARATE, explicit admin action from review — it never
 * fires automatically the instant confirmSubcontractReview runs. No vendor is contacted here; the real
 * e-signature vendor integration (send/track/webhook) is a later phase (§7.3). The DB CHECK
 * (contracts_esign_requires_review) is the structural backstop: this can only ever succeed once a review
 * is recorded, but the WHERE clause guards it too so an un-reviewed contract simply no-ops.
 */
export async function startEsign(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const started = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ esignStatus: "SENT" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.esignStatus, [...ESIGN_STARTABLE_STATUSES]),
          isNotNull(contracts.agreementReviewedBy), // app-layer guard mirroring the DB CHECK
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_ESIGN_STARTED",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (started) {
    revalidatePath(`/admin/solicitations/${started}/subcontract`);
  }
}

/**
 * §3.2 baseline audit: esign_status SIGNED had no writer. The vendor countersigns OUTSIDE this system (no
 * real e-signature vendor integration exists — §7.3); the admin records that the fully-executed agreement
 * came back. A human recording an external fact, never inferred — mirrors markProspectResponded.
 */
export async function recordEsignSigned(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const recorded = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ esignStatus: "SIGNED" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.esignStatus, [...ESIGN_RESOLVABLE_STATUSES]),
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_ESIGN_SIGNED",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (recorded) revalidatePath(`/admin/solicitations/${recorded}/subcontract`);
}

/**
 * §3.2 baseline audit: esign_status EXPIRED had no writer. The admin records that a SENT agreement lapsed
 * (e.g. the vendor never signed within a reasonable window) — an explicit human observation, never a
 * timed auto-expiry. Once EXPIRED, startEsign may explicitly resend (ESIGN_STARTABLE_STATUSES includes
 * EXPIRED) — a deliberate admin retry, not automatic.
 */
export async function recordEsignExpired(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const recorded = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ esignStatus: "EXPIRED" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.esignStatus, [...ESIGN_RESOLVABLE_STATUSES]),
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_ESIGN_EXPIRED",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (recorded) revalidatePath(`/admin/solicitations/${recorded}/subcontract`);
}

/**
 * §3.2 baseline audit EXTRA (beyond the audited list — esign_status DECLINED was ALSO unreachable, same
 * class of gap as SIGNED/EXPIRED, closed here for the same reason): the admin records that the vendor
 * declined to sign the agreement. An external fact, never inferred.
 */
export async function recordEsignDeclined(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const recorded = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ esignStatus: "DECLINED" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.esignStatus, [...ESIGN_RESOLVABLE_STATUSES]),
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_ESIGN_DECLINED",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (recorded) revalidatePath(`/admin/solicitations/${recorded}/subcontract`);
}

/**
 * §3.2 baseline audit: contract_status ACTIVE had no writer — a contract sat at PENDING_SIGNATURE forever.
 * ACTIVE naturally follows a recorded countersignature (esign_status SIGNED); both conditions are checked
 * in the same atomic UPDATE (no read-then-write TOCTOU window).
 */
export async function activateContract(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const activated = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ status: "ACTIVE" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.status, [...ACTIVATABLE_CONTRACT_STATUSES]),
          eq(contracts.esignStatus, "SIGNED"),
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_ACTIVATED",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (activated) revalidatePath(`/admin/solicitations/${activated}/subcontract`);
}

/**
 * §3.2 baseline audit: contract_status COMPLETED had no writer. The admin records that the work is done
 * (ACTIVE → COMPLETED) — a human business decision, never inferred from milestone state.
 */
export async function completeContract(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const completed = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ status: "COMPLETED" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.status, [...COMPLETABLE_CONTRACT_STATUSES]),
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_COMPLETED",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (completed) revalidatePath(`/admin/solicitations/${completed}/subcontract`);
}

/**
 * §3.2 baseline audit: contract_status TERMINATED had no writer. This must always be an explicit,
 * deliberate admin decision (CLAUDE.md §2 — never inferred) — reachable from either PENDING_SIGNATURE
 * (the deal falls through before signature) or ACTIVE (terminated mid-performance).
 */
export async function terminateContract(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const terminated = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ status: "TERMINATED" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.status, [...TERMINATABLE_CONTRACT_STATUSES]),
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_TERMINATED",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (terminated) revalidatePath(`/admin/solicitations/${terminated}/subcontract`);
}

/**
 * §3.2 baseline audit: contract_status CLOSED_OUT had no writer. Administrative closeout of an
 * already-COMPLETED contract — an operator judgment call, deliberately NOT gated on the §3.3 financial
 * flow (final invoice paid / retention released), which is separate, later wiring (Wave 2c).
 */
export async function closeOutContract(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const contractId = readId(formData, "contractId");

  const closedOut = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contracts)
      .set({ status: "CLOSED_OUT" })
      .where(
        and(
          eq(contracts.orgId, orgId),
          eq(contracts.id, contractId),
          inArray(contracts.status, [...CLOSEOUTABLE_CONTRACT_STATUSES]),
        ),
      )
      .returning({ id: contracts.id, solicitationId: contracts.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "CONTRACT_CLOSED_OUT",
      entityType: "contracts",
      entityId: contractId,
    });
    return row.solicitationId;
  });

  if (closedOut) revalidatePath(`/admin/solicitations/${closedOut}/subcontract`);
}

/**
 * §3.2 baseline audit: milestone_status IN_PROGRESS had no writer — contract_milestones rows sit at the
 * PENDING column default forever (draftSubcontract never sets anything else, and there is no UPDATE on
 * this table anywhere else in the codebase). The admin records that work on this milestone has started.
 */
export async function startMilestone(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const milestoneId = readId(formData, "milestoneId");

  const started = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contractMilestones)
      .set({ status: "IN_PROGRESS" })
      .where(
        and(
          eq(contractMilestones.orgId, orgId),
          eq(contractMilestones.id, milestoneId),
          inArray(contractMilestones.status, [...STARTABLE_MILESTONE_STATUSES]),
        ),
      )
      .returning({ id: contractMilestones.id, contractId: contractMilestones.contractId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "MILESTONE_STARTED",
      entityType: "contract_milestones",
      entityId: milestoneId,
    });
    const [contract] = await tx
      .select({ solicitationId: contracts.solicitationId })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, row.contractId)))
      .limit(1);
    return contract?.solicitationId ?? null;
  });

  if (started) revalidatePath(`/admin/solicitations/${started}/subcontract`);
}

/**
 * §3.2 baseline audit: milestone_status COMPLETED (the admin-reachable arm — INVOICED/PAID belong to the
 * §3.3 finance flow) had no writer. The admin records the milestone's work is finished.
 */
export async function completeMilestone(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const milestoneId = readId(formData, "milestoneId");

  const completed = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contractMilestones)
      .set({ status: "COMPLETED" })
      .where(
        and(
          eq(contractMilestones.orgId, orgId),
          eq(contractMilestones.id, milestoneId),
          inArray(contractMilestones.status, [...COMPLETABLE_MILESTONE_STATUSES]),
        ),
      )
      .returning({ id: contractMilestones.id, contractId: contractMilestones.contractId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "MILESTONE_COMPLETED",
      entityType: "contract_milestones",
      entityId: milestoneId,
    });
    const [contract] = await tx
      .select({ solicitationId: contracts.solicitationId })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, row.contractId)))
      .limit(1);
    return contract?.solicitationId ?? null;
  });

  if (completed) revalidatePath(`/admin/solicitations/${completed}/subcontract`);
}
