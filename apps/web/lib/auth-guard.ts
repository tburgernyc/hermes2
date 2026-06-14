/**
 * The trust boundary. Every Server Action and Route Handler that reads or mutates tenant data must
 * start by calling one of these guards — they re-check the session server-side and never trust a
 * client-supplied role, orgId, or userId (CLAUDE.md §7). Lives in apps/web because it calls auth().
 */
import type { Session } from "next-auth";

import { AuthError } from "@hermes/core";

import { auth } from "@/auth";

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError(401, "Not authenticated");
  return session;
}

/** Admin role AND a satisfied TOTP factor, or 403. Use on every /admin action. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new AuthError(403, "Admin access required");
  if (!session.user.totpVerified) throw new AuthError(403, "Two-factor verification required");
  return session;
}

/** Vendor role, or 403. Use on every /portal action. */
export async function requireVendor(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "vendor") throw new AuthError(403, "Vendor access required");
  return session;
}

/** Tenant isolation: throws unless the row's orgId matches the session's. */
export function assertSameOrg(session: Session, rowOrgId: string): void {
  if (session.user.orgId !== rowOrgId) throw new AuthError(403, "Cross-tenant access denied");
}

export function tenantId(session: Session): string {
  return session.user.orgId;
}
