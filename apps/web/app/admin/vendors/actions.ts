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
import type { Session } from "next-auth";
import { z } from "zod";

import { hashToken, mintToken, verifyToken } from "@hermes/core";
import {
  and,
  eq,
  isNull,
  users,
  vendorInvites,
  vendorProspects,
  vendors,
  withOrg,
} from "@hermes/db";
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

const INVITE_TTL_DAYS = 14;

const inviteEmailSchema = z.string().trim().toLowerCase().email().max(254);

/** Public base URL for the copyable /invite link (trailing slashes stripped). */
function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://burgergov.com").replace(/\/+$/, "");
}

/** useActionState result: the minted link is shown ONCE (we persist only its hash). */
interface InviteState {
  ok: boolean;
  link?: string;
  email?: string;
  error?: string;
}

/**
 * Mint a single-use VENDOR_INVITE onboarding link for a VETTED vendor (1 vendor : N users). The admin
 * click IS the §2 human action; delivery is COPY-LINK — zero automated outbound, so the action just
 * returns the link for the admin to send through their own channel. Only the token HASH + jti are
 * persisted (§7); the raw token is surfaced once here and never stored. useActionState-compatible.
 */
export async function inviteVendorUser(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  let session: Session;
  try {
    session = await requireAdmin();
  } catch {
    return { ok: false, error: "Your session is no longer authorized. Sign in again." };
  }
  const orgId = session.user.orgId;
  const adminId = session.user.id;

  let vendorId: string;
  let email: string;
  try {
    vendorId = readId(formData, "vendorId");
    email = inviteEmailSchema.parse(formData.get("email"));
  } catch {
    return { ok: false, error: "Select a vetted vendor and enter a valid email address." };
  }

  // Mint first (no DB), then read our own freshly-minted token for its jti/exp so the stored row and
  // the link agree exactly. vendorId/orgId come from the admin session, never a client-asserted value.
  const token = mintToken({ purpose: "VENDOR_INVITE", orgId, vendorId, ttlDays: INVITE_TTL_DAYS });
  const payload = verifyToken(token, "VENDOR_INVITE");

  try {
    await withOrg(orgId, async (tx) => {
      // A user can be invited onto a vendor only once it exists in THIS org and is VETTED.
      const vendorRows = await tx
        .select({ id: vendors.id })
        .from(vendors)
        .where(and(eq(vendors.orgId, orgId), eq(vendors.id, vendorId), eq(vendors.status, "VETTED")))
        .limit(1);
      if (vendorRows.length === 0) throw new Error("vendor not vetted");

      await tx.insert(vendorInvites).values({
        orgId,
        vendorId,
        invitedEmail: email,
        tokenHash: hashToken(token), // §7: store the hash, never the raw token
        tokenJti: payload.jti,
        expiresAt: new Date(payload.exp),
        createdBy: adminId,
      });

      await writeAudit(tx, {
        orgId,
        actorType: "ADMIN",
        actorUserId: adminId,
        actorEmail: session.user.email ?? null,
        action: "VENDOR_INVITE_CREATED",
        entityType: "vendors",
        entityId: vendorId,
      });
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message === "vendor not vetted"
        ? "That vendor is not vetted yet."
        : "Could not create the invite. Please try again.";
    return { ok: false, error: message };
  }

  revalidatePath("/admin/vendors");
  return { ok: true, link: `${appBaseUrl()}/invite/${token}`, email };
}
