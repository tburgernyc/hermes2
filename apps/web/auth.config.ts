import type { NextAuthConfig } from "next-auth";
import type { Role } from "@hermes/core";

/**
 * The custom claims we put on the JWT. Used as an explicit view of `token` in both callbacks — the
 * `next-auth/jwt` module augmentation does not reliably apply under this beta + bundler resolution, so
 * we read/write claims through this type instead of relying on the ambient JWT shape.
 */
export interface TokenClaims {
  id?: string;
  orgId?: string;
  role?: Role;
  /** Server-resolved link to a vetted vendor (vendor portal). Set ONLY from the DB, never the client. */
  vendorId?: string | null;
  totpVerified?: boolean;
  totpEnrolled?: boolean;
}

/**
 * Edge-safe Auth.js config shared by the Node `auth.ts` and the middleware. It must NOT import the DB,
 * argon2, or otplib (those break the edge runtime). The `session` callback only maps the already-signed
 * JWT claims onto the session; the Credentials provider and the DB-touching `jwt` callback live in
 * auth.ts and run only in the Node runtime.
 */
export default {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      const claims = token as TokenClaims;
      if (claims.id) {
        session.user.id = claims.id;
        session.user.orgId = claims.orgId ?? "";
        session.user.role = claims.role ?? "vendor";
        session.user.vendorId = claims.vendorId ?? null;
        session.user.totpVerified = Boolean(claims.totpVerified);
        session.user.totpEnrolled = Boolean(claims.totpEnrolled);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
