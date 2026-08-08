/**
 * The trust boundary. Every Server Action and Route Handler that reads or mutates tenant data must
 * start by calling one of these guards — they re-check the session server-side and never trust a
 * client-supplied role, orgId, or userId (CLAUDE.md §7). Lives in apps/web because it calls auth().
 */
import type { Session } from "next-auth";

import { AuthError } from "@hermes/core";

import { auth } from "@/auth";
import { isAdminDomainAllowed, type AdminDomain } from "@/lib/admin-domains";

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

/**
 * §3.6 granular admin roles — the guard primitive every /admin page and Server Action should call INSTEAD
 * of the bare `requireAdmin()` once it touches a domain narrower than "any admin" (dashboard/audit log
 * stay on plain `requireAdmin()` — they are OPEN). Re-checks admin + TOTP first (same as `requireAdmin`),
 * then denies with 403 unless the session's `admin_role` claim covers `domain` (FULL always does — see
 * `isAdminDomainAllowed` in lib/admin-domains.ts, the single source of truth middleware.ts also reads, so
 * a page can never be reachable past middleware's redirect only to be refused here, or vice versa). This
 * is the SERVER-SIDE boundary (CLAUDE.md §7) — never rely on hiding a nav link instead.
 *
 * The `admin_role` claim is session-based (no DB hit per request), stamped at login and re-synced on the
 * existing TOTP-refresh session trigger — the same freshness semantics `vendorId` already uses. A role
 * change made on /admin/users takes effect the next time the affected admin's session refreshes (their
 * next login, or their next TOTP step-up/enrollment refresh), not mid-session.
 */
export async function requireAdminDomain(domain: AdminDomain): Promise<Session> {
  const session = await requireAdmin();
  if (!isAdminDomainAllowed(session.user.adminRole, domain)) {
    throw new AuthError(403, `This admin account (${session.user.adminRole ?? "no level set"}) cannot access ${domain}.`);
  }
  return session;
}

/** FULL-only: `orgs.directives` / compliance settings + the admin-role-assignment surface itself. */
export const requireFullAdmin = (): Promise<Session> => requireAdminDomain("SETTINGS");

/** FULL or CAPTURE: solicitations/proposals/outreach/vendor-sourcing — never financial/payment records. */
export const requireCaptureAccess = (): Promise<Session> => requireAdminDomain("CAPTURE");

/** FULL or FINANCE: contracts/invoices/AR/timekeeping — never sourcing/outreach/proposal drafting. */
export const requireFinanceAccess = (): Promise<Session> => requireAdminDomain("FINANCE");

/** Vendor role, or 403. Use on the portal shell (pages that render for any vendor user). */
export async function requireVendor(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "vendor") throw new AuthError(403, "Vendor access required");
  return session;
}

/**
 * Vendor role AND a resolved vendor link, or 403 — the guard for every vendor-SCOPED read/write (the
 * logged-in quote path, "my quotes/contracts/documents"). A VENDOR-role user whose `vendorId` is null
 * is authenticated but not yet vetted/linked by an admin, and must NOT reach any vendor-scoped row.
 * The returned `vendorId` is server-resolved (from the session linkage) — pass it to withVendorRole,
 * never a client value (§7).
 */
export async function requireVendorWithVendorId(): Promise<{
  session: Session;
  vendorId: string;
}> {
  const session = await requireVendor();
  const vendorId = session.user.vendorId;
  if (!vendorId) throw new AuthError(403, "Vendor account is not yet linked");
  return { session, vendorId };
}

/** Tenant isolation: throws unless the row's orgId matches the session's. */
export function assertSameOrg(session: Session, rowOrgId: string): void {
  if (session.user.orgId !== rowOrgId) throw new AuthError(403, "Cross-tenant access denied");
}

export function tenantId(session: Session): string {
  return session.user.orgId;
}
