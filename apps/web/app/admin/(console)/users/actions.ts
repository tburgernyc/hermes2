"use server";

/**
 * §3.6 admin-role assignment — the SETTINGS-domain surface that lets a FULL admin "hire a proposal writer"
 * (CAPTURE) or "hire a bookkeeper" (FINANCE) without granting full access. FULL-only (requireFullAdmin):
 * the ability to grant/narrow admin access is itself a privilege-management action, at least as sensitive
 * as `orgs.directives`. Every write re-scopes to `role = 'ADMIN'` in the caller's own org (a VENDOR row can
 * never carry an admin_role — the users_vendor_no_admin_role DB CHECK is the final backstop) and is audited.
 * The affected admin's own session picks up the change on their next login or TOTP-refresh session update
 * (see auth.ts) — not instantly mid-request, matching the codebase's existing vendorId claim-freshness
 * pattern (Phase 6 PR C).
 */
import { revalidatePath } from "next/cache";

import { and, eq, users, withOrg } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireFullAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_ROLE_VALUES = ["FULL", "CAPTURE", "FINANCE"] as const;
type AdminRoleValue = (typeof ADMIN_ROLE_VALUES)[number];

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

/** Change a target ADMIN user's admin_role. No-op if the target isn't an ADMIN in this org, or is already
 *  at the requested level (never writes/audits a non-change). */
export async function updateAdminRole(formData: FormData): Promise<void> {
  const session = await requireFullAdmin();
  const orgId = session.user.orgId;
  const actorId = session.user.id;
  const targetUserId = readId(formData, "userId");

  const nextRoleRaw = String(formData.get("adminRole") ?? "");
  if (!(ADMIN_ROLE_VALUES as readonly string[]).includes(nextRoleRaw)) {
    throw new Error("Invalid admin role");
  }
  const nextRole = nextRoleRaw as AdminRoleValue;

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({ id: users.id, adminRole: users.adminRole })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.id, targetUserId), eq(users.role, "ADMIN")))
      .limit(1);
    const target = rows[0];
    if (!target) return; // not an admin in this org — no-op
    if (target.adminRole === nextRole) return; // already at that level — no-op

    await tx
      .update(users)
      .set({ adminRole: nextRole })
      .where(and(eq(users.orgId, orgId), eq(users.id, targetUserId)));

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: actorId,
      actorEmail: session.user.email ?? null,
      action: "ADMIN_ROLE_UPDATED",
      entityType: "users",
      entityId: targetUserId,
      before: { adminRole: target.adminRole },
      after: { adminRole: nextRole },
    });
  });

  revalidatePath("/admin/users");
}
