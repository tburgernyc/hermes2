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
  awardAmountKind,
  classificationSource,
  contractType,
  noticeType,
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
    status: solicitationStatus("status").notNull().default("PENDING_TRIAGE"),
    feasibilityScore: integer("feasibility_score"), // 1..10
    zeroFloatFit: zeroFloatFit("zero_float_fit"),
    rejectionReasons: jsonb("rejection_reasons").$type<string[]>(),
    triageModel: text("triage_model"),
    triagedAt: timestamp("triaged_at", { withTimezone: true, mode: "date" }),
    sourcingApprovedBy: uuid("sourcing_approved_by"),
    sourcingApprovedAt: timestamp("sourcing_approved_at", { withTimezone: true, mode: "date" }),
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
