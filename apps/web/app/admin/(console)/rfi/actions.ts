"use server";

/**
 * §3.8.1 sources-sought/RFI capture-track actions. Every action re-checks the admin session
 * (requireAdmin → role + satisfied TOTP), and RFI-track transitions are ADMIN actions (human-gated),
 * mirroring the existing solicitation action pattern (CLAUDE.md §2). requestCapabilityStatementDraft is
 * the ONLY action that touches the model — it records the human's click as a durable audit row (the
 * gate), then emits the Inngest event that runs the drafting workflow; the actual RECEIVED →
 * CAPABILITY_DRAFTED transition happens inside that workflow, never here. The remaining three actions are
 * pure human recordings (no model, no outbound send) and call straight into @hermes/inngest's logic
 * (kept there, not duplicated here, so they share the same DB-backed test coverage as every other
 * RFI-track transition).
 */
import { revalidatePath } from "next/cache";

import { and, eq, solicitations, withOrg } from "@hermes/db";
import {
  closeApprovedRfiNoAction,
  convertApprovedRfiToPursuit,
  inngest,
  recordApprovedRfiResponseSubmitted,
  writeAudit,
} from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

function revalidateRfi(solicitationId: string): void {
  revalidatePath("/admin/rfi");
  revalidatePath(`/admin/rfi/${solicitationId}`);
}

/**
 * Request an AI-drafted capability-statement RESPONSE for a RECEIVED sources-sought/RFI notice. The click
 * itself is the human gate: it durably records the request as an audit row (only THEN emits the event),
 * mirroring approveSourcing. The actual drafting + RECEIVED → CAPABILITY_DRAFTED transition happens in the
 * Inngest workflow (draftRfiCapabilityStatement), never synchronously here.
 */
export async function requestCapabilityStatementDraft(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const solicitationId = readId(formData, "solicitationId");

  const requested = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({ id: solicitations.id })
      .from(solicitations)
      .where(
        and(
          eq(solicitations.orgId, orgId),
          eq(solicitations.id, solicitationId),
          eq(solicitations.rfiTrackStatus, "RECEIVED"),
        ),
      )
      .limit(1);
    if (rows.length === 0) return false;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "RFI_CAPABILITY_STATEMENT_REQUESTED",
      entityType: "solicitations",
      entityId: solicitationId,
    });
    return true;
  });

  if (requested) {
    try {
      await inngest.send({
        name: "hermes/rfi.capability-statement.requested",
        data: { orgId, solicitationId, requestedBy: userId },
      });
    } catch (err) {
      // Best-effort, OUTSIDE the committed audit (mirrors approveSourcing/selectQuote): the human request
      // already committed; a transient Inngest outage must never fail the admin's click.
      try {
        await withOrg(orgId, (tx) =>
          writeAudit(tx, {
            orgId,
            actorType: "SYSTEM",
            action: "RFI_CAPABILITY_STATEMENT_REQUEST_EMIT_FAILED",
            entityType: "solicitations",
            entityId: solicitationId,
            after: { error: err instanceof Error ? err.message : String(err) },
          }),
        );
      } catch {
        // never let the failover throw
      }
    }
  }
  revalidateRfi(solicitationId);
}

/** Record that a human submitted the sources-sought/RFI response (pure recording — no model, no send). */
export async function recordResponseSubmitted(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const solicitationId = readId(formData, "solicitationId");
  await recordApprovedRfiResponseSubmitted(orgId, solicitationId, session.user.id, session.user.email ?? null);
  revalidateRfi(solicitationId);
}

/** Close an RFI-track pursuit with no further action (terminal — a human decision, never automatic). */
export async function closeNoAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const solicitationId = readId(formData, "solicitationId");
  await closeApprovedRfiNoAction(orgId, solicitationId, session.user.id, session.user.email ?? null);
  revalidateRfi(solicitationId);
}

/**
 * Convert to a tracked pursuit: creates a NEW, ordinary bid/award-track solicitation row linked via
 * converted_from_solicitation_id, and flips this row's rfi_track_status to CONVERTED. The new pursuit
 * enters the normal spine from PENDING_TRIAGE — it is never fast-tracked past triage/sourcing/award.
 */
export async function convertToPursuit(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const solicitationId = readId(formData, "solicitationId");
  await convertApprovedRfiToPursuit(orgId, solicitationId, session.user.id, session.user.email ?? null);
  revalidateRfi(solicitationId);
}
