import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "./auth.config";
import { domainForPath, isAdminDomainAllowed } from "./lib/admin-domains";
import { buildCsp, generateNonce, isHttpsRequest } from "./lib/security-headers";

// Edge-safe instance: authConfig has no DB/argon2/otplib imports, so this runs in the edge runtime.
const { auth } = NextAuth(authConfig);

/**
 * Two responsibilities on every matched (HTML) request:
 *
 *  1. CSP (CLAUDE.md §7) — attach a per-request nonce'd Content-Security-Policy. The nonce is propagated
 *     to Next via a REQUEST header so the framework's inline scripts inherit it (strict-dynamic then
 *     covers the chunks they load). Because the nonce is per-request, the matcher deliberately spans ALL
 *     HTML routes — the public marketing/token pages that bypassed the old auth-only matcher now get the
 *     CSP too. The protocol-independent headers (nosniff, frame-options, …) + HSTS come from
 *     next.config.ts headers(); see lib/security-headers.ts for why the work is split.
 *
 *  2. Route protection — /admin/** requires an admin with a satisfied TOTP factor; /portal/** requires a
 *     vendor; both redirect through enrollment/step-up as needed. Public routes simply pass through with
 *     the CSP attached.
 */
const PROTECTED = (pathname: string): boolean =>
  pathname === "/dashboard" || pathname.startsWith("/admin") || pathname.startsWith("/portal");

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const session = req.auth;

  const nonce = generateNonce();
  const https = isHttpsRequest(req.headers.get("x-forwarded-proto"), nextUrl.protocol);
  const csp = buildCsp(nonce, https);

  // Attach the CSP to whatever response we return (redirect or pass-through).
  const decorate = (res: NextResponse): NextResponse => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  // Auth gate — only the protected prefixes redirect; everything else falls through to pass-through.
  if (PROTECTED(pathname)) {
    if (!session?.user) {
      const login = new URL("/login", nextUrl);
      login.searchParams.set("callbackUrl", pathname);
      return decorate(NextResponse.redirect(login));
    }
    const { role, totpVerified, totpEnrolled, adminRole } = session.user;

    if (pathname.startsWith("/admin")) {
      if (role !== "admin") return decorate(NextResponse.redirect(new URL("/portal", nextUrl)));
      // The TOTP pages themselves must stay reachable so the admin can complete the factor.
      if (!pathname.startsWith("/admin/totp")) {
        if (!totpEnrolled) return decorate(NextResponse.redirect(new URL("/admin/totp/enroll", nextUrl)));
        if (!totpVerified) return decorate(NextResponse.redirect(new URL("/admin/totp", nextUrl)));
        // §3.6 granular admin roles: FULL is unchanged (reaches everything below, exactly as before this
        // feature shipped). CAPTURE/FINANCE are gated to their own domain — the dashboard and audit log
        // stay OPEN to every admin level. This is the PRIMARY, server-side enforcement layer (redirect,
        // never a hidden nav link); requireAdminDomain in each page/action is the second, defense-in-depth
        // layer for the same decision (lib/admin-domains.ts is the single source both read). Session-claim
        // based — no DB hit per request; a role change takes effect on the admin's next login or TOTP-
        // refresh session update (see auth.ts).
        const domain = domainForPath(pathname);
        if (!isAdminDomainAllowed(adminRole, domain)) {
          const denied = new URL("/admin", nextUrl);
          denied.searchParams.set("denied", domain.toLowerCase());
          return decorate(NextResponse.redirect(denied));
        }
      }
    } else if (pathname.startsWith("/portal")) {
      if (role !== "vendor") return decorate(NextResponse.redirect(new URL("/admin", nextUrl)));
    }
    // /dashboard (the post-login role router) with a session falls through to pass-through.
  }

  // Pass-through: propagate the nonce + CSP to the request so Next stamps its inline scripts with it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  return decorate(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
  // All routes EXCEPT /api, Next internals, and static assets (which need neither the auth gate nor a
  // nonce'd CSP). /api + static still receive the protocol-independent headers + HSTS via next.config.ts.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.svg|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)).*)",
  ],
};
