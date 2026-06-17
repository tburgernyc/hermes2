/**
 * Sentry event scrubbing (CLAUDE.md §4 + §7). Pure + dependency-light so it runs in every runtime
 * (node/edge/browser) and is unit-testable without a DSN. Wired into `beforeSend` of all three Sentry
 * inits (server/edge/client).
 *
 * Two jobs:
 *   1. DROP Postgres RLS / privilege-denied errors. An RLS violation reaching Sentry means an attacker
 *      hit a trust boundary and the boundary WORKED — it is a security signal, not an app bug, and must
 *      not drown real errors or page anyone. Visible in server logs; never alerted on.
 *   2. SCRUB secrets + PII from everything we DO send: env-like secret values, vendor/visitor emails,
 *      request headers/cookies/data, and user identity (email/ip/username). ANTHROPIC_API_KEY,
 *      DATABASE_URL, RESEND_API_KEY, AUTH_SECRET, TOTP ciphertext, signed tokens — none may ever leave.
 *
 * Fail-closed: if scrubbing throws for any reason, the event is DROPPED (return null) rather than risk
 * sending something unscrubbed.
 */
import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const REDACTED = "[redacted]";

// Recursion cap for the nested scrub. Sentry payloads are shallow; the cap also bounds work if
// structuredClone ever preserves a cycle (it does not throw on cycles, so the recursion needs a floor).
const MAX_SCRUB_DEPTH = 6;

// A value is sensitive when its KEY looks secret-bearing. Matched against context/header/extra keys.
const SECRET_KEY_RE =
  /(secret|token|password|passwd|api[_-]?key|database_url|\bdsn\b|ciphertext|signing|cookie|authorization|connection[_-]?string|private[_-]?key)/i;

// Email addresses anywhere in free text → masked (vendor + visitor PII).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Postgres RLS / insufficient-privilege signatures. 42501 is the SQLSTATE our RLS denials raise.
const RLS_RE =
  /(row[- ]level security|violates row-level security|permission denied for|insufficient_privilege|\b42501\b)/i;

function maskEmails(value: string): string {
  return value.replace(EMAIL_RE, REDACTED);
}

/** True when this event is a Postgres RLS / privilege-denied error (a security signal, not a bug). */
export function isRlsError(event: ErrorEvent, hint?: EventHint): boolean {
  const original = hint?.originalException;
  if (original instanceof Error) {
    const code = (original as { code?: unknown }).code;
    if (RLS_RE.test(original.message) || (typeof code === "string" && RLS_RE.test(code))) return true;
  }
  return (event.exception?.values ?? []).some(
    (v) => (v.value ? RLS_RE.test(v.value) : false) || (v.type ? RLS_RE.test(v.type) : false),
  );
}

/**
 * Recursively redact secret-keyed values and mask emails in a record, in place (on a clone — see
 * scrubEvent). Recurses into nested objects + arrays so a secret buried inside `extra.config.db.PASSWORD`
 * or a breadcrumb `data` sub-object cannot escape. Depth-capped against cyclic clones.
 */
function scrubRecord(record: Record<string, unknown> | undefined, depth = 0): void {
  if (!record || depth > MAX_SCRUB_DEPTH) return;
  for (const key of Object.keys(record)) {
    if (SECRET_KEY_RE.test(key)) {
      record[key] = REDACTED;
      continue;
    }
    const value = record[key];
    if (typeof value === "string") {
      record[key] = maskEmails(value);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "string") value[i] = maskEmails(item);
        else if (item && typeof item === "object") scrubRecord(item as Record<string, unknown>, depth + 1);
      });
    } else if (value && typeof value === "object") {
      scrubRecord(value as Record<string, unknown>, depth + 1);
    }
  }
}

/** Return a scrubbed COPY of the event (input is never mutated — clone first). */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const e = structuredClone(event);

  // 1. Drop PII identity.
  if (e.user) {
    delete e.user.email;
    delete e.user.ip_address;
    delete e.user.username;
  }

  // 2. Mask emails in exception messages + the top-level message.
  for (const value of e.exception?.values ?? []) {
    if (value.value) value.value = maskEmails(value.value);
  }
  if (typeof e.message === "string") e.message = maskEmails(e.message);

  // 3. Redact request headers/cookies + mask query/body.
  if (e.request) {
    scrubRecord(e.request.headers as Record<string, unknown> | undefined);
    if (e.request.cookies) e.request.cookies = REDACTED as unknown as typeof e.request.cookies;
    if (typeof e.request.query_string === "string") {
      e.request.query_string = maskEmails(e.request.query_string);
    } else {
      scrubRecord(e.request.query_string as Record<string, unknown> | undefined);
    }
    if (typeof e.request.data === "string") e.request.data = maskEmails(e.request.data);
    else scrubRecord(e.request.data as Record<string, unknown> | undefined);
  }

  // 4. Redact secrets + mask emails across extra / tags / contexts.
  scrubRecord(e.extra as Record<string, unknown> | undefined);
  scrubRecord(e.tags as Record<string, unknown> | undefined);
  if (e.contexts) {
    for (const context of Object.values(e.contexts)) {
      scrubRecord(context as Record<string, unknown> | undefined);
    }
  }

  // 5. Mask emails in breadcrumb messages + data.
  for (const crumb of e.breadcrumbs ?? []) {
    if (typeof crumb.message === "string") crumb.message = maskEmails(crumb.message);
    scrubRecord(crumb.data as Record<string, unknown> | undefined);
  }

  return e;
}

/** The `beforeSend` hook: drop RLS errors, otherwise send a scrubbed copy; fail closed on any error. */
export function makeBeforeSend(): (event: ErrorEvent, hint: EventHint) => ErrorEvent | null {
  return (event, hint) => {
    try {
      if (isRlsError(event, hint)) return null;
      return scrubEvent(event);
    } catch {
      return null; // never send something we could not scrub
    }
  };
}
