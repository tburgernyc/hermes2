/**
 * Finance cluster (§3.3 + §3.4.5): the two Prompt-Payment flows modelled as DISTINCT records,
 * never one ambiguous bucket —
 *
 *   invoices               — money coming IN to the firm. contract_id XOR teaming_agreement_id
 *                            (O2): a contract-linked invoice bills the GOVERNMENT under the firm's
 *                            prime engagement; a teaming-agreement-linked invoice bills the TEAMING
 *                            PARTNER when the firm is the sub. `paid_at` is the firm's revenue-
 *                            recognition point — and, on a government invoice, the CLOCK SOURCE for
 *                            the linked subcontractor payable.
 *   subcontractor_payables — money owed OUT to the firm's own sub. The payment-due deadline is
 *                            DERIVED at runtime from the linked government invoice's paid_at
 *                            (7-day / 15-day-accelerated Prompt Payment clock) — deliberately NO
 *                            stored due date (O2; "overdue is computed, never stored stale").
 *   past_performance_records — CPARS-style ratings captured at contract closeout (§3.3), the
 *                            performance-quality signal the win/loss learning work feeds on.
 *   ai_usage_events        — per-call Claude token/cost telemetry (§3.3 AI cost observability).
 *                            High-volume append table; org-scoped only (no business FK).
 *
 * "Overdue" is ALWAYS computed at runtime from the stored dates (ar_followups precedent).
 */
import {
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { cparsRating, invoiceKind, invoiceStatus, payableStatus } from "./enums.js";
import { money, timestamps, uuidPk } from "./_shared.js";
import { orgs, users } from "./tenancy.js";
import { contractMilestones, contracts } from "./contracting.js";
import { teamingAgreements } from "./teaming.js";

export const invoices = pgTable(
  "invoices",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    /** XOR (O2): government invoice under our prime engagement … */
    contractId: uuid("contract_id"),
    /** … or our invoice TO the teaming partner when we are the sub (§3.4.5). */
    teamingAgreementId: uuid("teaming_agreement_id"),
    milestoneId: uuid("milestone_id"),
    invoiceNumber: text("invoice_number").notNull(),
    kind: invoiceKind("kind").notNull().default("PROGRESS"),
    amount: money("amount").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    /** The revenue-recognition point — and the payable clock source on a government invoice. */
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    status: invoiceStatus("status").notNull().default("DRAFT"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    unique("invoices_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("invoices_org_number_key").on(t.orgId, t.invoiceNumber),
    foreignKey({
      name: "invoices_contract_fk",
      columns: [t.orgId, t.contractId],
      foreignColumns: [contracts.orgId, contracts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_teaming_agreement_fk",
      columns: [t.orgId, t.teamingAgreementId],
      foreignColumns: [teamingAgreements.orgId, teamingAgreements.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_milestone_fk",
      columns: [t.orgId, t.milestoneId],
      foreignColumns: [contractMilestones.orgId, contractMilestones.id],
    }).onDelete("restrict"),
    index("invoices_org_idx").on(t.orgId),
    index("invoices_contract_idx").on(t.contractId),
    index("invoices_teaming_idx").on(t.teamingAgreementId),
    // Exactly one counterparty link (the codebase XOR idiom — vendor_quotes_party_xor precedent).
    check(
      "invoices_link_xor",
      sql`(${t.contractId} IS NOT NULL) <> (${t.teamingAgreementId} IS NOT NULL)`,
    ),
    check("invoices_amount_nonneg", sql`${t.amount} >= 0`),
    check("invoices_number_present", sql`length(btrim(${t.invoiceNumber})) > 0`),
    // Milestones are contract-scoped; a partner-facing invoice cannot claim one.
    check(
      "invoices_milestone_requires_contract",
      sql`${t.milestoneId} IS NULL OR ${t.contractId} IS NOT NULL`,
    ),
    // Status/timestamp pairing (outreach_sent_requires_timestamp precedent).
    check(
      "invoices_submitted_requires_timestamp",
      sql`${t.status} NOT IN ('SUBMITTED','PAID') OR ${t.submittedAt} IS NOT NULL`,
    ),
    check("invoices_paid_requires_timestamp", sql`${t.status} <> 'PAID' OR ${t.paidAt} IS NOT NULL`),
  ],
);

export const subcontractorPayables = pgTable(
  "subcontractor_payables",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").notNull(),
    milestoneId: uuid("milestone_id"),
    amount: money("amount").notNull(),
    /**
     * The government invoice whose paid_at STARTS the Prompt Payment clock for this payable
     * (7 days; 15 under contracts.accelerated_payments). NULL = clock not started (pay-when-paid:
     * the government has not paid yet) — the runtime helper surfaces "not yet due", never a
     * fabricated date. NO stored due date by design (O2).
     */
    governmentInvoiceId: uuid("government_invoice_id"),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    status: payableStatus("status").notNull().default("PENDING"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "payables_contract_fk",
      columns: [t.orgId, t.contractId],
      foreignColumns: [contracts.orgId, contracts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "payables_milestone_fk",
      columns: [t.orgId, t.milestoneId],
      foreignColumns: [contractMilestones.orgId, contractMilestones.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "payables_invoice_fk",
      columns: [t.orgId, t.governmentInvoiceId],
      foreignColumns: [invoices.orgId, invoices.id],
    }).onDelete("restrict"),
    index("payables_org_idx").on(t.orgId),
    index("payables_contract_idx").on(t.contractId),
    check("payables_amount_nonneg", sql`${t.amount} >= 0`),
    check("payables_paid_requires_timestamp", sql`${t.status} <> 'PAID' OR ${t.paidAt} IS NOT NULL`),
  ],
);

export const pastPerformanceRecords = pgTable(
  "past_performance_records",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").notNull(),
    ratingPeriodStart: timestamp("rating_period_start", { withTimezone: true, mode: "date" }),
    ratingPeriodEnd: timestamp("rating_period_end", { withTimezone: true, mode: "date" }),
    rating: cparsRating("rating").notNull(),
    narrative: text("narrative"),
    evaluatorName: text("evaluator_name"),
    evaluatorEmail: text("evaluator_email"),
    recordedBy: uuid("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "past_perf_contract_fk",
      columns: [t.orgId, t.contractId],
      foreignColumns: [contracts.orgId, contracts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "past_perf_recorder_fk",
      columns: [t.orgId, t.recordedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("past_perf_org_idx").on(t.orgId),
    index("past_perf_contract_idx").on(t.contractId),
    check(
      "past_perf_period_order",
      sql`${t.ratingPeriodStart} IS NULL OR ${t.ratingPeriodEnd} IS NULL
          OR ${t.ratingPeriodEnd} >= ${t.ratingPeriodStart}`,
    ),
  ],
);

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    model: text("model").notNull(),
    /** The engine function that made the call (triage / scoreProspect / draftBid / …). */
    functionName: text("function_name").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    /** numeric(12,6), NOT the money() cents helper: a single Haiku call costs fractions of a cent. */
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }),
    ...timestamps(),
  },
  (t) => [
    index("ai_usage_org_occurred_idx").on(t.orgId, t.occurredAt),
    check(
      "ai_usage_tokens_nonneg",
      sql`${t.inputTokens} >= 0 AND ${t.outputTokens} >= 0
          AND ${t.cacheReadTokens} >= 0 AND ${t.cacheWriteTokens} >= 0`,
    ),
    check(
      "ai_usage_cost_nonneg",
      sql`${t.estimatedCostUsd} IS NULL OR ${t.estimatedCostUsd} >= 0`,
    ),
  ],
);
