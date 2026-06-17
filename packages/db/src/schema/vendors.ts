/**
 * Vendor cluster: vendor_prospects (untrusted, tokenized-write target), vendors (vetted), and
 * outreach_campaigns (drafted by AI, SENT only after a human approval — CLAUDE.md §2 Prime Directive).
 * SECURITY (§7): the token role may write ONLY vendor_prospects (+ prospect-scoped quotes/documents),
 * never vendors. Promotion lineage is one-directional: vendors.promoted_from_prospect_id.
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
  outreachStatus,
  outreachStep,
  prospectSource,
  prospectStatus,
  smallBusinessStatus,
  vendorStatus,
} from "./enums.js";
import { embedding, timestamps, uuidPk } from "./_shared.js";
import { orgs, users } from "./tenancy.js";
import { solicitations } from "./sourcing.js";

export const vendorProspects = pgTable(
  "vendor_prospects",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    companyName: text("company_name").notNull(),
    contactEmail: text("contact_email"), // token upsert key (per org, case-insensitive)
    uei: varchar("uei", { length: 12 }),
    naicsCodes: jsonb("naics_codes").$type<string[]>().notNull().default([]),
    capabilitiesText: text("capabilities_text"),
    capabilityEmbedding: embedding("capability_embedding"),
    discoveryScore: integer("discovery_score"), // 1..100 AI prospect score (recommendation)
    prospectSource: prospectSource("prospect_source").notNull().default("DISCOVERY"),
    status: prospectStatus("status").notNull().default("NEW"),
    ...timestamps(),
  },
  (t) => [
    unique("vendor_prospects_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("vendor_prospects_email_key")
      .on(t.orgId, sql`lower(${t.contactEmail})`)
      .where(sql`${t.contactEmail} IS NOT NULL`),
    index("vendor_prospects_org_idx").on(t.orgId),
    index("vendor_prospects_cap_vec_idx").using(
      "hnsw",
      t.capabilityEmbedding.op("vector_cosine_ops"),
    ),
    check(
      "vendor_prospects_score_range",
      sql`${t.discoveryScore} IS NULL OR (${t.discoveryScore} BETWEEN 1 AND 100)`,
    ),
    check("vendor_prospects_uei_format", sql`${t.uei} IS NULL OR ${t.uei} ~ '^[A-Z0-9]{12}$'`),
  ],
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    /** Promotion lineage: the prospect this vetted vendor was created from (1:1, unique). */
    promotedFromProspectId: uuid("promoted_from_prospect_id"),
    companyName: text("company_name").notNull(),
    contactEmail: text("contact_email"),
    uei: varchar("uei", { length: 12 }),
    cageCode: varchar("cage_code", { length: 5 }),
    smallBusinessStatus: smallBusinessStatus("small_business_status").notNull().default("UNKNOWN"),
    /** General similarly-situated cache; the per-solicitation determination is computed at bid time. */
    similarlySituated: boolean("similarly_situated"),
    smallUnderNaics: jsonb("small_under_naics").$type<string[]>().notNull().default([]),
    capabilitiesText: text("capabilities_text"),
    capabilityEmbedding: embedding("capability_embedding"),
    status: vendorStatus("status").notNull().default("PENDING_REVIEW"),
    vettedBy: uuid("vetted_by"),
    vettedAt: timestamp("vetted_at", { withTimezone: true, mode: "date" }),
    insuranceExpiry: timestamp("insurance_expiry", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    unique("vendors_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("vendors_promoted_from_key")
      .on(t.orgId, t.promotedFromProspectId)
      .where(sql`${t.promotedFromProspectId} IS NOT NULL`),
    foreignKey({
      name: "vendors_prospect_fk",
      columns: [t.orgId, t.promotedFromProspectId],
      foreignColumns: [vendorProspects.orgId, vendorProspects.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "vendors_vetted_by_fk",
      columns: [t.orgId, t.vettedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("vendors_org_idx").on(t.orgId),
    index("vendors_status_idx").on(t.status),
    index("vendors_cap_vec_idx").using("hnsw", t.capabilityEmbedding.op("vector_cosine_ops")),
    check("vendors_uei_format", sql`${t.uei} IS NULL OR ${t.uei} ~ '^[A-Z0-9]{12}$'`),
    check("vendors_cage_format", sql`${t.cageCode} IS NULL OR ${t.cageCode} ~ '^[A-Z0-9]{5}$'`),
    check(
      "vendors_vetted_requires_vetter",
      sql`${t.status} <> 'VETTED' OR (${t.vettedBy} IS NOT NULL AND ${t.vettedAt} IS NOT NULL)`,
    ),
  ],
);

export const outreachCampaigns = pgTable(
  "outreach_campaigns",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    solicitationId: uuid("solicitation_id").notNull(),
    prospectId: uuid("prospect_id").notNull(),
    step: outreachStep("step").notNull().default("DAY_0"),
    status: outreachStatus("status").notNull().default("DRAFT"),
    subject: text("subject").notNull(),
    body: text("body").notNull(), // React Email autoescaped at render
    /** HMAC-SHA-256 token hashes (keyed by TOKEN_SIGNING_SECRET); raw tokens are never stored. */
    quoteTokenHash: text("quote_token_hash"),
    quoteTokenExpiresAt: timestamp("quote_token_expires_at", { withTimezone: true, mode: "date" }),
    optoutTokenHash: text("optout_token_hash"),
    optoutTokenExpiresAt: timestamp("optout_token_expires_at", { withTimezone: true, mode: "date" }),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "outreach_solicitation_fk",
      columns: [t.orgId, t.solicitationId],
      foreignColumns: [solicitations.orgId, solicitations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "outreach_prospect_fk",
      columns: [t.orgId, t.prospectId],
      foreignColumns: [vendorProspects.orgId, vendorProspects.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "outreach_approved_by_fk",
      columns: [t.orgId, t.approvedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    uniqueIndex("outreach_quote_token_key")
      .on(t.quoteTokenHash)
      .where(sql`${t.quoteTokenHash} IS NOT NULL`),
    uniqueIndex("outreach_optout_token_key")
      .on(t.optoutTokenHash)
      .where(sql`${t.optoutTokenHash} IS NOT NULL`),
    index("outreach_org_idx").on(t.orgId),
    index("outreach_solicitation_idx").on(t.solicitationId),
    index("outreach_prospect_idx").on(t.prospectId),
    // Human gate: approved/sent states require a recorded approver + timestamp.
    check(
      "outreach_approval_gate",
      sql`${t.status} NOT IN ('APPROVED','SENT','RESPONDED','OPTED_OUT') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check("outreach_sent_requires_timestamp", sql`${t.status} <> 'SENT' OR ${t.sentAt} IS NOT NULL`),
    // Token hash and its expiry are set together or both null.
    check(
      "outreach_quote_token_expiry",
      sql`(${t.quoteTokenHash} IS NULL) = (${t.quoteTokenExpiresAt} IS NULL)`,
    ),
    check(
      "outreach_optout_token_expiry",
      sql`(${t.optoutTokenHash} IS NULL) = (${t.optoutTokenExpiresAt} IS NULL)`,
    ),
  ],
);

/**
 * VENDOR_INVITE onboarding tokens (Phase-6 portal). An admin mints a signed, single-purpose,
 * vendor-scoped token for an already-VETTED vendor (apps/web admin action); the vendor visits
 * /invite/[token], sets a password, and a NEW VENDOR-role user is created pre-linked to that vendor.
 * SECURITY (§7): only the HMAC-SHA-256 token HASH is stored (never the raw token — the live token
 * reaches the invitee only via the copyable link). `token_jti` + the conditional `accepted_at IS NULL`
 * claim make the invite single-use; `accepted_at`/`accepted_user_id` are set together when claimed.
 * One vendor : N users — a vendor may be invited more than once (distinct users).
 */
export const vendorInvites = pgTable(
  "vendor_invites",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id").notNull(),
    invitedEmail: text("invited_email").notNull(),
    /** HMAC-SHA-256 hash of the minted token (keyed by TOKEN_SIGNING_SECRET); raw token never stored. */
    tokenHash: text("token_hash").notNull(),
    tokenJti: text("token_jti").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    acceptedUserId: uuid("accepted_user_id"),
    createdBy: uuid("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [
    // The invite's vendor must be in the SAME org (cross-tenant invite is structurally impossible).
    foreignKey({
      name: "vendor_invites_vendor_fk",
      columns: [t.orgId, t.vendorId],
      foreignColumns: [vendors.orgId, vendors.id],
    }).onDelete("restrict"),
    // The minting admin (history preserved — RESTRICT).
    foreignKey({
      name: "vendor_invites_created_by_fk",
      columns: [t.orgId, t.createdBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    // The user created on accept (nullable until claimed; same-org by the composite FK).
    foreignKey({
      name: "vendor_invites_accepted_user_fk",
      columns: [t.orgId, t.acceptedUserId],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    uniqueIndex("vendor_invites_jti_key").on(t.orgId, t.tokenJti),
    uniqueIndex("vendor_invites_token_hash_key").on(t.tokenHash),
    index("vendor_invites_org_idx").on(t.orgId),
    index("vendor_invites_vendor_idx").on(t.orgId, t.vendorId),
    // accepted_at and accepted_user_id are set together (claimed) or both null (pending).
    check(
      "vendor_invites_accept_pair",
      sql`(${t.acceptedAt} IS NULL) = (${t.acceptedUserId} IS NULL)`,
    ),
  ],
);
