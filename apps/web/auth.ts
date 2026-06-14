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
      async authorize(credentials) {
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
