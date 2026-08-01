/**
 * documents: a single leaf table that OWNS its relationship to exactly one parent (entity_type
 * discriminator + one non-null owner FK). Stores a Tigris object key (not a URL). Magic-byte/size
 * validation is recorded here; the SSRF/upload guards live in packages/core (Phase 5).
 */
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { documentEntityType, documentKind } from "./enums.js";
import { timestamps, uuidPk } from "./_shared.js";
import { orgs, users } from "./tenancy.js";
import { solicitations } from "./sourcing.js";
import { vendorProspects, vendors } from "./vendors.js";
import { proposals, vendorQuotes } from "./quoting.js";
import { contractMilestones, contracts } from "./contracting.js";
import { teamingAgreements } from "./teaming.js";
import { businessInsurancePolicies } from "./firm-compliance.js";

export const documents = pgTable(
  "documents",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    entityType: documentEntityType("entity_type").notNull(),
    solicitationId: uuid("solicitation_id"),
    vendorId: uuid("vendor_id"),
    prospectId: uuid("prospect_id"),
    quoteId: uuid("quote_id"),
    proposalId: uuid("proposal_id"),
    contractId: uuid("contract_id"),
    milestoneId: uuid("milestone_id"),
    // O3 owner columns (§3.4 / §3.7.2): the two new parents join the exactly-one-owner XOR below.
    teamingAgreementId: uuid("teaming_agreement_id"),
    insurancePolicyId: uuid("insurance_policy_id"),
    kind: documentKind("kind").notNull().default("OTHER"),
    storageKey: text("storage_key").notNull(), // Tigris object key (NOT a URL)
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: varchar("sha256", { length: 64 }),
    magicByteValidated: boolean("magic_byte_validated").notNull().default(false),
    /**
     * §3.7.3 retention window. NO automatic deletion anywhere (Prime Directive §2): expiry only
     * SURFACES the row for admin review; retention_reviewed_by/at record that human confirmation.
     */
    retentionUntil: timestamp("retention_until", { withTimezone: true, mode: "date" }),
    retentionReviewedBy: uuid("retention_reviewed_by"),
    retentionReviewedAt: timestamp("retention_reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "documents_solicitation_fk",
      columns: [t.orgId, t.solicitationId],
      foreignColumns: [solicitations.orgId, solicitations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "documents_vendor_fk",
      columns: [t.orgId, t.vendorId],
      foreignColumns: [vendors.orgId, vendors.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "documents_prospect_fk",
      columns: [t.orgId, t.prospectId],
      foreignColumns: [vendorProspects.orgId, vendorProspects.id],
    }).onDelete("cascade"),
    // Legal/financial artifacts: RESTRICT so deleting a parent cannot silently erase a quote PDF,
    // a final proposal, a signed contract, or a milestone deliverable (no-history-erasure doctrine).
    foreignKey({
      name: "documents_quote_fk",
      columns: [t.orgId, t.quoteId],
      foreignColumns: [vendorQuotes.orgId, vendorQuotes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "documents_proposal_fk",
      columns: [t.orgId, t.proposalId],
      foreignColumns: [proposals.orgId, proposals.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "documents_contract_fk",
      columns: [t.orgId, t.contractId],
      foreignColumns: [contracts.orgId, contracts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "documents_milestone_fk",
      columns: [t.orgId, t.milestoneId],
      foreignColumns: [contractMilestones.orgId, contractMilestones.id],
    }).onDelete("restrict"),
    // Legal/financial artifacts (a teaming agreement, the firm's own insurance docs): RESTRICT.
    foreignKey({
      name: "documents_teaming_agreement_fk",
      columns: [t.orgId, t.teamingAgreementId],
      foreignColumns: [teamingAgreements.orgId, teamingAgreements.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "documents_insurance_policy_fk",
      columns: [t.orgId, t.insurancePolicyId],
      foreignColumns: [businessInsurancePolicies.orgId, businessInsurancePolicies.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "documents_retention_reviewer_fk",
      columns: [t.orgId, t.retentionReviewedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("documents_org_idx").on(t.orgId),
    index("documents_entity_idx").on(t.entityType),
    check("documents_byte_size_pos", sql`${t.byteSize} > 0`),
    check("documents_sha256_format", sql`${t.sha256} IS NULL OR ${t.sha256} ~ '^[a-f0-9]{64}$'`),
    // Retention review is recorded whole (who + when) or not at all.
    check(
      "documents_retention_review_pair",
      sql`(${t.retentionReviewedBy} IS NULL) = (${t.retentionReviewedAt} IS NULL)`,
    ),
    // Exactly one owner column is set (O3: rewritten ONCE for all 9 owners).
    //
    // MIGRATION NOTE (PG16 enum hazard — CLAUDE.md Phase-6 PR-I): the matches-type CHECK below
    // references the enum labels TEAMING_AGREEMENT / INSURANCE_POLICY that Phase A ADDs to the
    // pre-existing document_entity_type via ALTER TYPE ADD VALUE. A value added to an EXISTING
    // enum cannot be USED in the same transaction, and the drizzle migrator runs every pending
    // migration in ONE transaction — so BOTH owner CHECK rewrites are stripped from the generated
    // migration and applied by MANUAL migration 0012 (a separate transaction, after the drizzle
    // batch commits). These expressions are still the source of truth for drizzle-kit snapshots.
    check(
      "documents_owner_exactly_one",
      sql`(
        (CASE WHEN ${t.solicitationId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.vendorId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.prospectId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.quoteId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.proposalId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.contractId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.milestoneId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.teamingAgreementId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.insurancePolicyId} IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1`,
    ),
    // The set owner column is consistent with the entity_type discriminator.
    check(
      "documents_owner_matches_type",
      sql`(${t.entityType} = 'SOLICITATION' AND ${t.solicitationId} IS NOT NULL)
        OR (${t.entityType} = 'VENDOR' AND ${t.vendorId} IS NOT NULL)
        OR (${t.entityType} = 'VENDOR_PROSPECT' AND ${t.prospectId} IS NOT NULL)
        OR (${t.entityType} = 'VENDOR_QUOTE' AND ${t.quoteId} IS NOT NULL)
        OR (${t.entityType} = 'PROPOSAL' AND ${t.proposalId} IS NOT NULL)
        OR (${t.entityType} = 'CONTRACT' AND ${t.contractId} IS NOT NULL)
        OR (${t.entityType} = 'CONTRACT_MILESTONE' AND ${t.milestoneId} IS NOT NULL)
        OR (${t.entityType} = 'TEAMING_AGREEMENT' AND ${t.teamingAgreementId} IS NOT NULL)
        OR (${t.entityType} = 'INSURANCE_POLICY' AND ${t.insurancePolicyId} IS NOT NULL)`,
    ),
  ],
);
