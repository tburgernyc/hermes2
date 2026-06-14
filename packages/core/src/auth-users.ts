/**
 * DB-backed authentication queries.
 *
 * Pre-org login lookup + lockout writes run as the least-privilege `hermes_auth` role
 * (client.withAuthRole — cross-tenant read, lockout-only write), because login resolves a user by
 * email BEFORE any org context exists. Authenticated TOTP reads/writes run tenant-scoped as the app
 * role (client.withOrg) since the admin's org is known by then — and hermes_auth deliberately cannot
 * write the TOTP columns.
 */
import { users, withAuthRole, withOrg } from "@hermes/db";
import { eq, sql } from "drizzle-orm";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  passwordHash: string | null;
  role: "ADMIN" | "VENDOR";
  totpSecretCiphertext: string | null;
  totpEnrolledAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  isActive: boolean;
}

const AUTH_COLUMNS = {
  id: users.id,
  orgId: users.orgId,
  email: users.email,
  passwordHash: users.passwordHash,
  role: users.role,
  totpSecretCiphertext: users.totpSecretCiphertext,
  totpEnrolledAt: users.totpEnrolledAt,
  failedLoginCount: users.failedLoginCount,
  lockedUntil: users.lockedUntil,
  isActive: users.isActive,
} as const;

/** Pre-org login lookup by case-insensitive email. Cross-tenant by design (hermes_auth). */
export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  return withAuthRole(async (tx) => {
    const rows = await tx
      .select(AUTH_COLUMNS)
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return (rows[0] as AuthUser | undefined) ?? null;
  });
}

/** Authenticated read of one user within a known org (TOTP step-up / enrollment). */
export async function getAuthUserById(orgId: string, userId: string): Promise<AuthUser | null> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx.select(AUTH_COLUMNS).from(users).where(eq(users.id, userId)).limit(1);
    return (rows[0] as AuthUser | undefined) ?? null;
  });
}

export async function isLockedOut(userId: string): Promise<boolean> {
  return withAuthRole(async (tx) => {
    const rows = await tx
      .select({ lockedUntil: users.lockedUntil })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const lockedUntil = rows[0]?.lockedUntil ?? null;
    return lockedUntil !== null && lockedUntil > new Date();
  });
}

/** Increment the failure counter; lock for LOCK_MINUTES once it reaches MAX_FAILED (atomic). */
export async function recordFailedLogin(userId: string): Promise<void> {
  await withAuthRole(async (tx) => {
    await tx.execute(sql`
      UPDATE users
      SET failed_login_count = failed_login_count + 1,
          locked_until = CASE
            WHEN failed_login_count + 1 >= ${MAX_FAILED}
              THEN now() + make_interval(mins => ${LOCK_MINUTES})
            ELSE locked_until
          END
      WHERE id = ${userId}`);
  });
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await withAuthRole(async (tx) => {
    await tx.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, userId));
  });
}

/** Enrollment write (TOTP) — tenant-scoped as the app role on the admin's own org row. */
export async function setTotpSecretCiphertext(
  orgId: string,
  userId: string,
  ciphertext: string,
): Promise<void> {
  await withOrg(orgId, async (tx) => {
    await tx.update(users).set({ totpSecretCiphertext: ciphertext }).where(eq(users.id, userId));
  });
}

export async function markTotpEnrolled(orgId: string, userId: string): Promise<void> {
  await withOrg(orgId, async (tx) => {
    await tx.update(users).set({ totpEnrolledAt: new Date() }).where(eq(users.id, userId));
  });
}
