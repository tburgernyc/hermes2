"use server";

/**
 * Admin vendor-vetting actions — the §7 trust boundary for the users↔vendors linkage. The link from a
 * logged-in user to a vetted vendor can be established ONLY here: each action re-checks the admin session
 * (requireAdmin → role + satisfied TOTP), runs inside an org-scoped transaction (hermes_app RLS), and
 * writes an ADMIN audit row. A self-registered vendor user can never self-assert a vendor link — it must
 * be promoted/vetted/linked by an admin (mirrors the way a vendor row can only become VETTED with a
 * recorded vetter). This is the minimal action surface; the full vetting-queue UI is Phase 6.
 */
import { revalidatePath } from "next/cache";

import { and, eq, isNull, users, vendorProspects, vendors, withOrg } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

/**
 * Promote a prospect to a (PENDING_REVIEW) vendor: copy its identity, record the lineage
 * (promoted_from_prospect_id — unique per org), and flip the prospect to PROMOTED. No DB trigger does
 * the status flip, so we do it here in the same transaction.
 */
export async function promoteProspectToVendor(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const prospectId = readId(formData, "prospectId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        companyName: vendorProspects.companyName,
        contactEmail: vendorProspects.contactEmail,
        uei: vendorProspects.uei,
        capabilitiesText: vendorProspects.capabilitiesText,
      })
      .from(vendorProspects)
      // Only a not-yet-promoted prospect can be promoted (never re-promote one already PROMOTED).
      .where(
        and(
          eq(vendorProspects.orgId, orgId),
          eq(vendorProspects.id, prospectId),
          eq(vendorProspects.status, "QUALIFIED"),
        ),
      )
      .limit(1);
    const prospect = rows[0];
    if (!prospect) return; // not found or not in a promotable state — no-op (idempotent-ish)

    const inserted = await tx
      .insert(vendors)
      .values({
        orgId,
        promotedFromProspectId: prospectId, // 1:1 lineage (unique index blocks a double-promote)
        companyName: prospect.companyName,
        contactEmail: prospect.contactEmail,
        uei: prospect.uei,
        capabilitiesText: prospect.capabilitiesText,
        status: "PENDING_REVIEW",
      })
      .returning({ id: vendors.id });
    const vendorId = inserted[0]?.id;
    if (!vendorId) throw new Error("vendor insert returned no row");

    await tx
      .update(vendorProspects)
      .set({ status: "PROMOTED" })
      .where(and(eq(vendorProspects.orgId, orgId), eq(vendorProspects.id, prospectId)));

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "PROSPECT_PROMOTED",
      entityType: "vendors",
      entityId: vendorId,
    });
  });

  revalidatePath("/admin/vendors");
}

/** Mark a vendor VETTED: the DB CHECK requires a recorded vetter + timestamp, which we set here. */
export async function vetVendor(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const vendorId = readId(formData, "vendorId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(vendors)
      .set({ status: "VETTED", vettedBy: userId, vettedAt: new Date() })
      .where(
        and(
          eq(vendors.orgId, orgId),
          eq(vendors.id, vendorId),
          eq(vendors.status, "PENDING_REVIEW"),
        ),
      )
      .returning({ id: vendors.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "VENDOR_VETTED",
      entityType: "vendors",
      entityId: vendorId,
    });
  });

  revalidatePath("/admin/vendors");
}

/**
 * Bind a currently-UNLINKED VENDOR-role user to a vetted vendor (the linkage itself). The composite
 * (org_id, vendor_id) FK guarantees both rows are in this org; the WHERE role = 'VENDOR' keeps the
 * users_vendor_link_role CHECK satisfied (an admin row can never be vendor-bound); the WHERE
 * vendor_id IS NULL makes this a one-time binding — it will NEVER silently re-point an already-linked
 * user to a different vendor (re-linking, if ever needed, is a separate, explicitly-audited action).
 * vendorId/userId come only from the admin form, re-validated as UUIDs and re-scoped to the session org.
 */
export async function linkVendorUser(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const adminId = session.user.id;
  const targetUserId = readId(formData, "userId");
  const vendorId = readId(formData, "vendorId");

  await withOrg(orgId, async (tx) => {
    // The vendor must exist in this org and be VETTED before a user is bound to it.
    const vendorRows = await tx
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.orgId, orgId), eq(vendors.id, vendorId), eq(vendors.status, "VETTED")))
      .limit(1);
    if (vendorRows.length === 0) return;

    const rows = await tx
      .update(users)
      .set({ vendorId })
      // isNull(vendor_id): only an unlinked user can be bound — no silent overwrite of an existing link.
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.id, targetUserId),
          eq(users.role, "VENDOR"),
          isNull(users.vendorId),
        ),
      )
      .returning({ id: users.id });
    if (rows.length === 0) return;

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: adminId,
      actorEmail: session.user.email ?? null,
      action: "VENDOR_USER_LINKED",
      entityType: "users",
      entityId: targetUserId,
    });
  });

  revalidatePath("/admin/vendors");
}
