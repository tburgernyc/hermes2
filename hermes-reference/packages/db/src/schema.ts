/**
 * Hermes 2.0 — Database schema (Drizzle ORM, Postgres + pgvector)
 * packages/db/schema.ts
 *
 * Phase 1 keystone. Every other phase builds on this.
 *
 * Compliance fields reflect the VERIFIED ruleset in CLAUDE.md §6 and are marked where they map to a
 * FAR/SBA rule. They are encoded as software behavior but remain PENDING COUNSEL CONFIRMATION.
 *
 * Multi-tenant: every business table carries `orgId`. Enforce tenant isolation in the data layer
 * (e.g., a withTenant() wrapper) and/or Postgres RLS. Do not rely on app code alone for isolation.
 *
 * Vector search: embeddings come from a dedicated embedding provider (e.g., Voyage AI). Anthropic models
 * do NOT produce embeddings. EMBED_DIM below must match the chosen model's output dimension.
 *
 * Prereq migration (run once): CREATE EXTENSION IF NOT EXISTS vector;
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Must match the embedding model (e.g., Voyage voyage-3 = 1024). */
const EMBED_DIM = 1024;

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["admin", "vendor"]);

export const contractType = pgEnum("contract_type", [
  "ffp", // Firm-Fixed-Price
  "tm", // Time-and-Materials (markup on materials/subs locked to 0% — CLAUDE.md §6.2)
  "ffp_milestone", // FFP with milestone/progress payment schedule
]);

export const setAsideType = pgEnum("set_aside_type", [
  "none", // full & open / unrestricted
  "total_small_business", // the only set-aside Burger Consulting may pursue today (CLAUDE.md §6.7)
  "other_restricted", // 8(a)/HUBZone/SDVOSB/WOSB — screened OUT unless certified
]);

/** Workflow state machine (PROJECT_PLAN.md §2). */
export const solicitationStatus = pgEnum("solicitation_status", [
  "pending_triage",
  "triage_complete", // recommendation only; no email, no advance
  "ready_for_sourcing", // human approved sourcing
  "awaiting_approval", // outreach drafted, waiting on human
  "sourcing_in_progress", // outreach approved + sent
  "pricing_pending", // quotes detected + ranked
  "proposal_draft", // bid drafted
  "submitted", // human submitted to agency
  "awarded",
  "closed",
  "rejected",
]);

export const vendorStatus = pgEnum("vendor_status", [
  "prospect", // discovered or tokenized submission; NEVER auto-promoted (CLAUDE.md §7)
  "pending_review",
  "vetted",
  "non_compliant", // e.g., expired COI
  "excluded", // active federal exclusion / debarment
]);

export const entityType = pgEnum("entity_type", [
  "corporate", // LLC, Inc. — Branch A
  "independent_contractor", // 1099 — Branch B
]);

export const approvalType = pgEnum("approval_type", [
  "sourcing", // approve a solicitation for sourcing
  "outreach", // approve sending outreach (THE gate — never the model score)
  "shortlist", // shortlist / advance a quote
  "bid_submission", // final human verification before submission
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const paymentTrigger = pgEnum("payment_trigger", [
  "milestone_acceptance", // paid when a defined milestone is accepted
  "percent_complete", // progress payment at % completion
  "deliverable_acceptance", // CLIN/deliverable accepted
  "final", // remainder at final completion
]);

export const milestoneStatus = pgEnum("milestone_status", [
  "pending",
  "invoiced",
  "paid",
]);

/* ------------------------------------------------------------------ */
/* Tenancy + users                                                     */
/* ------------------------------------------------------------------ */

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  uei: varchar("uei", { length: 12 }), // SAM.gov Unique Entity ID
  cageCode: varchar("cage_code", { length: 5 }), // null until CAGE finalized
  ein: varchar("ein", { length: 10 }),
  // NAICS codes the org is registered for (drives size-standard + similarly-situated checks)
  naicsCodes: jsonb("naics_codes").$type<string[]>().notNull().default([]),
  isSmallBusiness: boolean("is_small_business").notNull().default(true),
  socioEconomicCerts: jsonb("socio_economic_certs").$type<string[]>().notNull().default([]),
  samRegistrationActive: boolean("sam_registration_active").notNull().default(false),
  physicalAddress: jsonb("physical_address").$type<{
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(), // argon2/bcrypt
    role: userRole("role").notNull().default("vendor"),
    totpSecret: text("totp_secret"), // required-enrolled for admins
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    orgIdx: index("users_org_idx").on(t.orgId),
  })
);

/* ------------------------------------------------------------------ */
/* Solicitations (sourced from SAM.gov) + triage                       */
/* ------------------------------------------------------------------ */

export const solicitations = pgTable(
  "solicitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    samNoticeId: text("sam_notice_id").notNull(), // dedupe key from SAM.gov
    title: text("title").notNull(),
    agency: text("agency"),
    naicsCode: varchar("naics_code", { length: 10 }),
    setAside: setAsideType("set_aside").notNull().default("none"),
    contractType: contractType("contract_type"),
    responseDeadline: timestamp("response_deadline"),
    scopeText: text("scope_text"), // raw SOW text (treated as data, never instructions)
    scopeEmbedding: vector("scope_embedding", { dimensions: EMBED_DIM }), // semantic match
    status: solicitationStatus("status").notNull().default("pending_triage"),

    // --- AI triage output (recommendation ONLY; written by the autonomous job) ---
    feasibilityScore: integer("feasibility_score"), // 1..10
    zeroFloatFit: boolean("zero_float_fit"),
    rejectionReasons: jsonb("rejection_reasons").$type<string[]>(),
    triageModel: text("triage_model"), // e.g. claude-sonnet-4-6
    triagedAt: timestamp("triaged_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("solicitations_org_idx").on(t.orgId),
    noticeIdx: uniqueIndex("solicitations_notice_idx").on(t.orgId, t.samNoticeId),
    statusIdx: index("solicitations_status_idx").on(t.status),
    // HNSW index for cosine similarity on scope embeddings
    scopeVecIdx: index("solicitations_scope_vec_idx").using(
      "hnsw",
      t.scopeEmbedding.op("vector_cosine_ops")
    ),
  })
);

/* ------------------------------------------------------------------ */
/* Vendors (vetted) and prospects (untrusted / tokenized writes)       */
/* ------------------------------------------------------------------ */

/**
 * vendor_prospects: written by discovery jobs AND by tokenized public submissions.
 * SECURITY (CLAUDE.md §7): a tokenized submission may ONLY write here — never into `vendors`.
 */
export const vendorProspects = pgTable(
  "vendor_prospects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    companyName: text("company_name").notNull(),
    contactEmail: text("contact_email"),
    entityType: entityType("entity_type"),
    uei: varchar("uei", { length: 12 }),
    naicsCodes: jsonb("naics_codes").$type<string[]>().default([]),
    capabilityText: text("capability_text"),
    capabilityEmbedding: vector("capability_embedding", { dimensions: EMBED_DIM }),
    discoveryScore: integer("discovery_score"), // AI prospect score (recommendation)
    source: text("source"), // "discovery" | "tokenized_submission" | "manual"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("vendor_prospects_org_idx").on(t.orgId),
    capVecIdx: index("vendor_prospects_cap_vec_idx").using(
      "hnsw",
      t.capabilityEmbedding.op("vector_cosine_ops")
    ),
  })
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    userId: uuid("user_id").references(() => users.id), // account, once created
    companyName: text("company_name").notNull(),
    entityType: entityType("entity_type").notNull(),
    uei: varchar("uei", { length: 12 }),
    naicsCodes: jsonb("naics_codes").$type<string[]>().notNull().default([]),
    isSmallBusiness: boolean("is_small_business").notNull().default(false),
    socioEconomicCerts: jsonb("socio_economic_certs").$type<string[]>().default([]),

    // --- Limitations on Subcontracting support (FAR 52.219-14 / CLAUDE.md §6.1) ---
    // A vendor is "similarly situated" relative to a given solicitation when it is small under that
    // solicitation's NAICS and shares the prime's qualifying status. This boolean caches the general
    // small-business determination; the per-solicitation check is computed at bid time against the
    // solicitation's NAICS. NOTE: independent contractors (1099) CAN be similarly situated.
    smallUnderNaics: jsonb("small_under_naics").$type<string[]>().default([]),

    capabilityText: text("capability_text"),
    capabilityEmbedding: vector("capability_embedding", { dimensions: EMBED_DIM }),

    status: vendorStatus("status").notNull().default("pending_review"),
    insuranceExpiry: timestamp("insurance_expiry"), // COI; flips status to non_compliant on expiry
    excluded: boolean("excluded").notNull().default(false), // active federal exclusion/debarment
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("vendors_org_idx").on(t.orgId),
    statusIdx: index("vendors_status_idx").on(t.status),
    capVecIdx: index("vendors_cap_vec_idx").using(
      "hnsw",
      t.capabilityEmbedding.op("vector_cosine_ops")
    ),
  })
);

/* ------------------------------------------------------------------ */
/* Outreach (drafted by AI, SENT only after human approval)            */
/* ------------------------------------------------------------------ */

export const outreachMessages = pgTable(
  "outreach_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    solicitationId: uuid("solicitation_id").references(() => solicitations.id),
    prospectId: uuid("prospect_id").references(() => vendorProspects.id),
    subject: text("subject").notNull(),
    body: text("body").notNull(), // React Email autoescaped at render
    quoteToken: text("quote_token"), // signed single-purpose token -> /quote/[token]
    optoutToken: text("optout_token"), // distinct single-purpose token -> /optout/[token]
    approvalId: uuid("approval_id"), // FK set when queued for approval
    sentAt: timestamp("sent_at"), // null until approved + sent
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("outreach_org_idx").on(t.orgId) })
);

/* ------------------------------------------------------------------ */
/* Quotes (subcontractor submissions) — untrusted, AI-ranked           */
/* ------------------------------------------------------------------ */

export const vendorQuotes = pgTable(
  "vendor_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    solicitationId: uuid("solicitation_id").notNull().references(() => solicitations.id),
    prospectId: uuid("prospect_id").references(() => vendorProspects.id),
    vendorId: uuid("vendor_id").references(() => vendors.id),

    lineItems: jsonb("line_items").$type<
      { description: string; qty: number; unit: string; unitRate: string }[]
    >(),
    totalPrice: numeric("total_price", { precision: 14, scale: 2 }),
    periodOfPerformance: text("period_of_performance"),
    payWhenPaid: boolean("pay_when_paid").notNull().default(true),
    notes: text("notes"), // UNTRUSTED free text — fence as data in any AI call
    proposalDocId: uuid("proposal_doc_id"), // -> documents (magic-byte + size validated)

    // --- AI evaluation (recommendation; injection-resistant) ---
    aiRank: integer("ai_rank"),
    aiRationale: text("ai_rationale"),
    extractedAt: timestamp("extracted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("quotes_org_idx").on(t.orgId),
    solIdx: index("quotes_sol_idx").on(t.solicitationId),
  })
);

/* ------------------------------------------------------------------ */
/* Proposals (the firm's bid to the agency) + compliance               */
/* ------------------------------------------------------------------ */

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    solicitationId: uuid("solicitation_id").notNull().references(() => solicitations.id),
    winningQuoteId: uuid("winning_quote_id").references(() => vendorQuotes.id),

    contractType: contractType("contract_type").notNull(),

    // --- Pricing build-up (scenarios; human picks — CLAUDE.md §6) ---
    subcontractCost: numeric("subcontract_cost", { precision: 14, scale: 2 }),
    indirectCost: numeric("indirect_cost", { precision: 14, scale: 2 }),
    proposedFee: numeric("proposed_fee", { precision: 14, scale: 2 }),
    proposedPrice: numeric("proposed_price", { precision: 14, scale: 2 }),
    benchmarkPrice: numeric("benchmark_price", { precision: 14, scale: 2 }), // from USASpending

    // --- Compliance flags (FAR/SBA; pending counsel) ---
    // 50% Limitations on Subcontracting: share of govt payment to NON-similarly-situated subs.
    nonSimilarlySituatedShare: numeric("non_similarly_situated_share", { precision: 5, scale: 4 }),
    losCompliant: boolean("los_compliant"), // false if services set-aside and share > 0.50
    passThroughShare: numeric("pass_through_share", { precision: 5, scale: 4 }), // FAR 52.215-23 ~0.70
    realismWarning: boolean("realism_warning").notNull().default(false), // heuristic, not law
    tinaFlag: boolean("tina_flag").notNull().default(false), // over active threshold
    complianceChecklist: jsonb("compliance_checklist").$type<
      { item: string; passed: boolean; note?: string }[]
    >(),

    status: solicitationStatus("status").notNull().default("proposal_draft"),
    draftDocId: uuid("draft_doc_id"), // DOCX/PDF via code-execution + Files API
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("proposals_org_idx").on(t.orgId) })
);

/* ------------------------------------------------------------------ */
/* Contracts + milestone/progress payment schedule                     */
/* ------------------------------------------------------------------ */

export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  solicitationId: uuid("solicitation_id").references(() => solicitations.id),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  vendorId: uuid("vendor_id").references(() => vendors.id),
  contractType: contractType("contract_type").notNull(),
  awardAmount: numeric("award_amount", { precision: 14, scale: 2 }),
  payWhenPaid: boolean("pay_when_paid").notNull().default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Models "a portion on partial completion, more later, remainder at the end." */
export const contractMilestones = pgTable(
  "contract_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    sequence: integer("sequence").notNull(),
    description: text("description").notNull(),
    trigger: paymentTrigger("trigger").notNull(),
    percentComplete: integer("percent_complete"), // for percent_complete trigger
    amount: numeric("amount", { precision: 14, scale: 2 }),
    status: milestoneStatus("status").notNull().default("pending"),
    invoicedAt: timestamp("invoiced_at"),
    paidAt: timestamp("paid_at"),
  },
  (t) => ({ contractIdx: index("milestones_contract_idx").on(t.contractId) })
);

/* ------------------------------------------------------------------ */
/* Documents, intelligence, AR, approvals, audit                       */
/* ------------------------------------------------------------------ */

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  tigrisKey: text("tigris_key").notNull(), // signed-URL object key
  mimeType: text("mime_type").notNull(), // validated by magic bytes, not extension
  sizeBytes: integer("size_bytes").notNull(),
  kind: text("kind"), // "proposal" | "coi" | "w9" | "deliverable" | ...
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const awardIntelligence = pgTable("award_intelligence", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  naicsCode: varchar("naics_code", { length: 10 }),
  agency: text("agency"),
  awardedPrice: numeric("awarded_price", { precision: 14, scale: 2 }),
  awardedTo: text("awarded_to"),
  source: text("source").default("usaspending"),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export const arFollowups = pgTable("ar_followups", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  contractId: uuid("contract_id").references(() => contracts.id),
  milestoneId: uuid("milestone_id").references(() => contractMilestones.id),
  dueDate: timestamp("due_date"),
  resolved: boolean("resolved").notNull().default(false),
});

/** The human-gate queue. Outreach/sourcing/shortlist/submission all park here. */
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    type: approvalType("type").notNull(),
    entityTable: text("entity_table").notNull(), // e.g. "outreach_messages"
    entityId: uuid("entity_id").notNull(),
    status: approvalStatus("status").notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("approvals_org_idx").on(t.orgId),
    statusIdx: index("approvals_status_idx").on(t.status),
  })
);

/** Append-only. Write on EVERY autonomous action and EVERY approval. Never UPDATE/DELETE rows. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    actor: text("actor").notNull(), // userId | "system:<job>"
    isAutonomous: boolean("is_autonomous").notNull().default(false),
    action: text("action").notNull(),
    entityTable: text("entity_table"),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("audit_org_idx").on(t.orgId),
    entityIdx: index("audit_entity_idx").on(t.entityTable, t.entityId),
  })
);

/* ------------------------------------------------------------------ */
/* Relations (selected)                                                */
/* ------------------------------------------------------------------ */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  solicitations: many(solicitations),
  vendors: many(vendors),
}));

export const solicitationsRelations = relations(solicitations, ({ one, many }) => ({
  org: one(organizations, {
    fields: [solicitations.orgId],
    references: [organizations.id],
  }),
  quotes: many(vendorQuotes),
}));

export const contractsRelations = relations(contracts, ({ many }) => ({
  milestones: many(contractMilestones),
}));
