"use server";

/**
 * Prospect decision actions: manual add + qualify. Admin-only (requireAdmin), org-scoped, audited.
 * A manually-added prospect is a TRUSTED admin write (prospect_source = MANUAL) — distinct from the
 * low-trust tokenized public submission path, which can only ever write a prospect-scoped row via the
 * hermes_token role. Marking a prospect QUALIFIED feeds the vendor promotion flow (/admin/vendors).
 */
import { revalidatePath } from "next/cache";

import { and, eq, inArray, outreachCampaigns, vendorProspects, withOrg } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";
import {
  BOUNCEABLE_OUTREACH_STATUSES,
  DECLINABLE_PROSPECT_STATUSES,
  QUALIFIABLE_PROSPECT_STATUSES,
  RESPONDABLE_PROSPECT_STATUSES,
} from "@/lib/admin-board";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAICS_RE = /^[0-9]{6}$/;
const MAX_NAME = 200;
const MAX_CAPS = 5000;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

/** Parse a comma/space-separated NAICS list, keeping only well-formed 6-digit codes. */
function parseNaics(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => NAICS_RE.test(s));
}

/**
 * Manually add a prospect (trusted admin write). Validates at the boundary: company name required and
 * length-capped; email optional but format-checked; NAICS filtered to 6-digit codes; capability text
 * length-capped. The prospect starts NEW so it flows through the normal screen → qualify → promote path.
 */
export async function addProspect(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;

  const companyName = String(formData.get("companyName") ?? "").trim();
  if (companyName.length === 0 || companyName.length > MAX_NAME) {
    throw new Error("Company name is required (max 200 chars)");
  }
  const emailRaw = String(formData.get("contactEmail") ?? "").trim();
  if (emailRaw.length > 0 && !EMAIL_RE.test(emailRaw)) throw new Error("Invalid contact email");
  const contactEmail = emailRaw.length > 0 ? emailRaw : null;
  const naicsCodes = parseNaics(String(formData.get("naicsCodes") ?? ""));
  const capsRaw = String(formData.get("capabilitiesText") ?? "").trim();
  const capabilitiesText = capsRaw.length > 0 ? capsRaw.slice(0, MAX_CAPS) : null;

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .insert(vendorProspects)
      .values({
        orgId,
        companyName,
        contactEmail,
        naicsCodes,
        capabilitiesText,
        prospectSource: "MANUAL",
        status: "NEW",
      })
      // Bare ON CONFLICT DO NOTHING (no target): the dedupe index is the FUNCTIONAL partial index
      // vendor_prospects_email_key ON (org_id, lower(contact_email)) WHERE contact_email IS NOT NULL,
      // which a column-list target cannot name — so we suppress on any conflict. A repeat add with the
      // same email is a no-op; an email-less prospect is intentionally never deduped (null ∉ the index).
      .onConflictDoNothing()
      .returning({ id: vendorProspects.id });
    const created = rows[0];
    if (!created) return; // duplicate email — no-op
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROSPECT_ADDED",
      entityType: "vendor_prospects",
      entityId: created.id,
      after: { companyName, source: "MANUAL" },
    });
  });

  revalidatePath("/admin/prospects");
}

/** Mark a prospect QUALIFIED so an admin can promote it to a vetted vendor (/admin/vendors). */
export async function markProspectQualified(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const prospectId = readId(formData, "prospectId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(vendorProspects)
      .set({ status: "QUALIFIED" })
      // Only an active, not-yet-terminal prospect can be qualified (shared list — see admin-board).
      .where(
        and(
          eq(vendorProspects.orgId, orgId),
          eq(vendorProspects.id, prospectId),
          inArray(vendorProspects.status, [...QUALIFIABLE_PROSPECT_STATUSES]),
        ),
      )
      .returning({ id: vendorProspects.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROSPECT_QUALIFIED",
      entityType: "vendor_prospects",
      entityId: prospectId,
    });
  });

  revalidatePath("/admin/prospects");
}

/**
 * §3.2 baseline audit: log that a contacted prospect replied (CONTACTED → RESPONDED). A reply usually
 * arrives outside the system (phone/email), so this is the admin recording a fact they observed — not an
 * automated inbox scan. Closes a gap: RESPONDED was already accepted as a valid QUALIFY source status, and
 * the discovery/outreach-eligibility filters already treat it correctly, but nothing ever SET it.
 */
export async function markProspectResponded(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const prospectId = readId(formData, "prospectId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(vendorProspects)
      .set({ status: "RESPONDED" })
      .where(
        and(
          eq(vendorProspects.orgId, orgId),
          eq(vendorProspects.id, prospectId),
          inArray(vendorProspects.status, [...RESPONDABLE_PROSPECT_STATUSES]),
        ),
      )
      .returning({ id: vendorProspects.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROSPECT_RESPONDED",
      entityType: "vendor_prospects",
      entityId: prospectId,
    });
  });

  revalidatePath("/admin/prospects");
}

/**
 * §3.2 baseline audit: record that a prospect explicitly declined (any active status → DECLINED, terminal).
 * Closes a gap: DECLINED was a defined prospect_status with no writer — the only prior way to stop tracking
 * a prospect was the unrelated OPTED_OUT (a public token action, never an admin decision). A human decision
 * only; never inferred from AI scoring (CLAUDE.md §2).
 */
export async function markProspectDeclined(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const prospectId = readId(formData, "prospectId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(vendorProspects)
      .set({ status: "DECLINED" })
      .where(
        and(
          eq(vendorProspects.orgId, orgId),
          eq(vendorProspects.id, prospectId),
          inArray(vendorProspects.status, [...DECLINABLE_PROSPECT_STATUSES]),
        ),
      )
      .returning({ id: vendorProspects.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROSPECT_DECLINED",
      entityType: "vendor_prospects",
      entityId: prospectId,
    });
  });

  revalidatePath("/admin/prospects");
}

/**
 * §3.2 baseline audit: outreach_status BOUNCED had no writer — no bounce ingestion exists anywhere in the
 * codebase. The operator sees a bounce in their OWN inbox (a Resend delivery-failure notice for the SENT
 * campaign) and records it here; a human observing an external fact, never inferred. Recording a bounce
 * sends nothing (CLAUDE.md §2). Automated Resend-webhook ingestion is future work, not built here.
 */
export async function recordOutreachBounced(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const outreachId = readId(formData, "outreachId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(outreachCampaigns)
      .set({ status: "BOUNCED" })
      .where(
        and(
          eq(outreachCampaigns.orgId, orgId),
          eq(outreachCampaigns.id, outreachId),
          inArray(outreachCampaigns.status, [...BOUNCEABLE_OUTREACH_STATUSES]),
        ),
      )
      .returning({ id: outreachCampaigns.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "OUTREACH_BOUNCED",
      entityType: "outreach_campaigns",
      entityId: outreachId,
    });
  });

  revalidatePath("/admin/prospects");
}
