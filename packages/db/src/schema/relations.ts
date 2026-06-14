/**
 * Drizzle query-API relations. These drive the relational query builder only — they emit no SQL and
 * do not affect migrations. Tenant scoping in queries is still enforced via withOrg() + RLS.
 */
import { relations } from "drizzle-orm";

import { auditLog, orgs, users } from "./tenancy.js";
import { awardIntelligence, solicitations } from "./sourcing.js";
import { outreachCampaigns, vendorProspects, vendors } from "./vendors.js";
import { proposals, vendorQuoteLineItems, vendorQuotes } from "./quoting.js";
import { arFollowups, contractMilestones, contracts } from "./contracting.js";
import { documents } from "./documents.js";

export const orgsRelations = relations(orgs, ({ many }) => ({
  users: many(users),
  solicitations: many(solicitations),
  vendors: many(vendors),
  vendorProspects: many(vendorProspects),
  awardIntelligence: many(awardIntelligence),
  contracts: many(contracts),
}));

export const usersRelations = relations(users, ({ one }) => ({
  org: one(orgs, { fields: [users.orgId], references: [orgs.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  org: one(orgs, { fields: [auditLog.orgId], references: [orgs.id] }),
  actor: one(users, { fields: [auditLog.actorUserId], references: [users.id] }),
}));

export const solicitationsRelations = relations(solicitations, ({ one, many }) => ({
  org: one(orgs, { fields: [solicitations.orgId], references: [orgs.id] }),
  quotes: many(vendorQuotes),
  proposals: many(proposals),
  outreachCampaigns: many(outreachCampaigns),
  contracts: many(contracts),
}));

export const awardIntelligenceRelations = relations(awardIntelligence, ({ one }) => ({
  org: one(orgs, { fields: [awardIntelligence.orgId], references: [orgs.id] }),
}));

export const vendorProspectsRelations = relations(vendorProspects, ({ one, many }) => ({
  org: one(orgs, { fields: [vendorProspects.orgId], references: [orgs.id] }),
  quotes: many(vendorQuotes),
  outreachCampaigns: many(outreachCampaigns),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  org: one(orgs, { fields: [vendors.orgId], references: [orgs.id] }),
  promotedFrom: one(vendorProspects, {
    fields: [vendors.promotedFromProspectId],
    references: [vendorProspects.id],
  }),
  quotes: many(vendorQuotes),
}));

export const outreachCampaignsRelations = relations(outreachCampaigns, ({ one }) => ({
  org: one(orgs, { fields: [outreachCampaigns.orgId], references: [orgs.id] }),
  solicitation: one(solicitations, {
    fields: [outreachCampaigns.solicitationId],
    references: [solicitations.id],
  }),
  prospect: one(vendorProspects, {
    fields: [outreachCampaigns.prospectId],
    references: [vendorProspects.id],
  }),
}));

export const vendorQuotesRelations = relations(vendorQuotes, ({ one, many }) => ({
  org: one(orgs, { fields: [vendorQuotes.orgId], references: [orgs.id] }),
  solicitation: one(solicitations, {
    fields: [vendorQuotes.solicitationId],
    references: [solicitations.id],
  }),
  vendor: one(vendors, { fields: [vendorQuotes.vendorId], references: [vendors.id] }),
  prospect: one(vendorProspects, {
    fields: [vendorQuotes.prospectId],
    references: [vendorProspects.id],
  }),
  lineItems: many(vendorQuoteLineItems),
}));

export const vendorQuoteLineItemsRelations = relations(vendorQuoteLineItems, ({ one }) => ({
  quote: one(vendorQuotes, {
    fields: [vendorQuoteLineItems.quoteId],
    references: [vendorQuotes.id],
  }),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  org: one(orgs, { fields: [proposals.orgId], references: [orgs.id] }),
  solicitation: one(solicitations, {
    fields: [proposals.solicitationId],
    references: [solicitations.id],
  }),
  selectedQuote: one(vendorQuotes, {
    fields: [proposals.selectedQuoteId],
    references: [vendorQuotes.id],
  }),
  awardedVendor: one(vendors, { fields: [proposals.awardedVendorId], references: [vendors.id] }),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  org: one(orgs, { fields: [contracts.orgId], references: [orgs.id] }),
  solicitation: one(solicitations, {
    fields: [contracts.solicitationId],
    references: [solicitations.id],
  }),
  proposal: one(proposals, { fields: [contracts.proposalId], references: [proposals.id] }),
  awardedVendor: one(vendors, { fields: [contracts.awardedVendorId], references: [vendors.id] }),
  milestones: many(contractMilestones),
}));

export const contractMilestonesRelations = relations(contractMilestones, ({ one, many }) => ({
  contract: one(contracts, {
    fields: [contractMilestones.contractId],
    references: [contracts.id],
  }),
  followups: many(arFollowups),
}));

export const arFollowupsRelations = relations(arFollowups, ({ one }) => ({
  contract: one(contracts, { fields: [arFollowups.contractId], references: [contracts.id] }),
  milestone: one(contractMilestones, {
    fields: [arFollowups.milestoneId],
    references: [contractMilestones.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  org: one(orgs, { fields: [documents.orgId], references: [orgs.id] }),
}));
