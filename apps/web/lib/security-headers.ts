/**
 * Centralized security-header + CSP construction (CLAUDE.md §7). EDGE-SAFE by design: pure strings +
 * Web Crypto only (no Buffer, no Node APIs) so middleware.ts can import it in the edge runtime.
 *
 * Where each header is applied (see middleware.ts + next.config.ts) and WHY the split:
 *   • PROTOCOL-INDEPENDENT static headers (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy,
 *     COOP, DNS-prefetch) are applied GLOBALLY in next.config.ts headers() so they also cover /api and
 *     static assets that bypass the middleware matcher.
 *   • HSTS is applied in next.config.ts BUT gated by a `has: x-forwarded-proto=https` condition — it must
 *     never be asserted over the plaintext http that the e2e / `next start` server uses (the browser would
 *     then refuse http://localhost). The Fly proxy stamps x-forwarded-proto=https in production.
 *   • The CSP is applied in middleware.ts because it carries a PER-REQUEST nonce (next.config headers are
 *     static and cannot). `upgrade-insecure-requests` is likewise gated to https only.
 */

// Hosts the BROWSER legitimately connects to. Server-only providers (Anthropic / Resend / Voyage / SAM)
// are NEVER listed — they are called from the server and must not appear in a client-facing CSP
// (CLAUDE.md §4 billing/secret separation).
const TIGRIS_HOST = "https://fly.storage.tigris.dev"; // signed-URL document previews
// Sentry browser SDK ingestion. Modern DSNs are REGIONAL (oXXX.ingest.us.sentry.io / .de.sentry.io); a CSP
// wildcard matches only ONE label, so the regional hosts must be listed explicitly (legacy kept too).
const SENTRY_INGEST =
  "https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io";

/** Deny-by-default Permissions-Policy: no page needs these powerful features. */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

/** HSTS: 1 year + subdomains. NO `preload` until the operator opts in (preload is hard to undo). */
export const HSTS_VALUE = "max-age=31536000; includeSubDomains";

/** The protocol-independent header set applied to every response via next.config.ts headers(). */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // legacy clickjacking guard; CSP frame-ancestors is the modern one
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/** base64 nonce from 16 cryptographically-random bytes. `getRandomValues` + `btoa` are edge-safe. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** True when the request reached us over https (Fly proxy sets x-forwarded-proto; fallback to the URL). */
export function isHttpsRequest(forwardedProto: string | null, urlProtocol: string): boolean {
  return forwardedProto === "https" || urlProtocol === "https:";
}

/**
 * Build the Content-Security-Policy header value for one request.
 *
 * script-src: strict — ONLY Next's framework scripts (which carry this per-request nonce) and the chunks
 * they load (strict-dynamic) may execute. 'self' is the CSP2 fallback for browsers that ignore
 * strict-dynamic. NO 'unsafe-inline' / 'unsafe-eval' — this is the high-value XSS control.
 *
 * style-src: MUST allow 'unsafe-inline' — admin/portal/token pages render inline `style={}` (React style
 * attributes) which CSP governs and which cannot carry a nonce. Style injection is far lower risk than
 * script injection and all untrusted text is JSX-autoescaped. (A nonce in style-src would DISABLE
 * 'unsafe-inline', so it is deliberately omitted.)
 */
export function buildCsp(nonce: string, isHttps: boolean): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: ${TIGRIS_HOST}`,
    `font-src 'self'`,
    `connect-src 'self' ${TIGRIS_HOST} ${SENTRY_INGEST}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
  ];
  if (isHttps) directives.push("upgrade-insecure-requests");
  directives.push("report-uri /api/csp-report");
  return directives.join("; ");
}
