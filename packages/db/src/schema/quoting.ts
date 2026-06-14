/**
 * Quoting cluster: vendor_quotes (subcontractor submissions; vendor XOR prospect), the normalized
 * vendor_quote_line_items (FAR pricing math is computed, not displayed), and proposals (the firm's
 * bid draft). Load-bearing CHECKs: quote party XOR, T&M markup lock (§6.2), no-auto-submit (§6.6).
 */
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
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
  contractType,
  costType,
  proposalStatus,
  quoteStatus,
  smallBusinessStatus,
} from "./enums.js";
import { money, timestamps, uuidPk } from "./_shared.js";
import { orgs, users } from "./tenancy.js";
import { solicitations } from "./sourcing.js";
import { vendorProspects, vendors } from "./vendors.js";

export const vendorQuotes = pgTable(
  "vendor_quotes",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    solicitationId: uuid("solicitation_id").notNull(),
    /** XOR: exactly one of vendor_id / prospect_id (the structural trust boundary — CHECK below). */
    vendorId: uuid("vendor_id"),
    prospectId: uuid("prospect_id"),
    tokenJti: text("token_jti"), // replay guard for tokenized submissions (unique per org)
    status: quoteStatus("status").notNull().default("INVITED"),
    totalPrice: money("total_price"),
    periodOfPerformance: text("period_of_performance"),
    payWhenPaid: boolean("pay_when_paid").notNull().default(true),
    notes: text("notes"), // UNTRUSTED free text — fence as data in any AI call
    aiRank: integer("ai_rank"),
    aiRationale: text("ai_rationale"),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    unique("vendor_quotes_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("vendor_quotes_jti_key")
      .on(t.orgId, t.tokenJti)
      .where(sql`${t.tokenJti} IS NOT NULL`),
    foreignKey({
      name: "vendor_quotes_solicitation_fk",
      columns: [t.orgId, t.solicitationId],
      foreignColumns: [solicitations.orgId, solicitations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "vendor_quotes_vendor_fk",
      columns: [t.orgId, t.vendorId],
      foreignColumns: [vendors.orgId, vendors.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "vendor_quotes_prospect_fk",
      columns: [t.orgId, t.prospectId],
      foreignColumns: [vendorProspects.orgId, vendorProspects.id],
    }).onDelete("restrict"),
    index("vendor_quotes_org_idx").on(t.orgId),
    index("vendor_quotes_solicitation_idx").on(t.solicitationId),
    index("vendor_quotes_vendor_idx").on(t.vendorId).where(sql`${t.vendorId} IS NOT NULL`),
    index("vendor_quotes_prospect_idx").on(t.prospectId).where(sql`${t.prospectId} IS NOT NULL`),
    // Exactly one party. Token-submitted quotes are always prospect-linked (vendor_id IS NULL).
    check(
      "vendor_quotes_party_xor",
      sql`(${t.vendorId} IS NOT NULL) <> (${t.prospectId} IS NOT NULL)`,
    ),
    check("vendor_quotes_total_nonneg", sql`${t.totalPrice} IS NULL OR ${t.totalPrice} >= 0`),
  ],
);

export const vendorQuoteLineItems = pgTable(
  "vendor_quote_line_items",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").notNull(),
    costType: costType("cost_type").notNull(),
    /** Denormalized from the quote's solicitation; kept in sync by a Stage-2 trigger. Drives §6.2. */
    contractType: contractType("contract_type").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
    unitRate: money("unit_rate").notNull(),
    markupPct: numeric("markup_pct", { precision: 6, scale: 4 }).notNull().default("0"),
    extendedAmount: money("extended_amount"),
    /** FAR 52.219-14 inputs (per-line: a sub may be similarly situated on some scope only). */
    similarlySituated: boolean("similarly_situated"),
    subSmallBusinessStatus: smallBusinessStatus("sub_small_business_status"),
    subSubcontractNaics: varchar("sub_subcontract_naics", { length: 6 }),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "line_items_quote_fk",
      columns: [t.orgId, t.quoteId],
      foreignColumns: [vendorQuotes.orgId, vendorQuotes.id],
    }).onDelete("cascade"),
    index("line_items_quote_idx").on(t.quoteId),
    // T&M markup lock (CLAUDE.md §6.2): under TM, MATERIAL/SUBCONTRACT carry 0% markup.
    check(
      "line_items_tm_markup_lock",
      sql`NOT (${t.contractType} = 'TM' AND ${t.costType} IN ('MATERIAL','SUBCONTRACT') AND ${t.markupPct} <> 0)`,
    ),
    check("line_items_qty_pos", sql`${t.quantity} > 0`),
    check("line_items_rate_nonneg", sql`${t.unitRate} >= 0`),
    check("line_items_markup_nonneg", sql`${t.markupPct} >= 0`),
    check(
      "line_items_sub_naics_format",
      sql`${t.subSubcontractNaics} IS NULL OR ${t.subSubcontractNaics} ~ '^[0-9]{6}$'`,
    ),
    // A line cannot claim similarly-situated status unless the sub is declared SMALL (FAR 52.219-14).
    check(
      "line_items_sim_situated_consistency",
      sql`NOT (${t.similarlySituated} IS TRUE AND ${t.subSmallBusinessStatus} IS DISTINCT FROM 'SMALL')`,
    ),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    solicitationId: uuid("solicitation_id").notNull(),
    selectedQuoteId: uuid("selected_quote_id"),
    awardedVendorId: uuid("awarded_vendor_id"),
    supersedesProposalId: uuid("supersedes_proposal_id"), // version lineage
    contractType: contractType("contract_type").notNull(),
    status: proposalStatus("status").notNull().default("DRAFT"),
    /** Scenarios for the human to choose — never a single authoritative number (CLAUDE.md §6). */
    pricingScenarios: jsonb("pricing_scenarios"),
    complianceChecklist: jsonb("compliance_checklist"),
    // --- FAR 52.219-14 Limitations on Subcontracting substrate ---
    primeQualifyingStatus: smallBusinessStatus("prime_qualifying_status"),
    primeQualifyingNaics: varchar("prime_qualifying_naics", { length: 6 }),
    governmentPaymentBasis: money("government_payment_basis"), // 50% denominator
    nonSimilarlySituatedSubsTotal: money("non_similarly_situated_subs_total"), // 50% numerator
    totalCostOfWork: money("total_cost_of_work"), // pass-through denominator (FAR 52.215-23)
    adequatePriceCompetition: boolean("adequate_price_competition"), // TINA exception (§6.4)
    passThroughJustification: text("pass_through_justification"),
    // --- Human gate / counsel (no auto-submit — CLAUDE.md §6.6) ---
    submittedBy: uuid("submitted_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    counselReviewedBy: uuid("counsel_reviewed_by"),
    counselReviewedAt: timestamp("counsel_reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    unique("proposals_org_id_id_key").on(t.orgId, t.id),
    foreignKey({
      name: "proposals_solicitation_fk",
      columns: [t.orgId, t.solicitationId],
      foreignColumns: [solicitations.orgId, solicitations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "proposals_selected_quote_fk",
      columns: [t.orgId, t.selectedQuoteId],
      foreignColumns: [vendorQuotes.orgId, vendorQuotes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "proposals_awarded_vendor_fk",
      columns: [t.orgId, t.awardedVendorId],
      foreignColumns: [vendors.orgId, vendors.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "proposals_supersedes_fk",
      columns: [t.orgId, t.supersedesProposalId],
      foreignColumns: [t.orgId, t.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "proposals_submitted_by_fk",
      columns: [t.orgId, t.submittedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "proposals_counsel_by_fk",
      columns: [t.orgId, t.counselReviewedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("proposals_org_idx").on(t.orgId),
    index("proposals_solicitation_idx").on(t.solicitationId),
    // No auto-submit: SUBMITTED/WON/LOST require a human submitter + timestamp AND counsel review.
    check(
      "proposals_submit_requires_human",
      sql`${t.status} NOT IN ('SUBMITTED','WON','LOST') OR (${t.submittedBy} IS NOT NULL AND ${t.submittedAt} IS NOT NULL)`,
    ),
    check(
      "proposals_submit_requires_counsel",
      sql`${t.status} NOT IN ('SUBMITTED','WON','LOST') OR (${t.counselReviewedBy} IS NOT NULL AND ${t.counselReviewedAt} IS NOT NULL)`,
    ),
    // FAR 52.219-14 numerator/denominator and pass-through basis are non-negative money.
    check(
      "proposals_gov_payment_nonneg",
      sql`${t.governmentPaymentBasis} IS NULL OR ${t.governmentPaymentBasis} >= 0`,
    ),
    check(
      "proposals_non_sim_subs_nonneg",
      sql`${t.nonSimilarlySituatedSubsTotal} IS NULL OR ${t.nonSimilarlySituatedSubsTotal} >= 0`,
    ),
    check(
      "proposals_total_cost_nonneg",
      sql`${t.totalCostOfWork} IS NULL OR ${t.totalCostOfWork} >= 0`,
    ),
  ],
);
