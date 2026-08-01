/**
 * Constraint contract: every named CHECK exists, policy-bearing FKs carry the intended ON DELETE
 * behaviour (RESTRICT for legal/financial history, CASCADE for owned children), the three pgvector
 * columns are pinned to vector(1024) and indexed with HNSW, and the partial/full UNIQUE indexes
 * exist. Read-only catalog introspection.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { HAS_DB, getTestPool } from "./helpers/db.js";

const d = HAS_DB ? describe : describe.skip;

const EXPECTED_CHECKS: string[] = [
  "audit_log_attributable",
  "orgs_uei_format",
  "orgs_cage_format",
  "orgs_ein_format",
  "users_admin_requires_password",
  "users_vendor_link_role",
  "award_intel_amount_nonneg",
  "solicitations_feasibility_range",
  "solicitations_naics_format",
  "solicitations_sourcing_gate",
  "solicitations_is_services_provenance",
  "outreach_approval_gate",
  "outreach_sent_requires_timestamp",
  "outreach_quote_token_expiry",
  "outreach_optout_token_expiry",
  "outreach_ai_match_score_range",
  "outreach_ai_capability_match_range",
  "vendor_prospects_score_range",
  "vendor_prospects_uei_format",
  "vendors_uei_format",
  "vendors_cage_format",
  "vendors_vetted_requires_vetter",
  "proposals_submit_requires_human",
  "proposals_submit_requires_counsel",
  "proposals_gov_payment_nonneg",
  "proposals_non_sim_subs_nonneg",
  "proposals_total_cost_nonneg",
  "line_items_tm_markup_lock",
  "line_items_qty_pos",
  "line_items_rate_nonneg",
  "line_items_markup_nonneg",
  "line_items_sub_naics_format",
  "line_items_sim_situated_consistency",
  "vendor_quotes_party_xor",
  "vendor_quotes_total_nonneg",
  "vendor_quotes_ai_score_range",
  "ar_amount_nonneg",
  "milestones_amount_nonneg",
  "milestones_sequence_pos",
  "contracts_value_nonneg",
  "contracts_pop_order",
  "documents_byte_size_pos",
  "documents_sha256_format",
  "documents_owner_exactly_one",
  "documents_owner_matches_type",
  "vendor_invites_accept_pair",
  "contact_inquiries_text_present",
  // ---- Phase A (§3.1): users granular roles + solicitation award-outcome block ----
  "users_admin_role_required",
  "users_vendor_no_admin_role",
  "solicitations_awarded_value_nonneg",
  "solicitations_outcome_gate",
  "solicitations_lm_provenance",
  // ---- Phase A (§3.1.4 / §7.3): contracts agreement-review gate + signer pairing ----
  "contracts_esign_requires_review",
  "contracts_vendor_signed_pair",
  // ---- Phase A (O3 / §3.7.3): documents retention review pairing ----
  "documents_retention_review_pair",
  // ---- Phase A (§3.4): teaming ----
  "teaming_partners_name_present",
  "teaming_partners_uei_format",
  "teaming_partners_cage_format",
  "teaming_agreements_pricing_nonneg",
  "teaming_agreements_pop_order",
  // ---- Phase A (§3.3): finance ----
  "invoices_link_xor",
  "invoices_amount_nonneg",
  "invoices_number_present",
  "invoices_milestone_requires_contract",
  "invoices_submitted_requires_timestamp",
  "invoices_paid_requires_timestamp",
  "payables_amount_nonneg",
  "payables_paid_requires_timestamp",
  "past_perf_period_order",
  "ai_usage_tokens_nonneg",
  "ai_usage_cost_nonneg",
  // ---- Phase A (§3.5): timekeeping ----
  "timesheet_periods_period_order",
  "timesheet_periods_approval_gate",
  "timesheet_periods_submit_requires_timestamp",
  "time_entries_hours_range",
  "time_entries_direct_requires_contract",
  "time_entries_milestone_requires_contract",
  "time_entries_description_present",
  "time_entry_corrections_reason_present",
  // ---- Phase A (§3.7): firm-side compliance ----
  "insurance_coverage_nonneg",
  "insurance_effective_order",
];

// confdeltype: 'r' = RESTRICT, 'c' = CASCADE.
const EXPECTED_FK_DELETE: Record<string, string> = {
  users_org_id_orgs_id_fk: "r",
  users_vendor_fk: "r", // a user's vendor link can't dangle past a vendor (vendors are never hard-deleted)
  proposals_solicitation_fk: "r", // no history erasure
  vendor_quotes_solicitation_fk: "r",
  documents_quote_fk: "r", // legal/financial artifacts: never cascade-delete
  documents_proposal_fk: "r",
  documents_contract_fk: "r",
  documents_milestone_fk: "r",
  documents_solicitation_fk: "c", // owned attachments: cascade
  documents_vendor_fk: "c",
  documents_prospect_fk: "c",
  line_items_quote_fk: "c",
  milestones_contract_fk: "c",
  // ---- Phase A: every new FK is RESTRICT (financial/legal/labor history is never erased) ----
  solicitations_outcome_recorder_fk: "r",
  solicitations_converted_from_fk: "r",
  contracts_agreement_reviewer_fk: "r",
  contracts_vendor_signer_fk: "r",
  documents_teaming_agreement_fk: "r", // legal artifact: never cascade-delete
  documents_insurance_policy_fk: "r",
  documents_retention_reviewer_fk: "r",
  teaming_agreements_partner_fk: "r",
  teaming_agreements_solicitation_fk: "r",
  invoices_contract_fk: "r",
  invoices_teaming_agreement_fk: "r",
  invoices_milestone_fk: "r",
  payables_contract_fk: "r",
  payables_invoice_fk: "r", // the Prompt-Payment clock source must survive
  past_perf_contract_fk: "r",
  past_perf_recorder_fk: "r",
  timesheet_periods_user_fk: "r",
  timesheet_periods_approver_fk: "r",
  time_entries_user_fk: "r",
  time_entries_contract_fk: "r",
  time_entries_period_fk: "r",
  time_entries_invoice_fk: "r",
  corrections_entry_fk: "r", // an entry with corrections can never be deleted (DCAA trail)
  corrections_user_fk: "r",
  compliance_events_recorder_fk: "r",
};

const EXPECTED_VECTOR_COLUMNS = [
  { table: "solicitations", column: "scope_embedding" },
  { table: "vendors", column: "capability_embedding" },
  { table: "vendor_prospects", column: "capability_embedding" },
];

const EXPECTED_HNSW = [
  "solicitations_scope_vec_idx",
  "vendors_cap_vec_idx",
  "vendor_prospects_cap_vec_idx",
];

const EXPECTED_PARTIAL_UNIQUE = [
  "vendor_prospects_email_key",
  "vendor_quotes_jti_key",
  "outreach_quote_token_key",
  "outreach_optout_token_key",
  "vendors_promoted_from_key",
  // PR K (0011): one ACTIVE quote per (vendor, solicitation) — partial on vendor_id NOT NULL + non-terminal status.
  "vendor_quotes_one_active_per_vendor",
];

const EXPECTED_UNIQUE = [
  "orgs_slug_key",
  "users_email_lower_key",
  "award_intel_unique_key",
  "solicitations_notice_key",
  "milestones_contract_seq_key",
  "users_org_id_id_key",
  "solicitations_org_id_id_key",
  "vendors_org_id_id_key",
  "vendor_prospects_org_id_id_key",
  "vendor_quotes_org_id_id_key",
  "proposals_org_id_id_key",
  "milestones_org_id_id_key",
  "contracts_org_id_id_key",
  // vendor_invites: both are FULL (non-partial) unique indexes — token_jti/token_hash are NOT NULL.
  "vendor_invites_jti_key",
  "vendor_invites_token_hash_key",
  // ---- Phase A: composite-FK targets + natural keys ----
  "teaming_partners_org_id_id_key",
  "teaming_agreements_org_id_id_key",
  "invoices_org_id_id_key",
  "invoices_org_number_key", // one invoice number per org (the firm's own numbering sequence)
  "timesheet_periods_org_id_id_key",
  "timesheet_periods_user_start_key", // one period per (user, start date)
  "time_entries_org_id_id_key",
  "business_insurance_policies_org_id_id_key",
];

interface IndexInfo {
  partial: boolean;
  unique: boolean;
  method: string;
}

d("schema constraints, FKs, vector dims, indexes", () => {
  const checkNames = new Set<string>();
  const fkDelete = new Map<string, string>();
  const vectorFmt = new Map<string, string>();
  const indexInfo = new Map<string, IndexInfo>();

  beforeAll(async () => {
    const client = await getTestPool().connect();
    try {
      const checks = await client.query<{ conname: string }>(
        `SELECT con.conname FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = rel.relnamespace
         WHERE n.nspname = 'public' AND con.contype = 'c'`,
      );
      for (const r of checks.rows) checkNames.add(r.conname);

      const fks = await client.query<{ conname: string; confdeltype: string }>(
        `SELECT con.conname, con.confdeltype FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = rel.relnamespace
         WHERE n.nspname = 'public' AND con.contype = 'f'`,
      );
      for (const r of fks.rows) fkDelete.set(r.conname, r.confdeltype);

      const vecs = await client.query<{ table_name: string; column_name: string; fmt: string }>(
        `SELECT c.relname AS table_name, a.attname AS column_name,
                format_type(a.atttypid, a.atttypmod) AS fmt
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
           AND a.attname IN ('scope_embedding', 'capability_embedding')`,
      );
      for (const r of vecs.rows) vectorFmt.set(`${r.table_name}.${r.column_name}`, r.fmt);

      const idx = await client.query<{
        index_name: string;
        is_partial: boolean;
        is_unique: boolean;
        method: string;
      }>(
        `SELECT c.relname AS index_name, (i.indpred IS NOT NULL) AS is_partial,
                i.indisunique AS is_unique, am.amname AS method
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indexrelid
         JOIN pg_class t ON t.oid = i.indrelid
         JOIN pg_am am ON am.oid = c.relam
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'`,
      );
      for (const r of idx.rows) {
        indexInfo.set(r.index_name, {
          partial: r.is_partial,
          unique: r.is_unique,
          method: r.method,
        });
      }
    } finally {
      client.release();
    }
  });

  it("defines every expected CHECK constraint", () => {
    for (const name of EXPECTED_CHECKS) {
      expect(checkNames.has(name), `missing CHECK ${name}`).toBe(true);
    }
  });

  it("has EXACTLY the expected CHECK set (drift guard: no extra/renamed/stale constraints)", () => {
    expect([...checkNames].sort()).toEqual([...EXPECTED_CHECKS].sort());
  });

  it("sets the intended ON DELETE behaviour on policy-bearing FKs", () => {
    for (const [name, expected] of Object.entries(EXPECTED_FK_DELETE)) {
      expect(fkDelete.get(name), `FK ${name} ondelete`).toBe(expected);
    }
  });

  it("pins all three pgvector columns to vector(1024)", () => {
    for (const { table, column } of EXPECTED_VECTOR_COLUMNS) {
      expect(vectorFmt.get(`${table}.${column}`), `${table}.${column}`).toBe("vector(1024)");
    }
    expect(vectorFmt.size).toBe(3);
  });

  it("indexes the vector columns with HNSW", () => {
    for (const name of EXPECTED_HNSW) {
      expect(indexInfo.get(name)?.method, `index ${name} method`).toBe("hnsw");
    }
  });

  it("creates the partial UNIQUE indexes (token/email/jti scoped)", () => {
    for (const name of EXPECTED_PARTIAL_UNIQUE) {
      const info = indexInfo.get(name);
      expect(info?.unique, `${name} unique`).toBe(true);
      expect(info?.partial, `${name} partial`).toBe(true);
    }
  });

  it("creates the full UNIQUE indexes/constraints", () => {
    for (const name of EXPECTED_UNIQUE) {
      expect(indexInfo.get(name)?.unique, `${name} unique`).toBe(true);
    }
  });
});
