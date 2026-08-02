"use server";

/**
 * §3.5 DCAA-adequate timekeeping — the timesheet Server Actions.
 *
 * The load-bearing invariant this file enforces: a time entry can be written in exactly TWO ways, and
 * they are mutually exclusive by period status —
 *   1. While its period is OPEN (still a draft, never submitted): createTimeEntry / deleteTimeEntry do a
 *      plain insert/delete. Nothing has been certified yet, so there is no DCAA finding in fixing a typo.
 *   2. Once its period is SUBMITTED or APPROVED: the ONLY write path is correctTimeEntry, which — in ONE
 *      transaction — updates the entry AND inserts an append-only row into time_entry_corrections
 *      (who/when/old/new/reason). There is no `updateTimeEntry` function in this file that can reach a
 *      submitted entry; the correction path is not a special case bolted onto a generic update, it IS the
 *      only update path once submitted. (time_entry_corrections is itself DB-enforced append-only —
 *      triggers + REVOKE, Phase A — so even this code could not rewrite a correction after the fact.)
 *
 * Every action re-checks the admin session (requireAdmin → role + satisfied TOTP), runs inside an
 * org-scoped transaction (hermes_app RLS), and writes an audit_log row (CLAUDE.md §7). Entry CRUD is
 * scoped to the ACTING user's own rows (session.user.id === time_entries.user_id) — this is a "my
 * timesheet" surface, not a manager entering time for someone else (see the PR body for the ADMIN-only
 * vs. vendor-side read of the schema). Submitting a period is likewise self-only (self-certification —
 * you attest to your own hours). Approving a period, and correcting an entry, may be done by any admin
 * (a supervisor catching and fixing someone else's mistake, or approving it, is a normal DCAA pattern);
 * the actor is always recorded on both the correction row and the audit row either way.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

import { daysLate, todayIsoDate, weekPeriodBounds } from "@hermes/core";
import {
  and,
  contractMilestones,
  count,
  eq,
  timeEntries,
  timeEntryCorrections,
  timesheetPeriods,
  withOrg,
  type Tx,
} from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

function optionalUuid(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  const value = typeof raw === "string" ? raw.trim() : "";
  return value === "" ? undefined : value;
}

class PeriodClosedError extends Error {}
class NotCorrectableError extends Error {}
class NotFoundError extends Error {}
class EmptyPeriodError extends Error {}
class ValidationError extends Error {}

const chargeClassEnum = z.enum(["DIRECT", "INDIRECT"]);

const entryFields = {
  hours: z.coerce.number().positive().max(24),
  chargeClass: chargeClassEnum,
  contractId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(2000),
};

const entrySchema = z
  .object({ workDate: z.string().regex(ISO_DATE_RE, "Invalid date"), ...entryFields })
  .refine((v) => v.chargeClass !== "DIRECT" || v.contractId !== undefined, {
    message: "DIRECT labor must be charged to a contract",
    path: ["contractId"],
  })
  .refine((v) => v.milestoneId === undefined || v.contractId !== undefined, {
    message: "A milestone requires a contract",
    path: ["milestoneId"],
  });

const correctionSchema = z
  .object({ ...entryFields, reason: z.string().trim().min(1).max(1000) })
  .refine((v) => v.chargeClass !== "DIRECT" || v.contractId !== undefined, {
    message: "DIRECT labor must be charged to a contract",
    path: ["contractId"],
  })
  .refine((v) => v.milestoneId === undefined || v.contractId !== undefined, {
    message: "A milestone requires a contract",
    path: ["milestoneId"],
  });

/** A milestone, if given, must actually belong to the given contract (not just any contract). */
async function assertMilestoneMatchesContract(
  tx: Tx,
  orgId: string,
  contractId: string | undefined,
  milestoneId: string | undefined,
): Promise<void> {
  if (!milestoneId || !contractId) return;
  const rows = await tx
    .select({ contractId: contractMilestones.contractId })
    .from(contractMilestones)
    .where(and(eq(contractMilestones.orgId, orgId), eq(contractMilestones.id, milestoneId)))
    .limit(1);
  const milestone = rows[0];
  if (!milestone || milestone.contractId !== contractId) {
    throw new ValidationError("That milestone does not belong to the selected contract");
  }
}

/** Find-or-create the OPEN period for `userId`'s calendar week containing `workDate` (idempotent). */
async function ensureOpenPeriod(
  tx: Tx,
  orgId: string,
  userId: string,
  workDate: string,
): Promise<{ id: string; status: string }> {
  const { periodStart, periodEnd } = weekPeriodBounds(workDate);
  const existing = await tx
    .select({ id: timesheetPeriods.id, status: timesheetPeriods.status })
    .from(timesheetPeriods)
    .where(
      and(
        eq(timesheetPeriods.orgId, orgId),
        eq(timesheetPeriods.userId, userId),
        eq(timesheetPeriods.periodStart, periodStart),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await tx
    .insert(timesheetPeriods)
    .values({ orgId, userId, periodStart, periodEnd, status: "OPEN" })
    .returning({ id: timesheetPeriods.id, status: timesheetPeriods.status });
  const row = inserted[0];
  if (!row) throw new Error("timesheet period insert returned no row");
  return row;
}

/**
 * Same-day entry, not batch/retroactive-only (§3.5 item 2): create a time entry for the acting admin,
 * auto-attaching it to the OPEN period for its calendar week (creating that period on first use). A
 * work date in a week whose period is already SUBMITTED/APPROVED is refused — that week is closed to new
 * entries; use the correction flow on an existing entry instead.
 */
export async function createTimeEntry(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  let status = "created";

  try {
    const parsed = entrySchema.parse({
      workDate: formData.get("workDate"),
      hours: formData.get("hours"),
      chargeClass: formData.get("chargeClass"),
      contractId: optionalUuid(formData, "contractId"),
      milestoneId: optionalUuid(formData, "milestoneId"),
      description: formData.get("description"),
    });
    if (parsed.workDate > todayIsoDate()) throw new ValidationError("Work date cannot be in the future");

    await withOrg(orgId, async (tx) => {
      await assertMilestoneMatchesContract(tx, orgId, parsed.contractId, parsed.milestoneId);

      const period = await ensureOpenPeriod(tx, orgId, userId, parsed.workDate);
      if (period.status !== "OPEN") throw new PeriodClosedError();

      const inserted = await tx
        .insert(timeEntries)
        .values({
          orgId,
          userId,
          workDate: parsed.workDate,
          hours: parsed.hours.toFixed(2),
          chargeClass: parsed.chargeClass,
          contractId: parsed.contractId ?? null,
          milestoneId: parsed.milestoneId ?? null,
          description: parsed.description,
          periodId: period.id,
        })
        .returning({ id: timeEntries.id });
      const entryId = inserted[0]?.id;
      if (!entryId) throw new Error("time entry insert returned no row");

      await writeAudit(tx, {
        orgId,
        actorType: "ADMIN",
        actorUserId: userId,
        actorEmail: session.user.email ?? null,
        action: "TIME_ENTRY_CREATED",
        entityType: "time_entries",
        entityId: entryId,
        after: {
          workDate: parsed.workDate,
          hours: parsed.hours.toFixed(2),
          chargeClass: parsed.chargeClass,
          contractId: parsed.contractId ?? null,
          milestoneId: parsed.milestoneId ?? null,
          daysLate: daysLate(parsed.workDate),
        },
      });
    });
  } catch (err) {
    if (err instanceof PeriodClosedError) status = "period-closed";
    else if (err instanceof z.ZodError || err instanceof ValidationError) status = "invalid";
    else {
      status = "error";
      console.error("createTimeEntry failed", err instanceof Error ? err.message : String(err));
    }
  }

  redirect(`/admin/time?status=${status}`);
}

/** Delete a draft entry. OPEN-period only — once submitted, use correctTimeEntry instead (never delete). */
export async function deleteTimeEntry(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const entryId = readId(formData, "entryId");
  let status = "deleted";

  try {
    await withOrg(orgId, async (tx) => {
      const rows = await tx
        .select({ id: timeEntries.id, periodStatus: timesheetPeriods.status })
        .from(timeEntries)
        .innerJoin(
          timesheetPeriods,
          and(eq(timesheetPeriods.orgId, timeEntries.orgId), eq(timesheetPeriods.id, timeEntries.periodId)),
        )
        .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
        .limit(1);
      const row = rows[0];
      if (!row) throw new NotFoundError();
      if (row.periodStatus !== "OPEN") throw new PeriodClosedError();

      await tx.delete(timeEntries).where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.id, entryId)));

      await writeAudit(tx, {
        orgId,
        actorType: "ADMIN",
        actorUserId: userId,
        actorEmail: session.user.email ?? null,
        action: "TIME_ENTRY_DELETED",
        entityType: "time_entries",
        entityId: entryId,
      });
    });
  } catch (err) {
    if (err instanceof NotFoundError) status = "not-found";
    else if (err instanceof PeriodClosedError) status = "period-closed";
    else {
      status = "error";
      console.error("deleteTimeEntry failed", err instanceof Error ? err.message : String(err));
    }
  }

  redirect(`/admin/time?status=${status}`);
}

/**
 * Submit a period: self-certification that its entries are accurate. Requires at least one entry (an
 * empty timesheet is not a real attestation) and moves OPEN → SUBMITTED, which structurally closes the
 * week to new plain entries (createTimeEntry) — any further change must go through correctTimeEntry.
 */
export async function submitPeriod(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const periodId = readId(formData, "periodId");
  let status = "submitted";

  try {
    await withOrg(orgId, async (tx) => {
      const counted = await tx
        .select({ n: count() })
        .from(timeEntries)
        .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.periodId, periodId)));
      if (Number(counted[0]?.n ?? 0) === 0) throw new EmptyPeriodError();

      const rows = await tx
        .update(timesheetPeriods)
        .set({ status: "SUBMITTED", submittedAt: new Date() })
        .where(
          and(
            eq(timesheetPeriods.orgId, orgId),
            eq(timesheetPeriods.id, periodId),
            eq(timesheetPeriods.userId, userId), // self-certification: only the period's own user submits it
            eq(timesheetPeriods.status, "OPEN"),
          ),
        )
        .returning({ id: timesheetPeriods.id });
      if (rows.length === 0) throw new NotFoundError();

      await writeAudit(tx, {
        orgId,
        actorType: "ADMIN",
        actorUserId: userId,
        actorEmail: session.user.email ?? null,
        action: "TIMESHEET_PERIOD_SUBMITTED",
        entityType: "timesheet_periods",
        entityId: periodId,
      });
    });
  } catch (err) {
    if (err instanceof EmptyPeriodError) status = "empty";
    else if (err instanceof NotFoundError) status = "not-found";
    else {
      status = "error";
      console.error("submitPeriod failed", err instanceof Error ? err.message : String(err));
    }
  }

  redirect(`/admin/time?status=${status}`);
}

/**
 * The DCAA audit trail (§3.5 item 3): correct a SUBMITTED/APPROVED entry. In ONE transaction, updates
 * the entry's current values AND inserts an append-only time_entry_corrections row carrying the OLD
 * values, the NEW values, who made the change, and a required reason — the original is never silently
 * overwritten, it is preserved in the correction row (which the DB itself makes immutable).
 */
export async function correctTimeEntry(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const entryId = readId(formData, "entryId");
  let status = "corrected";

  try {
    const parsed = correctionSchema.parse({
      hours: formData.get("hours"),
      chargeClass: formData.get("chargeClass"),
      contractId: optionalUuid(formData, "contractId"),
      milestoneId: optionalUuid(formData, "milestoneId"),
      description: formData.get("description"),
      reason: formData.get("reason"),
    });

    await withOrg(orgId, async (tx) => {
      await assertMilestoneMatchesContract(tx, orgId, parsed.contractId, parsed.milestoneId);

      const rows = await tx
        .select({
          hours: timeEntries.hours,
          chargeClass: timeEntries.chargeClass,
          contractId: timeEntries.contractId,
          milestoneId: timeEntries.milestoneId,
          description: timeEntries.description,
          periodStatus: timesheetPeriods.status,
        })
        .from(timeEntries)
        .innerJoin(
          timesheetPeriods,
          and(eq(timesheetPeriods.orgId, timeEntries.orgId), eq(timesheetPeriods.id, timeEntries.periodId)),
        )
        .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.id, entryId)))
        .limit(1);
      const before = rows[0];
      if (!before) throw new NotFoundError();
      // Draft (OPEN-period) entries are edited in place via createTimeEntry/deleteTimeEntry, never here —
      // the correction ceremony exists only once an entry has been self-certified.
      if (before.periodStatus === "OPEN") throw new NotCorrectableError();

      const oldValues = {
        hours: before.hours,
        chargeClass: before.chargeClass,
        contractId: before.contractId,
        milestoneId: before.milestoneId,
        description: before.description,
      };
      const newValues = {
        hours: parsed.hours.toFixed(2),
        chargeClass: parsed.chargeClass,
        contractId: parsed.contractId ?? null,
        milestoneId: parsed.milestoneId ?? null,
        description: parsed.description,
      };

      await tx
        .update(timeEntries)
        .set({
          hours: newValues.hours,
          chargeClass: newValues.chargeClass,
          contractId: newValues.contractId,
          milestoneId: newValues.milestoneId,
          description: newValues.description,
        })
        .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.id, entryId)));

      // The append-only trail — DB-enforced immutable (triggers + REVOKE, Phase A migration 0003/0004).
      await tx.insert(timeEntryCorrections).values({
        orgId,
        timeEntryId: entryId,
        correctedBy: userId,
        oldValues,
        newValues,
        reason: parsed.reason,
      });

      await writeAudit(tx, {
        orgId,
        actorType: "ADMIN",
        actorUserId: userId,
        actorEmail: session.user.email ?? null,
        action: "TIME_ENTRY_CORRECTED",
        entityType: "time_entries",
        entityId: entryId,
        before: oldValues,
        after: newValues,
      });
    });
  } catch (err) {
    if (err instanceof NotFoundError) status = "not-found";
    else if (err instanceof NotCorrectableError) status = "not-correctable";
    else if (err instanceof z.ZodError || err instanceof ValidationError) status = "invalid";
    else {
      status = "error";
      console.error("correctTimeEntry failed", err instanceof Error ? err.message : String(err));
    }
  }

  redirect(`/admin/time?status=${status}`);
}

/**
 * The explicit admin approval action (§3.5 item 4) — the human gate consistent with the pattern used
 * everywhere else in the system (CLAUDE.md §2). A submitted period is not final/billable until this
 * click sets a recorded approver + timestamp (DB CHECK-enforced — timesheet_periods_approval_gate).
 */
export async function approveTimesheetPeriod(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const periodId = readId(formData, "periodId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(timesheetPeriods)
      .set({ status: "APPROVED", approvedBy: userId, approvedAt: new Date() })
      .where(
        and(
          eq(timesheetPeriods.orgId, orgId),
          eq(timesheetPeriods.id, periodId),
          eq(timesheetPeriods.status, "SUBMITTED"),
        ),
      )
      .returning({ id: timesheetPeriods.id });
    if (rows.length === 0) return;

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "TIMESHEET_PERIOD_APPROVED",
      entityType: "timesheet_periods",
      entityId: periodId,
    });
  });

  redirect("/admin/time/approvals?status=approved");
}
