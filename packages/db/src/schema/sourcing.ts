/**
 * Sourcing cluster: solicitations (the workflow state-machine spine, sourced from SAM.gov) and
 * award_intelligence (USASpending benchmark cache). AI triage output is recommendation-only; the
 * post-approval states require a recorded human approver (CHECK + Stage-2 transition trigger).
 */
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import {
  aiRecommendation,
  awardAmountKind,
  classificationSource,
  contractType,
  dealRole,
  noticeType,
  protestStatus,
  rfiTrackStatus,
  setAsideType,
  solicitationStatus,
  zeroFloatFit,
} from "./enums.js";
import { embedding, money, timestamps, uuidPk } from "./_shared.js";
import { orgs, users } from "./tenancy.js";

export const solicitations = pgTable(
  "solicitations",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    noticeId: text("notice_id").notNull(), // SAM.gov dedupe key
    title: text("title").notNull(),
    agency: text("agency"),
    naicsCode: varchar("naics_code", { length: 6 }),
    pscCode: varchar("psc_code", { length: 4 }),
    noticeType: noticeType("notice_type"),
    setAsideType: setAsideType("set_aside_type").notNull().default("NONE"),
    contractType: contractType("contract_type"),
    /** NULL ⇒ unclassified ⇒ FAR 52.219-14 services test cannot run ⇒ block (see is_services_source). */
    isServices: boolean("is_services"),
    isServicesSource: classificationSource("is_services_source"),
    isDefense: boolean("is_defense").notNull().default(false), // TINA threshold selector
    responseDeadline: timestamp("response_deadline", { withTimezone: true, mode: "date" }),
    scopeText: text("scope_text"), // raw SOW text — treated as data, never instructions
    scopeEmbedding: embedding("scope_embedding"),
    /** Untrusted-input defense: injection attempts the AI layer detected in submitted quote/scope text. */
    quoteInjectionAttempts: jsonb("quote_injection_attempts"),
    status: solicitationStatus("status").notNull().default("PENDING_TRIAGE"),
    feasibilityScore: integer("feasibility_score"), // 1..10
    zeroFloatFit: zeroFloatFit("zero_float_fit"),
    rejectionReasons: jsonb("rejection_reasons").$type<string[]>(),
    triageModel: text("triage_model"),
    triageSummary: text("triage_summary"),
    triageRecommendation: aiRecommendation("triage_recommendation"),
    triagedAt: timestamp("triaged_at", { withTimezone: true, mode: "date" }),
    sourcingApprovedBy: uuid("sourcing_approved_by"),
    sourcingApprovedAt: timestamp("sourcing_approved_at", { withTimezone: true, mode: "date" }),
    /** §3.4: which side of the deal the firm is on. PRIME = the existing pipeline, unchanged. */
    dealRole: dealRole("deal_role").notNull().default("PRIME"),
    // --- §3.1 government-award outcome block (recorded by a HUMAN — the outcome gate CHECK) ---
    awardedPiid: text("awarded_piid"), // OUR award's contract number/PIID (O5 naming)
    awardedValue: money("awarded_value"),
    awardDate: timestamp("award_date", { withTimezone: true, mode: "date" }),
    /** Contracting-officer contact {name,email,phone} — shape validated at the app boundary. */
    coContact: jsonb("co_contact").$type<{ name?: string; email?: string; phone?: string }>(),
    debriefRequested: boolean("debrief_requested").notNull().default(false),
    debriefNotes: text("debrief_notes"),
    protestStatus: protestStatus("protest_status").notNull().default("NONE"),
    protestNotes: text("protest_notes"),
    outcomeNotes: text("outcome_notes"), // loss reason / cancellation context (§3.1.2)
    outcomeRecordedBy: uuid("outcome_recorded_by"),
    outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true, mode: "date" }),
    // --- §3.8.1 sources-sought/RFI capture track (independent axis; NULL = not on the track) ---
    rfiTrackStatus: rfiTrackStatus("rfi_track_status"),
    /** Set on the NEW pursuit created when an RFI-track notice converts (lineage, §3.8.1). */
    convertedFromSolicitationId: uuid("converted_from_solicitation_id"),
    // --- §3.8.3 Section L/M compliance-matrix extraction (informative only — never a gate) ---
    lmComplianceMatrix: jsonb("lm_compliance_matrix"),
    lmExtractedAt: timestamp("lm_extracted_at", { withTimezone: true, mode: "date" }),
    lmExtractionModel: text("lm_extraction_model"),
    ...timestamps(),
  },
  (t) => [
    unique("solicitations_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("solicitations_notice_key").on(t.orgId, t.noticeId),
    foreignKey({
      name: "solicitations_sourcing_approver_fk",
      columns: [t.orgId, t.sourcingApprovedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "solicitations_outcome_recorder_fk",
      columns: [t.orgId, t.outcomeRecordedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    // RFI-track conversion lineage (self-FK, same org — mirrors proposals_supersedes_fk).
    foreignKey({
      name: "solicitations_converted_from_fk",
      columns: [t.orgId, t.convertedFromSolicitationId],
      foreignColumns: [t.orgId, t.id],
    }).onDelete("restrict"),
    index("solicitations_org_idx").on(t.orgId),
    index("solicitations_status_idx").on(t.status),
    index("solicitations_scope_vec_idx").using("hnsw", t.scopeEmbedding.op("vector_cosine_ops")),
    check(
      "solicitations_feasibility_range",
      sql`${t.feasibilityScore} IS NULL OR (${t.feasibilityScore} BETWEEN 1 AND 10)`,
    ),
    check("solicitations_naics_format", sql`${t.naicsCode} IS NULL OR ${t.naicsCode} ~ '^[0-9]{6}$'`),
    // Human gate: post-approval states require a recorded human approver + timestamp.
    check(
      "solicitations_sourcing_gate",
      sql`${t.status} NOT IN ('READY_FOR_SOURCING','AWAITING_APPROVAL','SOURCING_IN_PROGRESS','PRICING_PENDING','PROPOSAL_DRAFT','SUBMITTED','AWARDED')
          OR (${t.sourcingApprovedBy} IS NOT NULL AND ${t.sourcingApprovedAt} IS NOT NULL)`,
    ),
    // Provenance pairing: a non-null classification must record its source.
    check(
      "solicitations_is_services_provenance",
      sql`${t.isServices} IS NULL OR ${t.isServicesSource} IS NOT NULL`,
    ),
    check(
      "solicitations_awarded_value_nonneg",
      sql`${t.awardedValue} IS NULL OR ${t.awardedValue} >= 0`,
    ),
    // §3.1 human gate (O6, mirrors solicitations_sourcing_gate): the post-submission outcome states
    // require a recorded human + timestamp. Verified via full-repo grep (2026-08-01): NOTHING writes
    // AWARDED/REJECTED/CLOSED today (the only console status write is NO_GO), so gating all three
    // outcome states breaks no existing path. NO_GO (pre-submission triage rejection) stays ungated.
    check(
      "solicitations_outcome_gate",
      sql`${t.status} NOT IN ('AWARDED','REJECTED','CLOSED')
          OR (${t.outcomeRecordedBy} IS NOT NULL AND ${t.outcomeRecordedAt} IS NOT NULL)`,
    ),
    // §3.8.3 provenance pairing: a stored L/M matrix must record when + which model extracted it.
    check(
      "solicitations_lm_provenance",
      sql`${t.lmComplianceMatrix} IS NULL
          OR (${t.lmExtractedAt} IS NOT NULL AND ${t.lmExtractionModel} IS NOT NULL)`,
    ),
  ],
);

/** USASpending award benchmark cache (read-only reference for the pricing decision brief). */
export const awardIntelligence = pgTable(
  "award_intelligence",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    piid: text("piid"),
    awardUniqueKey: text("award_unique_key").notNull(),
    naicsCode: varchar("naics_code", { length: 6 }),
    agency: text("agency"),
    recipient: text("recipient"),
    awardAmount: money("award_amount"),
    awardAmountKind: awardAmountKind("award_amount_kind").notNull().default("UNKNOWN"),
    raw: jsonb("raw"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("award_intel_unique_key").on(t.orgId, t.awardUniqueKey),
    index("award_intel_naics_idx").on(t.naicsCode),
    check("award_intel_amount_nonneg", sql`${t.awardAmount} IS NULL OR ${t.awardAmount} >= 0`),
  ],
);
