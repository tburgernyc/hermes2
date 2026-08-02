/**
 * §3.5 DCAA-adequate timekeeping — domain helpers (Phase B, app layer on top of the Phase-A schema).
 *
 *  - weekPeriodBounds: PURE Mon–Sun period-boundary calculator. Every `timesheet_periods` row is
 *    week-aligned; the app derives the period a `work_date` belongs to from this, never a free-form
 *    range — so two entries in the same calendar week always land in the same approval unit.
 *  - daysLate: PURE same-day-entry nudge calculator. DCAA expects same-day entry; this reports how
 *    many days after the work date an entry was actually logged, so the UI can nudge (not block) —
 *    legitimate catch-up entry (sick day, travel) must remain possible.
 *  - computeApprovedHours: the PURE "approved hours" calculator called out by the spec — takes an
 *    array of ALREADY-FETCHED time entries (each carrying its owning period's status) plus a scoping
 *    query (contract, optional milestone, optional date window) and returns the summed DIRECT hours
 *    from APPROVED periods only. No I/O, no framework dependency — unit-testable with plain fixtures.
 *  - getApprovedHours: the DB-backed convenience wrapper a later Wave-2c integration unit (§3.3 T&M
 *    invoicing) calls directly — queries org-scoped time entries joined to their period, then reduces
 *    them with computeApprovedHours so the exact-same scoping logic backs both the pure unit tests and
 *    the real query. Deliberately NOT wired into any invoicing path by this PR — see the §3.5 PR body's
 *    item-5 exclusion note (that wiring is a separate, later integration unit).
 *
 * Only DIRECT hours count as "approved billable hours": INDIRECT (G&A/overhead/B&P) labor is never
 * billed to a specific government contract, so it is excluded from this calculation even if its period
 * is APPROVED (CLAUDE.md §6.2 / DFARS 252.242-7006 direct/indirect segregation).
 */
import { and, eq, gte, lte, timeEntries, timesheetPeriods, withOrg } from "@hermes/db";

/** A calendar week's Monday/Sunday boundary (inclusive), in `YYYY-MM-DD` — the timesheet-period grain. */
export interface WeekPeriodBounds {
  periodStart: string;
  periodEnd: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDateUtc(isoDate: string): Date {
  if (!ISO_DATE_RE.test(isoDate)) throw new Error(`Invalid ISO date: ${isoDate}`);
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${isoDate}`);
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date in `YYYY-MM-DD`, UTC (matches the `date` column's storage — no time-of-day component). */
export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * The Monday–Sunday week containing `workDate` (pure — no `Date.now()`, no I/O). Every timesheet period
 * is exactly one calendar week; entries in the same week always resolve to the same period bounds.
 */
export function weekPeriodBounds(workDate: string): WeekPeriodBounds {
  const d = parseIsoDateUtc(workDate);
  const dow = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { periodStart: toIsoDate(monday), periodEnd: toIsoDate(sunday) };
}

/**
 * Days between `workDate` and `loggedOn` (default: today) — 0 for same-day entry (the DCAA-expected
 * case), positive for retroactive/catch-up entry, negative for a future-dated work date (the caller
 * should reject those separately; this function only measures, it never validates).
 */
export function daysLate(workDate: string, loggedOn: string = todayIsoDate()): number {
  const work = parseIsoDateUtc(workDate).getTime();
  const logged = parseIsoDateUtc(loggedOn).getTime();
  return Math.round((logged - work) / 86_400_000);
}

/** The minimal shape `computeApprovedHours` needs from a time entry + its owning period's status. */
export interface ApprovedHoursEntry {
  contractId: string | null;
  milestoneId: string | null;
  workDate: string; // YYYY-MM-DD
  hours: string | number;
  chargeClass: "DIRECT" | "INDIRECT";
  periodStatus: "OPEN" | "SUBMITTED" | "APPROVED";
}

/** Scoping for an approved-hours computation: a contract is required; milestone/date-window narrow it. */
export interface ApprovedHoursQuery {
  contractId: string;
  milestoneId?: string;
  /** Inclusive lower bound (YYYY-MM-DD). */
  from?: string;
  /** Inclusive upper bound (YYYY-MM-DD). */
  to?: string;
}

/**
 * PURE: sum DIRECT hours from APPROVED-period entries matching the query. No I/O. This is the single
 * source of the scoping rules (approved-only, DIRECT-only, contract/milestone/date-window) — both the
 * unit tests and `getApprovedHours` below exercise this same function.
 */
export function computeApprovedHours(
  entries: readonly ApprovedHoursEntry[],
  query: ApprovedHoursQuery,
): number {
  let total = 0;
  for (const e of entries) {
    if (e.periodStatus !== "APPROVED") continue;
    if (e.chargeClass !== "DIRECT") continue;
    if (e.contractId !== query.contractId) continue;
    if (query.milestoneId !== undefined && e.milestoneId !== query.milestoneId) continue;
    if (query.from !== undefined && e.workDate < query.from) continue;
    if (query.to !== undefined && e.workDate > query.to) continue;
    total += typeof e.hours === "string" ? Number(e.hours) : e.hours;
  }
  // Two-decimal rounding matches the numeric(5,2) storage grain; avoids float noise from many additions.
  return Math.round(total * 100) / 100;
}

/**
 * DB-backed wrapper: queries `orgId`'s time entries joined to their timesheet period and reduces them
 * with `computeApprovedHours`. This is the function a later §3.3 T&M-invoicing integration unit calls to
 * derive billable hours for an invoice — NOT wired into any invoicing path by this PR (orchestrator
 * exclusion; see the §3.5 PR body).
 */
export async function getApprovedHours(orgId: string, query: ApprovedHoursQuery): Promise<number> {
  return withOrg(orgId, async (tx) => {
    const conditions = [
      eq(timeEntries.orgId, orgId),
      eq(timeEntries.contractId, query.contractId),
      eq(timeEntries.chargeClass, "DIRECT" as const),
      eq(timesheetPeriods.status, "APPROVED" as const),
    ];
    if (query.milestoneId !== undefined) conditions.push(eq(timeEntries.milestoneId, query.milestoneId));
    if (query.from !== undefined) conditions.push(gte(timeEntries.workDate, query.from));
    if (query.to !== undefined) conditions.push(lte(timeEntries.workDate, query.to));

    const rows = await tx
      .select({
        contractId: timeEntries.contractId,
        milestoneId: timeEntries.milestoneId,
        workDate: timeEntries.workDate,
        hours: timeEntries.hours,
        chargeClass: timeEntries.chargeClass,
        periodStatus: timesheetPeriods.status,
      })
      .from(timeEntries)
      .innerJoin(
        timesheetPeriods,
        and(eq(timesheetPeriods.orgId, timeEntries.orgId), eq(timesheetPeriods.id, timeEntries.periodId)),
      )
      .where(and(...conditions));

    return computeApprovedHours(rows, query);
  });
}
