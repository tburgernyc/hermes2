import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "./auth.config";

// Edge-safe instance: authConfig has no DB/argon2/otplib imports, so this runs in the edge runtime.
const { auth } = NextAuth(authConfig);

/**
 * Route protection (CLAUDE.md §7): /admin/** requires an admin with a satisfied TOTP factor;
 * /portal/** requires a vendor. The redirects steer an admin through enrollment → step-up as needed.
 */
export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const session = req.auth;

  if (!session?.user) {
    const login = new URL("/login", nextUrl);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  const { role, totpVerified, totpEnrolled } = session.user;

  // /dashboard is the post-login router (a server component that redirects by role).
  if (pathname === "/dashboard") return NextResponse.next();

  if (pathname.startsWith("/admin")) {
    if (role !== "admin") return NextResponse.redirect(new URL("/portal", nextUrl));
    // The TOTP pages themselves must stay reachable so the admin can complete the factor.
    if (pathname.startsWith("/admin/totp")) return NextResponse.next();
    if (!totpEnrolled) return NextResponse.redirect(new URL("/admin/totp/enroll", nextUrl));
    if (!totpVerified) return NextResponse.redirect(new URL("/admin/totp", nextUrl));
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal")) {
    if (role !== "vendor") return NextResponse.redirect(new URL("/admin", nextUrl));
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/dashboard"],
};
