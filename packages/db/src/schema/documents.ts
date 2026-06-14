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
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { documentEntityType, documentKind } from "./enums.js";
import { timestamps, uuidPk } from "./_shared.js";
import { orgs } from "./tenancy.js";
import { solicitations } from "./sourcing.js";
import { vendorProspects, vendors } from "./vendors.js";
import { proposals, vendorQuotes } from "./quoting.js";
import { contractMilestones, contracts } from "./contracting.js";

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
    kind: documentKind("kind").notNull().default("OTHER"),
    storageKey: text("storage_key").notNull(), // Tigris object key (NOT a URL)
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: varchar("sha256", { length: 64 }),
    magicByteValidated: boolean("magic_byte_validated").notNull().default(false),
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
    index("documents_org_idx").on(t.orgId),
    index("documents_entity_idx").on(t.entityType),
    check("documents_byte_size_pos", sql`${t.byteSize} > 0`),
    check("documents_sha256_format", sql`${t.sha256} IS NULL OR ${t.sha256} ~ '^[a-f0-9]{64}$'`),
    // Exactly one owner column is set.
    check(
      "documents_owner_exactly_one",
      sql`(
        (CASE WHEN ${t.solicitationId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.vendorId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.prospectId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.quoteId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.proposalId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.contractId} IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN ${t.milestoneId} IS NOT NULL THEN 1 ELSE 0 END)
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
        OR (${t.entityType} = 'CONTRACT_MILESTONE' AND ${t.milestoneId} IS NOT NULL)`,
    ),
  ],
);
