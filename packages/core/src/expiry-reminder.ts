/**
 * Generic expiration-reminder cadence (§3.3 SAM.gov registration expiry; reusable for any other
 * expires_at-shaped date the reminder collector needs — e.g. reps/certs recert, insurance policies).
 * Mirrors SAM.gov's OWN reminder cadence: 60 days out, then 30 days out, then EXPIRED once past due.
 * PURE, side-effect-free — no DB, no cron plumbing. `expiresAt` null means "unknown / not yet set," and
 * the caller must treat that as nothing-to-remind-on, never a fabricated countdown (the same convention
 * as the Prompt-Payment helpers in prompt-payment.ts).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ExpiryReminderLevel = "NONE" | "DUE_60" | "DUE_30" | "EXPIRED";

export interface ExpiryReminderResult {
  level: ExpiryReminderLevel;
  /** Calendar days until expiry (negative once expired). Null iff expiresAt was null. */
  daysRemaining: number | null;
}

/** Calendar days from `now` until `date` (may be negative if `date` is in the past). */
export function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY);
}

export function expiryReminderLevel(input: {
  expiresAt: Date | null;
  now?: Date;
}): ExpiryReminderResult {
  if (!input.expiresAt) return { level: "NONE", daysRemaining: null };
  const now = input.now ?? new Date();
  const daysRemaining = daysUntil(input.expiresAt, now);
  if (daysRemaining < 0) return { level: "EXPIRED", daysRemaining };
  if (daysRemaining <= 30) return { level: "DUE_30", daysRemaining };
  if (daysRemaining <= 60) return { level: "DUE_60", daysRemaining };
  return { level: "NONE", daysRemaining };
}
