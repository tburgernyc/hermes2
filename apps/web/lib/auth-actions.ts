"use server";

import { signOut } from "@/auth";

/**
 * Sign the current operator/vendor out and return them to the unified login.
 *
 * This is a Server Action (a same-origin POST with Next's built-in CSRF token) — the idiomatic
 * realization of "sign out POSTs, then redirects to /login": it never runs on a GET/navigation, so a
 * cross-site or prefetched link can't terminate a session. It delegates to next-auth's `signOut`, which
 * clears the session cookie and throws the redirect to `/login`. Rendering a page never calls this;
 * only the explicit "Sign out" control in the console chrome does (Prime Directive §2 — no implicit
 * state change).
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
