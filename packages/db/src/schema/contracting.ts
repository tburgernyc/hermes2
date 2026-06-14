/**
 * Contracting cluster: contracts (award + e-sign tracking), contract_milestones (progress/milestone
 * payment schedule — CLAUDE.md §6 contract types), and ar_followups (accounts-receivable chasing).
 * Milestones cascade from their contract; ar_followups RESTRICT so payment history is never erased.
 */
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import {
  arFollowupStatus,
  contractStatus,
  contractType,
  esignStatus,
  milestoneStatus,
} from "./enums.js";
import { money, timestamps, uuidPk } from "./_shared.js";
import { orgs } from "./tenancy.js";
import { solicitations } from "./sourcing.js";
import { vendors } from "./vendors.js";
import { proposals } from "./quoting.js";

export const contracts = pgTable(
  "contracts",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    solicitationId: uuid("solicitation_id"),
    proposalId: uuid("proposal_id"),
    awardedVendorId: uuid("awarded_vendor_id"), // must be a vetted vendor (RESTRICT)
    contractType: contractType("contract_type").notNull(),
    totalValue: money("total_value"),
    popStart: timestamp("pop_start", { withTimezone: true, mode: "date" }),
    popEnd: timestamp("pop_end", { withTimezone: true, mode: "date" }),
    status: contractStatus("status").notNull().default("PENDING_SIGNATURE"),
    esignStatus: esignStatus("esign_status").notNull().default("NOT_STARTED"),
    ...timestamps(),
  },
  (t) => [
    unique("contracts_org_id_id_key").on(t.orgId, t.id),
    foreignKey({
      name: "contracts_solicitation_fk",
      columns: [t.orgId, t.solicitationId],
      foreignColumns: [solicitations.orgId, solicitations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "contracts_proposal_fk",
      columns: [t.orgId, t.proposalId],
      foreignColumns: [proposals.orgId, proposals.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "contracts_vendor_fk",
      columns: [t.orgId, t.awardedVendorId],
      foreignColumns: [vendors.orgId, vendors.id],
    }).onDelete("restrict"),
    index("contracts_org_idx").on(t.orgId),
    index("contracts_solicitation_idx").on(t.solicitationId),
    index("contracts_proposal_idx").on(t.proposalId),
    index("contracts_vendor_idx").on(t.awardedVendorId),
    check("contracts_value_nonneg", sql`${t.totalValue} IS NULL OR ${t.totalValue} >= 0`),
    check(
      "contracts_pop_order",
      sql`${t.popStart} IS NULL OR ${t.popEnd} IS NULL OR ${t.popEnd} >= ${t.popStart}`,
    ),
  ],
);

export const contractMilestones = pgTable(
  "contract_milestones",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").notNull(),
    sequence: integer("sequence").notNull(),
    description: text("description").notNull(),
    amount: money("amount"),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    status: milestoneStatus("status").notNull().default("PENDING"),
    ...timestamps(),
  },
  (t) => [
    unique("milestones_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("milestones_contract_seq_key").on(t.contractId, t.sequence),
    foreignKey({
      name: "milestones_contract_fk",
      columns: [t.orgId, t.contractId],
      foreignColumns: [contracts.orgId, contracts.id],
    }).onDelete("cascade"),
    index("milestones_contract_idx").on(t.contractId),
    check("milestones_amount_nonneg", sql`${t.amount} IS NULL OR ${t.amount} >= 0`),
    check("milestones_sequence_pos", sql`${t.sequence} > 0`),
  ],
);

export const arFollowups = pgTable(
  "ar_followups",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").notNull(),
    milestoneId: uuid("milestone_id"),
    amountDue: money("amount_due"),
    /** Single source for overdue; "overdue" is computed at runtime, never stored stale. */
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    status: arFollowupStatus("status").notNull().default("SCHEDULED"),
    nextFollowupAt: timestamp("next_followup_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "ar_contract_fk",
      columns: [t.orgId, t.contractId],
      foreignColumns: [contracts.orgId, contracts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "ar_milestone_fk",
      columns: [t.orgId, t.milestoneId],
      foreignColumns: [contractMilestones.orgId, contractMilestones.id],
    }).onDelete("restrict"),
    index("ar_org_idx").on(t.orgId),
    index("ar_contract_idx").on(t.contractId),
    check("ar_amount_nonneg", sql`${t.amountDue} IS NULL OR ${t.amountDue} >= 0`),
  ],
);
