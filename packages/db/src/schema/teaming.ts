/**
 * Reverse-subcontracting cluster (§3.4): teaming_partners (the MIRROR-IMAGE counterparty — a prime
 * that pays BURGER CONSULTING; structurally separate from `vendors`, which is the firm's own
 * subcontractor bench that the firm pays) and teaming_agreements (the firm's engagement AS a
 * subcontractor under that partner's prime contract — deliberately lighter than `contracts`,
 * because the partner's prime usually furnishes/negotiates the controlling agreement text).
 * The two directions are never mixed into shared/ambiguous columns (the §3.3 lesson).
 */
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { teamingAgreementStatus } from "./enums.js";
import { money, timestamps, uuidPk } from "./_shared.js";
import { orgs } from "./tenancy.js";
import { solicitations } from "./sourcing.js";

export const teamingPartners = pgTable(
  "teaming_partners",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    uei: varchar("uei", { length: 12 }),
    cageCode: varchar("cage_code", { length: 5 }),
    notes: text("notes"), // UNTRUSTED free text — fence as data in any AI call
    ...timestamps(),
  },
  (t) => [
    unique("teaming_partners_org_id_id_key").on(t.orgId, t.id),
    index("teaming_partners_org_idx").on(t.orgId),
    check(
      "teaming_partners_name_present",
      sql`length(btrim(${t.companyName})) > 0`,
    ),
    check("teaming_partners_uei_format", sql`${t.uei} IS NULL OR ${t.uei} ~ '^[A-Z0-9]{12}$'`),
    check(
      "teaming_partners_cage_format",
      sql`${t.cageCode} IS NULL OR ${t.cageCode} ~ '^[A-Z0-9]{5}$'`,
    ),
  ],
);

export const teamingAgreements = pgTable(
  "teaming_agreements",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    partnerId: uuid("partner_id").notNull(),
    /** The SUBCONTRACTOR-role pursuit this agreement belongs to, when one is tracked (§3.4.2). */
    solicitationId: uuid("solicitation_id"),
    ourScopeText: text("our_scope_text"), // the firm's OWN scope as the sub
    ourPricing: money("our_pricing"),
    popStart: timestamp("pop_start", { withTimezone: true, mode: "date" }),
    popEnd: timestamp("pop_end", { withTimezone: true, mode: "date" }),
    /** The PARTNER'S prime contract reference for traceability (O5 naming — never bare `piid`). */
    primeContractPiid: text("prime_contract_piid"),
    status: teamingAgreementStatus("status").notNull().default("DRAFT"),
    ...timestamps(),
  },
  (t) => [
    unique("teaming_agreements_org_id_id_key").on(t.orgId, t.id),
    foreignKey({
      name: "teaming_agreements_partner_fk",
      columns: [t.orgId, t.partnerId],
      foreignColumns: [teamingPartners.orgId, teamingPartners.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "teaming_agreements_solicitation_fk",
      columns: [t.orgId, t.solicitationId],
      foreignColumns: [solicitations.orgId, solicitations.id],
    }).onDelete("restrict"),
    index("teaming_agreements_org_idx").on(t.orgId),
    index("teaming_agreements_partner_idx").on(t.partnerId),
    check(
      "teaming_agreements_pricing_nonneg",
      sql`${t.ourPricing} IS NULL OR ${t.ourPricing} >= 0`,
    ),
    check(
      "teaming_agreements_pop_order",
      sql`${t.popStart} IS NULL OR ${t.popEnd} IS NULL OR ${t.popEnd} >= ${t.popStart}`,
    ),
  ],
);
