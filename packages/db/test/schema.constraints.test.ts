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
