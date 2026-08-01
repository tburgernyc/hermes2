/**
 * Firm-side compliance-maintenance cluster (§3.7):
 *
 *   business_insurance_policies — the firm's OWN insurance/bonding (GL, professional/E&O, cyber,
 *                                 bonds), the mirror of the vendor-side COI tracking
 *                                 (vendors.insurance_expiry). `expires_at` feeds the shared
 *                                 reminder collector (O1 — Phase-B cron work; dates only here).
 *   compliance_events           — the manual recertification-event log (§3.7.1): option-year
 *                                 exercises, size recerts, M&A events, recorded BY A HUMAN.
 *
 * The recurring reps/certs + SAM dates live on orgs.directives (registration block), NOT here —
 * one reminder pattern, no shadow deadlines table (O1).
 */
import { check, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { complianceEventKind, insurancePolicyType } from "./enums.js";
import { money, timestamps, uuidPk } from "./_shared.js";
import { orgs, users } from "./tenancy.js";

export const businessInsurancePolicies = pgTable(
  "business_insurance_policies",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    policyType: insurancePolicyType("policy_type").notNull(),
    carrier: text("carrier"),
    policyNumber: text("policy_number"),
    coverageAmount: money("coverage_amount"),
    effectiveAt: timestamp("effective_at", { withTimezone: true, mode: "date" }),
    /** Drives the expiry reminder (same date-field + runtime-computed pattern as everywhere). */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    unique("business_insurance_policies_org_id_id_key").on(t.orgId, t.id),
    index("insurance_org_idx").on(t.orgId),
    check(
      "insurance_coverage_nonneg",
      sql`${t.coverageAmount} IS NULL OR ${t.coverageAmount} >= 0`,
    ),
    check(
      "insurance_effective_order",
      sql`${t.effectiveAt} IS NULL OR ${t.expiresAt} IS NULL OR ${t.expiresAt} >= ${t.effectiveAt}`,
    ),
  ],
);

export const complianceEvents = pgTable(
  "compliance_events",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    kind: complianceEventKind("kind").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").notNull(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "compliance_events_recorder_fk",
      columns: [t.orgId, t.recordedBy],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("compliance_events_org_idx").on(t.orgId),
  ],
);
