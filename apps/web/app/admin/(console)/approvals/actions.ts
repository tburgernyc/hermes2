"use server";

/**
 * The human-approval surface — and the ONLY place in the system that emits a human-gate event or sets a
 * `*_approved_by` column (CLAUDE.md §2 Prime Directive). Each action re-checks the admin session
 * server-side (requireAdmin → role + satisfied TOTP), records the approver + an audit row inside an
 * org-scoped transaction, and THEN emits the Inngest event that lets the durable workflow proceed. A cron,
 * a model, or any autonomous job cannot reach this code: it requires an authenticated admin request, and
 * Next.js Server Actions are same-origin/CSRF-protected by default.
 */
import { revalidatePath } from "next/cache";

import { and, eq, outreachCampaigns, solicitations, withOrg } from "@hermes/db";
import { inngest, writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

/** Approve sourcing for a triaged solicitation: record the approver, then start the discovery workflow. */
export async function approveSourcing(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const solicitationId = readId(formData, "solicitationId");

  const approved = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(solicitations)
      .set({
        status: "READY_FOR_SOURCING",
        sourcingApprovedBy: userId,
        sourcingApprovedAt: new Date(),
      })
      // Only a TRIAGE_COMPLETE solicitation can be approved — never re-advance one already in flight.
      .where(
        and(
          eq(solicitations.orgId, orgId),
          eq(solicitations.id, solicitationId),
          eq(solicitations.status, "TRIAGE_COMPLETE"),
        ),
      )
      .returning({ id: solicitations.id });
    if (rows.length === 0) return false;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "SOURCING_APPROVED",
      entityType: "solicitations",
      entityId: solicitationId,
    });
    return true;
  });

  if (approved) {
    await inngest.send({
      name: "hermes/sourcing.approved",
      data: { orgId, solicitationId, approvedBy: userId },
    });
  }
  revalidatePath("/admin/approvals");
}

/** Approve a drafted outreach campaign: record the approver, then release the parked send gate. */
export async function approveOutreach(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const outreachId = readId(formData, "outreachId");

  const approved = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(outreachCampaigns)
      .set({ status: "APPROVED", approvedBy: userId, approvedAt: new Date() })
      .where(
        and(
          eq(outreachCampaigns.orgId, orgId),
          eq(outreachCampaigns.id, outreachId),
          eq(outreachCampaigns.status, "PENDING_APPROVAL"),
        ),
      )
      .returning({ id: outreachCampaigns.id });
    if (rows.length === 0) return false;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "OUTREACH_APPROVED",
      entityType: "outreach_campaigns",
      entityId: outreachId,
    });
    return true;
  });

  if (approved) {
    // This is the event the durable gate is parked on. Only an admin reaches this line.
    await inngest.send({
      name: "hermes/outreach.approved",
      data: { orgId, outreachId, approvedBy: userId },
    });
  }
  revalidatePath("/admin/approvals");
}

/** Reject a drafted outreach campaign: cancel it (never sends) and notify the gate. */
export async function rejectOutreach(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const outreachId = readId(formData, "outreachId");

  const rejected = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(outreachCampaigns)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(outreachCampaigns.orgId, orgId),
          eq(outreachCampaigns.id, outreachId),
          eq(outreachCampaigns.status, "PENDING_APPROVAL"),
        ),
      )
      .returning({ id: outreachCampaigns.id });
    if (rows.length === 0) return false;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "OUTREACH_REJECTED",
      entityType: "outreach_campaigns",
      entityId: outreachId,
    });
    return true;
  });

  if (rejected) {
    await inngest.send({
      name: "hermes/outreach.rejected",
      data: { orgId, outreachId, rejectedBy: userId },
    });
  }
  revalidatePath("/admin/approvals");
}
