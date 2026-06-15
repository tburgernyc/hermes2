/**
 * Best-effort in-memory rate limiter for the PUBLIC tokenized routes (/quote, /optout), which have no
 * session to throttle by. This is a DoS speed-bump, not a security control: it is per-process (each Fly
 * Machine keeps its own counters), so it does not coordinate across instances. The real anti-abuse
 * guarantees are structural — the signed single-use token, the (org_id, token_jti) replay unique index,
 * and the RESTRICTIVE token RLS policy. Replace with a shared store (Redis/Upstash) if multi-instance
 * throttling is ever required (deferred — YAGNI).
 */
const WINDOW_MS = 60_000; // 1 minute
const MAX_HITS = 10; // per key per window

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true if the request is allowed; false if the key has exceeded MAX_HITS this window. */
export function rateLimit(key: string, now: number = Date.now()): boolean {
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= MAX_HITS) return false;
  buckets.set(key, { count: existing.count + 1, resetAt: existing.resetAt });
  return true;
}

/**
 * Coarse client identifier from proxy headers; never trusted for authz, only for throttling. On Fly,
 * `Fly-Client-IP` is stamped by the edge and is NOT forwardable by the client, so it is authoritative.
 * Otherwise fall back to the RIGHTMOST `X-Forwarded-For` entry — the value appended by the outermost
 * trusted proxy — never the leftmost, which a client can spoof to mint a fresh bucket per request.
 */
export function clientKey(
  flyClientIp: string | null,
  forwardedFor: string | null,
  route: string,
): string {
  const ip = flyClientIp?.trim() || forwardedFor?.split(",").at(-1)?.trim() || "unknown";
  return `${route}:${ip}`;
}
