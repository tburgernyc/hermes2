/**
 * Prompt Payment Act deadline math (§3.3; reused by §3.4 pointed the other way — Decision 10). PURE,
 * side-effect-free, direction-agnostic: the SAME clock function powers both legs of the money flow —
 *
 *   Government → Prime : the government must pay within 14 days of a PROGRESS invoice (30 days FINAL),
 *                         clocked from invoice submission (31 U.S.C. § 3903 / FAR 52.232-25).
 *   Prime → Subcontractor: the prime must then pay its sub within 7 days of RECEIVING that government
 *                         payment (15 days if the sub qualifies for "accelerated payments" — 31 CFR part
 *                         1315, typically flowed down to small-business subs).
 *
 * §3.4 (reverse subcontracting — the firm AS a subcontractor to another prime) reuses `calculateClock`
 * directly: the firm's own payment-received clock start is the TEAMING PARTNER's payment date instead of
 * the government's, with the same 7/15-day downstream window, and the same invoice-date fallback for a
 * planning ESTIMATE when no upstream-payment record exists yet.
 *
 * Decision 8 (binding): a null clock-start date means the clock has NOT STARTED — always surface
 * "unknown," never fabricate a due date. The two convenience wrappers below encode exactly that.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Add `days` calendar days to `date`, returning a new Date (never mutates the input). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export type PaymentDeadlineStatus = "UNKNOWN" | "ON_TRACK" | "AT_RISK" | "MISSED";

/** Which date the returned deadline was actually computed from. */
export type PaymentDeadlineBasis =
  | "CLOCK_START" // a real, recorded upstream-payment (or invoice-submission) date started the clock
  | "INVOICE_DATE_FALLBACK" // no upstream-payment record exists yet; PROJECTED from the invoice date only
  | "NONE"; // no date at all to compute from — never fabricated

export interface PaymentDeadlineResult {
  /** The computed due date, or null when there is nothing to compute from (Decision 8: never fabricated). */
  dueDate: Date | null;
  basis: PaymentDeadlineBasis;
  status: PaymentDeadlineStatus;
  /** Calendar days until due (negative once missed). Null iff dueDate is null. */
  daysRemaining: number | null;
}

/** A deadline within this many days (and not yet due) is flagged AT_RISK rather than ON_TRACK. */
export const AT_RISK_WINDOW_DAYS = 2;

/**
 * The direction-agnostic base calculation: `clockDays` after `clockStartDate`. If `clockStartDate` is
 * null, falls back to `fallbackStartDate` + `clockDays` (marked INVOICE_DATE_FALLBACK — a PROJECTED
 * estimate, not an actual clock) when provided; otherwise returns "nothing to compute" (UNKNOWN, null
 * date). `now` is injected for testability (defaults to the current time).
 */
export function calculateClock(input: {
  clockStartDate: Date | null;
  clockDays: number;
  fallbackStartDate?: Date | null;
  now?: Date;
}): PaymentDeadlineResult {
  const now = input.now ?? new Date();

  let dueDate: Date | null = null;
  let basis: PaymentDeadlineBasis = "NONE";
  if (input.clockStartDate) {
    dueDate = addDays(input.clockStartDate, input.clockDays);
    basis = "CLOCK_START";
  } else if (input.fallbackStartDate) {
    dueDate = addDays(input.fallbackStartDate, input.clockDays);
    basis = "INVOICE_DATE_FALLBACK";
  }

  if (!dueDate) {
    return { dueDate: null, basis: "NONE", status: "UNKNOWN", daysRemaining: null };
  }

  const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / MS_PER_DAY);
  const status: PaymentDeadlineStatus =
    daysRemaining < 0 ? "MISSED" : daysRemaining <= AT_RISK_WINDOW_DAYS ? "AT_RISK" : "ON_TRACK";
  return { dueDate, basis, status, daysRemaining };
}

/**
 * Leg 1 — the government's deadline to pay a submitted invoice: 14 days (PROGRESS) / 30 days (FINAL)
 * from `invoiceSubmittedAt`. `invoiceSubmittedAt` null (not yet submitted) ⇒ UNKNOWN, no fabricated date.
 */
export function governmentPaymentDeadline(input: {
  invoiceSubmittedAt: Date | null;
  invoiceKind: "PROGRESS" | "FINAL";
  now?: Date;
}): PaymentDeadlineResult {
  const clockDays = input.invoiceKind === "FINAL" ? 30 : 14;
  return calculateClock({ clockStartDate: input.invoiceSubmittedAt, clockDays, now: input.now });
}

/**
 * Leg 2 — the prime's deadline to pay its subcontractor: 7 days (15 if `accelerated`) after
 * `upstreamPaymentDate` (the date the FIRM actually received payment — the government on the direct
 * flow, §3.3; a teaming partner on the reverse flow, §3.4).
 *
 * Decision 8: `upstreamPaymentDate` null means the payment clock has NOT STARTED — the caller must NOT
 * fabricate a due date from, say, an assumed government-pay window. `fallbackInvoiceDate`, if supplied,
 * only ever produces a clearly-marked INVOICE_DATE_FALLBACK projection (§3.4's own convenience, when no
 * upstream-payment record is tracked at all) — it is never used silently as if it were a real clock.
 */
export function subcontractorPaymentDeadline(input: {
  upstreamPaymentDate: Date | null;
  accelerated: boolean;
  fallbackInvoiceDate?: Date | null;
  now?: Date;
}): PaymentDeadlineResult {
  const clockDays = input.accelerated ? 15 : 7;
  return calculateClock({
    clockStartDate: input.upstreamPaymentDate,
    clockDays,
    fallbackStartDate: input.fallbackInvoiceDate,
    now: input.now,
  });
}
