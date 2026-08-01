/**
 * DCAA-adequate timekeeping cluster (§3.5, DFARS 252.242-7006):
 *
 *   timesheet_periods      — the approval unit. Status lives HERE (OPEN → SUBMITTED → APPROVED),
 *                            not on individual entries; APPROVED requires a recorded human
 *                            approver + timestamp (the same CHECK-enforced human-gate pattern as
 *                            outreach approval — CLAUDE.md §2).
 *   time_entries           — one row per person/day/charge: project/task-level charging
 *                            (contract/milestone), DIRECT/INDIRECT segregation (DIRECT requires a
 *                            contract), and a required description of work performed.
 *   time_entry_corrections — the DCAA audit trail: any edit to a submitted entry is recorded as an
 *                            APPEND-ONLY correction (who/when/old/new/reason), mirroring
 *                            audit_log's immutability (triggers + REVOKE in the manual guards) —
 *                            never a silent in-place overwrite.
 *
 * T&M invoicing (§3.3/§3.5.5) derives billable hours from APPROVED entries via
 * time_entries.invoice_id (O7). Daily-entry nudging and the approval UI are Phase-B app work.
 */
import {
  check,
  date,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { timeChargeClass, timesheetStatus } from "./enums.js";
import { timestamps, uuidPk } from "./_shared.js";
import { orgs, users } from "./tenancy.js";
import { contractMilestones, contracts } from "./contracting.js";
import { invoices } from "./finance.js";

export const timesheetPeriods = pgTable(
  "timesheet_periods",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    userId: uuid("user_id").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: timesheetStatus("status").notNull().default("OPEN"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    unique("timesheet_periods_org_id_id_key").on(t.orgId, t.id),
    // One period per (user, start date) — duplicate periods would fork the approval trail.
    uniqueIndex("timesheet_periods_user_start_key").on(t.orgId, t.userId, t.periodStart),
    foreignKey({
      name: "timesheet_periods_user_fk",
      columns: [t.orgId, t.userId],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "timesheet_periods_approver_fk",
      columns: [t.orgId, t.approvedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("timesheet_periods_org_idx").on(t.orgId),
    index("timesheet_periods_user_idx").on(t.userId),
    check("timesheet_periods_period_order", sql`${t.periodEnd} >= ${t.periodStart}`),
    // §3.5.4 human gate: a period is final/billable ONLY with a recorded approver + timestamp.
    check(
      "timesheet_periods_approval_gate",
      sql`${t.status} <> 'APPROVED' OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      "timesheet_periods_submit_requires_timestamp",
      sql`${t.status} NOT IN ('SUBMITTED','APPROVED') OR ${t.submittedAt} IS NOT NULL`,
    ),
  ],
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    userId: uuid("user_id").notNull(),
    workDate: date("work_date").notNull(),
    /** Hours for THIS entry (0 < h ≤ 24) — daily-granularity charging, not weekly batches. */
    hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
    chargeClass: timeChargeClass("charge_class").notNull(),
    /** DIRECT labor must charge a contract (CHECK); INDIRECT (G&A/overhead/B&P) may not need one. */
    contractId: uuid("contract_id"),
    milestoneId: uuid("milestone_id"),
    description: text("description").notNull(),
    /** The timesheet period this entry rolls up into (status is carried at the period level). */
    periodId: uuid("period_id"),
    /** O7: the T&M government invoice these APPROVED hours were billed on (§3.3/§3.5.5). */
    invoiceId: uuid("invoice_id"),
    ...timestamps(),
  },
  (t) => [
    unique("time_entries_org_id_id_key").on(t.orgId, t.id),
    foreignKey({
      name: "time_entries_user_fk",
      columns: [t.orgId, t.userId],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "time_entries_contract_fk",
      columns: [t.orgId, t.contractId],
      foreignColumns: [contracts.orgId, contracts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "time_entries_milestone_fk",
      columns: [t.orgId, t.milestoneId],
      foreignColumns: [contractMilestones.orgId, contractMilestones.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "time_entries_period_fk",
      columns: [t.orgId, t.periodId],
      foreignColumns: [timesheetPeriods.orgId, timesheetPeriods.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "time_entries_invoice_fk",
      columns: [t.orgId, t.invoiceId],
      foreignColumns: [invoices.orgId, invoices.id],
    }).onDelete("restrict"),
    index("time_entries_org_idx").on(t.orgId),
    index("time_entries_user_date_idx").on(t.userId, t.workDate),
    index("time_entries_contract_idx").on(t.contractId),
    index("time_entries_period_idx").on(t.periodId),
    check("time_entries_hours_range", sql`${t.hours} > 0 AND ${t.hours} <= 24`),
    // DCAA segregation: DIRECT labor is always charged to a contract, never floating.
    check(
      "time_entries_direct_requires_contract",
      sql`${t.chargeClass} <> 'DIRECT' OR ${t.contractId} IS NOT NULL`,
    ),
    check(
      "time_entries_milestone_requires_contract",
      sql`${t.milestoneId} IS NULL OR ${t.contractId} IS NOT NULL`,
    ),
    check("time_entries_description_present", sql`length(btrim(${t.description})) > 0`),
  ],
);

/**
 * Append-only (like audit_log): the immutability triggers + the REVOKE in the manual guards block
 * UPDATE/DELETE/TRUNCATE, so a correction — the single most-cited DCAA finding when absent — can
 * never itself be silently rewritten. No updated_at by design; corrected_at is the event stamp.
 */
export const timeEntryCorrections = pgTable(
  "time_entry_corrections",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    timeEntryId: uuid("time_entry_id").notNull(),
    correctedBy: uuid("corrected_by").notNull(),
    correctedAt: timestamp("corrected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    oldValues: jsonb("old_values").notNull(),
    newValues: jsonb("new_values").notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [
    foreignKey({
      name: "corrections_entry_fk",
      columns: [t.orgId, t.timeEntryId],
      foreignColumns: [timeEntries.orgId, timeEntries.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "corrections_user_fk",
      columns: [t.orgId, t.correctedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("corrections_org_idx").on(t.orgId),
    index("corrections_entry_idx").on(t.timeEntryId),
    check("time_entry_corrections_reason_present", sql`length(btrim(${t.reason})) > 0`),
  ],
);
