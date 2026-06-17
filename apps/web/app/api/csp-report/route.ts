/**
 * CSP violation report sink (best-effort, never blocks). Browsers POST violation reports here via the
 * CSP `report-uri` (see lib/security-headers.ts buildCsp). We log server-side — Sentry's console
 * integration forwards it — so the policy can be tuned post-launch. Unauthenticated + IP-throttled;
 * content-type-gated + control-char-stripped (no log injection); never throws; always returns quickly.
 */
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Browsers emit one report per blocked resource, so a single page load can burst many. Set well above the
// auth throttles so a legitimate burst is not dropped, but still bounded against abuse.
const CSP_REPORT_MAX_PER_MIN = 120;

export async function POST(req: Request): Promise<Response> {
  // Browsers always send a CSP-report content-type; reject anything else — closes the log-injection
  // surface to non-browser callers entirely.
  const contentType = req.headers.get("content-type") ?? "";
  if (!/csp-report|reports\+json|application\/json/i.test(contentType)) {
    return new Response(null, { status: 415 });
  }
  if (
    !rateLimit(
      clientKey(req.headers.get("fly-client-ip"), req.headers.get("x-forwarded-for"), "csp-report"),
      { maxHits: CSP_REPORT_MAX_PER_MIN },
    )
  ) {
    return new Response(null, { status: 429 });
  }
  try {
    const body = await req.text();
    // Strip control chars so an attacker-crafted body cannot inject fake lines into the server log stream.
    if (body) console.warn("[csp-report]", body.slice(0, 2000).replace(/[\r\n\t]+/g, " "));
  } catch {
    // Ignore malformed/oversized report bodies — reporting must never error.
  }
  return new Response(null, { status: 204 });
}
