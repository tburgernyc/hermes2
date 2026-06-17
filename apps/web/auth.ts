import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  clearFailedLogins,
  decryptSecret,
  findAuthUserByEmail,
  getAuthUserById,
  isLockedOut,
  recordFailedLogin,
  toRole,
  verifyPassword,
  verifyTotpCode,
} from "@hermes/core";

import authConfig, { type TokenClaims } from "./auth.config";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** HTTP-layer login throttle: max attempts per IP per minute (distinct from the per-account DB lockout). */
const LOGIN_MAX_PER_MIN = 10;

/** Payload accepted by `unstable_update` for the TOTP step-up / enrollment flow. */
interface TotpUpdate {
  totpCode?: string;
  refreshEnrollment?: boolean;
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        // HTTP-layer per-IP throttle BEFORE any DB work — covers BOTH the login Server Action and a direct
        // POST to /api/auth/callback/credentials (both funnel through here). Distinct from the per-account
        // DB lockout below. A throttled attempt returns null — indistinguishable from a bad credential, so
        // it leaks no oracle (CLAUDE.md §7). Fail-OPEN if the request/headers are unavailable (auth still
        // requires valid creds + the DB lockout) — never fail closed and lock everyone out.
        // Only throttle when we have an edge-trusted client identifier. On Fly, Fly-Client-IP is ALWAYS
        // stamped, so production always throttles by real IP. Off-Fly (local/e2e/direct) both are absent —
        // a shared `login:unknown` bucket would throttle unrelated clients together while protecting
        // nothing, so we skip it there.
        const ip = request?.headers?.get("fly-client-ip") ?? null;
        const xff = request?.headers?.get("x-forwarded-for") ?? null;
        if ((ip || xff) && !rateLimit(clientKey(ip, xff, "login"), { maxHits: LOGIN_MAX_PER_MIN })) {
          return null;
        }

        const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await findAuthUserByEmail(email);
        if (!user || !user.isActive || !user.passwordHash) return null;
        if (await isLockedOut(user.id)) return null;

        const ok = await verifyPassword(user.passwordHash, password);
        if (!ok) {
          await recordFailedLogin(user.id);
          return null;
        }
        await clearFailedLogins(user.id);

        return {
          id: user.id,
          email: user.email,
          orgId: user.orgId,
          role: toRole(user.role),
          // Server-resolved from the DB link (users.vendor_id) — never client-supplied.
          vendorId: user.vendorId,
          totpEnrolled: user.totpEnrolledAt !== null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      const claims = token as TokenClaims;

      // Initial sign-in: stamp identity + reset the second-factor state.
      if (user) {
        claims.id = user.id;
        claims.orgId = user.orgId;
        claims.role = user.role;
        claims.vendorId = user.vendorId ?? null; // server-resolved link; null until an admin binds it
        claims.totpEnrolled = Boolean(user.totpEnrolled);
        claims.totpVerified = false;
      }

      // Step-up / enrollment: the ONLY path to totpVerified=true is a live code the SERVER verifies
      // against the stored secret. A client-supplied totpVerified is never trusted (Prime Directive §2).
      if (trigger === "update" && session && claims.id && claims.orgId) {
        const update = session as TotpUpdate;
        if (typeof update.totpCode === "string") {
          const u = await getAuthUserById(claims.orgId, claims.id);
          if (
            u?.totpSecretCiphertext &&
            verifyTotpCode(decryptSecret(u.totpSecretCiphertext), update.totpCode)
          ) {
            claims.totpVerified = true;
            claims.totpEnrolled = u.totpEnrolledAt !== null;
          }
        }
        if (update.refreshEnrollment) {
          const u = await getAuthUserById(claims.orgId, claims.id);
          claims.totpEnrolled = Boolean(u?.totpEnrolledAt);
          // Re-sync the vendor link too, so an admin-established link can propagate to a live session
          // (a triggered session refresh) without forcing a full re-login.
          claims.vendorId = u?.vendorId ?? null;
        }
      }

      return token;
    },
  },
});

/**
 * Typed wrapper over `unstable_update` for the TOTP step-up / enrollment flow. unstable_update is typed
 * for partial-session updates; this passes our own jwt-callback payload (read as TotpUpdate there).
 */
export async function updateTotp(payload: TotpUpdate): Promise<Session | null> {
  return unstable_update(payload as unknown as Session);
}
