/**
 * packages/core/src/auth-guard.ts
 *
 * The trust boundary. EVERY Server Action and Route Handler that mutates or reads tenant data must start
 * by calling one of these guards. They re-check the session server-side — never trust a client-supplied
 * role, orgId, userId, or vendorId.
 *
 * v1 audit lessons encoded here:
 *  - distinct trust roles (admin vs vendor), enforced server-side
 *  - admin actions also require a satisfied TOTP factor
 *  - tenant isolation: data access is scoped to the session's orgId; cross-tenant access throws
 *  - DB-backed login lockout
 *
 * Assumes Auth.js v5 `auth()` whose session callback populates user.{id, orgId, role, totpVerified}.
 * Wiring that callback is the Phase 2 prompt's job; this module is what the rest of the app calls.
 */
import { auth } from "@/auth"; // Auth.js v5 helper
import { db } from "@hermes/db";
import { users } from "@hermes/db/schema";
import { eq } from "drizzle-orm";

export type Role = "admin" | "vendor";

export interface Session {
  user: { id: string; orgId: string; role: Role; totpVerified?: boolean };
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Authenticated session or 401. */
export async function requireSession(): Promise<Session> {
  const session = (await auth()) as Session | null;
  if (!session?.user?.id) throw new AuthError(401, "Not authenticated");
  return session;
}

/** Admin role AND a satisfied TOTP factor, or 403. Use on every /admin action. */
export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.user.role !== "admin") throw new AuthError(403, "Admin access required");
  if (!s.user.totpVerified) throw new AuthError(403, "Two-factor verification required");
  return s;
}

/** Vendor role, or 403. Use on every /portal action. */
export async function requireVendor(): Promise<Session> {
  const s = await requireSession();
  if (s.user.role !== "vendor") throw new AuthError(403, "Vendor access required");
  return s;
}

/**
 * Tenant isolation. Pass the orgId attached to any row you're about to read/write; throws on mismatch.
 * Pair this with a query layer that always filters by orgId — never rely on app checks alone; enforce
 * Postgres RLS too where possible.
 */
export function assertSameOrg(session: Session, rowOrgId: string): void {
  if (session.user.orgId !== rowOrgId) throw new AuthError(403, "Cross-tenant access denied");
}

/** The tenant id to scope every query by. */
export function tenantId(session: Session): string {
  return session.user.orgId;
}

/* ------------------------------------------------------------------ */
/* Login lockout (DB-backed)                                           */
/* ------------------------------------------------------------------ */

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function isLockedOut(userId: string): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return !!u?.lockedUntil && u.lockedUntil > new Date();
}

export async function recordFailedLogin(userId: string): Promise<void> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return;
  const count = (u.failedLoginCount ?? 0) + 1;
  await db
    .update(users)
    .set({
      failedLoginCount: count,
      lockedUntil: count >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : u.lockedUntil,
    })
    .where(eq(users.id, userId));
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, userId));
}

/* ------------------------------------------------------------------ */
/* NOTE on Route Handlers vs Server Actions                            */
/* Next.js Server Actions carry built-in CSRF protection. Custom Route */
/* Handlers (e.g., /api/*) do NOT — enforce same-origin and/or require */
/* a server-minted token there. Never accept a client-set identity.    */
/* ------------------------------------------------------------------ */
