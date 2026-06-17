/**
 * Guard contract: the updated_at + audit-immutability + line-item-sync + solicitation-submit
 * triggers exist; RLS is ENABLED (and deliberately NOT FORCED) on every table; tenant-isolation
 * policies plus the two RESTRICTIVE token policies exist; the two non-owner roles exist with the
 * right attributes; and the grant matrix (audit append-only, token can't touch firm-side tables)
 * holds. Read-only catalog introspection.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { HAS_DB, getTestPool } from "./helpers/db.js";
import { EXPECTED_TABLES } from "./helpers/expected-schema.js";

const d = HAS_DB ? describe : describe.skip;

const UPDATED_AT_TABLES = EXPECTED_TABLES.filter((t) => t !== "audit_log"); // 16 (audit_log is append-only)

const EXPECTED_TRIGGERS = new Set<string>([
  ...UPDATED_AT_TABLES.map((t) => `${t}.${t}_set_updated_at`),
  "audit_log.audit_log_no_update_delete",
  "audit_log.audit_log_no_truncate",
  "vendor_quote_line_items.line_items_sync_ct",
  "solicitations.solicitations_submit_guard",
]);

// Each trigger must be bound to its INTENDED function — a trigger row can exist while pointing at a
// stale/no-op function, which name-only presence checks would miss.
const EXPECTED_TRIGGER_FUNC: Record<string, string> = {
  ...Object.fromEntries(UPDATED_AT_TABLES.map((t) => [`${t}.${t}_set_updated_at`, "set_updated_at"])),
  "audit_log.audit_log_no_update_delete": "audit_log_block_modify",
  "audit_log.audit_log_no_truncate": "audit_log_block_truncate",
  "vendor_quote_line_items.line_items_sync_ct": "sync_line_item_contract_type",
  "solicitations.solicitations_submit_guard": "solicitation_submit_guard",
};

// The vendor-facing tables that carry a per-vendor (hermes_vendor) isolation pair (0009_vendor_role.sql):
// a PERMISSIVE _vendor_org (org scope) + a RESTRICTIVE _vendor_scope (own-vendor scope).
const VENDOR_SCOPED_TABLES = ["vendors", "vendor_quotes", "proposals", "contracts", "documents"];

const EXPECTED_POLICIES = new Set<string>([
  ...EXPECTED_TABLES.map((t) => `${t}.${t}_tenant_isolation`),
  "vendor_quotes.vendor_quotes_token_prospect_only",
  "documents.documents_token_prospect_only",
  // hermes_auth least-privilege login path (0005_auth.sql): read any user, write lockout only.
  "users.users_auth_select",
  "users.users_auth_lockout",
  // hermes_vendor per-vendor isolation (0009_vendor_role.sql).
  ...VENDOR_SCOPED_TABLES.flatMap((t) => [`${t}.${t}_vendor_org`, `${t}.${t}_vendor_scope`]),
  // hermes_vendor RFQ browse (0010_vendor_reads.sql): a PERMISSIVE org-scoped SELECT only —
  // solicitations are shared in-org, so there is deliberately NO restrictive per-vendor scope here.
  "solicitations.solicitations_vendor_org",
  // hermes_vendor quote-line-items read (0010): org PERMISSIVE + an EXISTS-to-parent RESTRICTIVE
  // scope (line items have no vendor_id; they inherit isolation from the parent quote).
  "vendor_quote_line_items.vendor_quote_line_items_vendor_org",
  "vendor_quote_line_items.vendor_quote_line_items_vendor_scope",
  // hermes_vendor audit append (0011, PR K): the audit_log tenant_isolation policy names only
  // hermes_app/hermes_token, so the logged-in submit's in-tx audit write needs this org-scoped
  // INSERT policy (PERMISSIVE — paired with an INSERT-only grant; no read/alter/erase).
  "audit_log.audit_log_vendor_append",
]);

const RESTRICTIVE_POLICIES = new Set<string>([
  "vendor_quotes.vendor_quotes_token_prospect_only",
  "documents.documents_token_prospect_only",
  ...VENDOR_SCOPED_TABLES.map((t) => `${t}.${t}_vendor_scope`),
  "vendor_quote_line_items.vendor_quote_line_items_vendor_scope",
]);

interface PrivRow {
  app_audit_select: boolean;
  app_audit_insert: boolean;
  app_audit_update: boolean;
  app_audit_delete: boolean;
  app_vendors_select: boolean;
  token_prospect_insert: boolean;
  token_vendors_insert: boolean;
  token_vendors_select: boolean;
  token_quote_insert: boolean;
  token_quote_select: boolean;
  token_audit_insert: boolean;
  token_audit_update: boolean;
  token_audit_delete: boolean;
  token_proposals_insert: boolean;
  // hermes_vendor: read surface (0009 + 0010 RFQ browse) + the PR-K (0011) scoped WRITE surface.
  vendor_quote_select: boolean;
  vendor_quote_insert: boolean;
  vendor_vendors_select: boolean;
  vendor_solicitations_select: boolean;
  vendor_line_items_select: boolean;
  vendor_line_items_insert: boolean;
  vendor_documents_insert: boolean;
  vendor_audit_insert: boolean;
  vendor_audit_select: boolean;
  vendor_users_select: boolean;
  vendor_prospects_select: boolean;
}

d("guards: triggers, RLS, policies, roles, grants", () => {
  const triggers = new Set<string>();
  const triggerFunc = new Map<string, string>();
  const rls = new Map<string, { enabled: boolean; forced: boolean }>();
  const policies = new Set<string>();
  const restrictivePolicies = new Set<string>();
  const roles = new Map<string, { canLogin: boolean; bypassRls: boolean; super: boolean }>();
  let privs: PrivRow | undefined;

  beforeAll(async () => {
    const client = await getTestPool().connect();
    try {
      const trg = await client.query<{ table_name: string; tgname: string; func: string }>(
        `SELECT c.relname AS table_name, tg.tgname AS tgname, p.proname AS func
         FROM pg_trigger tg
         JOIN pg_class c ON c.oid = tg.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_proc p ON p.oid = tg.tgfoid
         WHERE n.nspname = 'public' AND NOT tg.tgisinternal`,
      );
      for (const r of trg.rows) {
        triggers.add(`${r.table_name}.${r.tgname}`);
        triggerFunc.set(`${r.table_name}.${r.tgname}`, r.func);
      }

      const rlsRows = await client.query<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'`,
      );
      for (const r of rlsRows.rows) {
        rls.set(r.relname, { enabled: r.relrowsecurity, forced: r.relforcerowsecurity });
      }

      const pol = await client.query<{ tablename: string; policyname: string; permissive: string }>(
        `SELECT tablename, policyname, permissive FROM pg_policies WHERE schemaname = 'public'`,
      );
      for (const r of pol.rows) {
        policies.add(`${r.tablename}.${r.policyname}`);
        if (r.permissive === "RESTRICTIVE") {
          restrictivePolicies.add(`${r.tablename}.${r.policyname}`);
        }
      }

      const rl = await client.query<{
        rolname: string;
        rolcanlogin: boolean;
        rolbypassrls: boolean;
        rolsuper: boolean;
      }>(
        `SELECT rolname, rolcanlogin, rolbypassrls, rolsuper
         FROM pg_roles WHERE rolname IN ('hermes_app', 'hermes_token', 'hermes_auth', 'hermes_vendor')`,
      );
      for (const r of rl.rows) {
        roles.set(r.rolname, {
          canLogin: r.rolcanlogin,
          bypassRls: r.rolbypassrls,
          super: r.rolsuper,
        });
      }

      const pr = await client.query<PrivRow>(
        `SELECT
           has_table_privilege('hermes_app','audit_log','SELECT')          AS app_audit_select,
           has_table_privilege('hermes_app','audit_log','INSERT')          AS app_audit_insert,
           has_table_privilege('hermes_app','audit_log','UPDATE')          AS app_audit_update,
           has_table_privilege('hermes_app','audit_log','DELETE')          AS app_audit_delete,
           has_table_privilege('hermes_app','vendors','SELECT')            AS app_vendors_select,
           has_table_privilege('hermes_token','vendor_prospects','INSERT') AS token_prospect_insert,
           has_table_privilege('hermes_token','vendors','INSERT')          AS token_vendors_insert,
           has_table_privilege('hermes_token','vendors','SELECT')          AS token_vendors_select,
           has_table_privilege('hermes_token','vendor_quotes','INSERT')    AS token_quote_insert,
           has_table_privilege('hermes_token','vendor_quotes','SELECT')    AS token_quote_select,
           has_table_privilege('hermes_token','audit_log','INSERT')        AS token_audit_insert,
           has_table_privilege('hermes_token','audit_log','UPDATE')        AS token_audit_update,
           has_table_privilege('hermes_token','audit_log','DELETE')        AS token_audit_delete,
           has_table_privilege('hermes_token','proposals','INSERT')        AS token_proposals_insert,
           has_table_privilege('hermes_vendor','vendor_quotes','SELECT')   AS vendor_quote_select,
           has_table_privilege('hermes_vendor','vendor_quotes','INSERT')   AS vendor_quote_insert,
           has_table_privilege('hermes_vendor','vendors','SELECT')         AS vendor_vendors_select,
           has_table_privilege('hermes_vendor','solicitations','SELECT')   AS vendor_solicitations_select,
           has_table_privilege('hermes_vendor','vendor_quote_line_items','SELECT') AS vendor_line_items_select,
           has_table_privilege('hermes_vendor','vendor_quote_line_items','INSERT') AS vendor_line_items_insert,
           has_table_privilege('hermes_vendor','documents','INSERT')        AS vendor_documents_insert,
           has_table_privilege('hermes_vendor','audit_log','INSERT')        AS vendor_audit_insert,
           has_table_privilege('hermes_vendor','audit_log','SELECT')        AS vendor_audit_select,
           has_table_privilege('hermes_vendor','users','SELECT')           AS vendor_users_select,
           has_table_privilege('hermes_vendor','vendor_prospects','SELECT') AS vendor_prospects_select`,
      );
      privs = pr.rows[0];
    } finally {
      client.release();
    }
  });

  it("creates the updated_at + immutability + sync + submit-guard triggers", () => {
    for (const t of EXPECTED_TRIGGERS) {
      expect(triggers.has(t), `missing trigger ${t}`).toBe(true);
    }
  });

  it("does NOT put an updated_at trigger on the append-only audit_log", () => {
    expect(triggers.has("audit_log.audit_log_set_updated_at")).toBe(false);
  });

  it("binds each trigger to its intended function (not a stale/no-op function)", () => {
    for (const [key, func] of Object.entries(EXPECTED_TRIGGER_FUNC)) {
      expect(triggerFunc.get(key), `${key} function binding`).toBe(func);
    }
  });

  it("enables RLS (but does not FORCE it) on every table", () => {
    for (const t of EXPECTED_TABLES) {
      const r = rls.get(t);
      expect(r?.enabled, `${t} RLS enabled`).toBe(true);
      expect(r?.forced, `${t} RLS not forced`).toBe(false);
    }
  });

  it("defines tenant-isolation + the two RESTRICTIVE token policies", () => {
    for (const p of EXPECTED_POLICIES) {
      expect(policies.has(p), `missing policy ${p}`).toBe(true);
    }
    for (const p of RESTRICTIVE_POLICIES) {
      expect(restrictivePolicies.has(p), `policy ${p} should be RESTRICTIVE`).toBe(true);
    }
  });

  it("has EXACTLY the expected policy set (drift guard: no unexpected/extra RLS policies)", () => {
    expect([...policies].sort()).toEqual([...EXPECTED_POLICIES].sort());
    expect([...restrictivePolicies].sort()).toEqual([...RESTRICTIVE_POLICIES].sort());
  });

  it("creates non-owner roles with no login / no BYPASSRLS / no superuser", () => {
    for (const name of ["hermes_app", "hermes_token", "hermes_auth", "hermes_vendor"]) {
      const r = roles.get(name);
      expect(r, `role ${name}`).toBeDefined();
      expect(r?.canLogin, `${name} canLogin`).toBe(false);
      expect(r?.bypassRls, `${name} bypassRls`).toBe(false);
      expect(r?.super, `${name} super`).toBe(false);
    }
  });

  it("grants: audit_log append-only for app; token cannot touch firm-side tables", () => {
    expect(privs).toBeDefined();
    expect(privs?.app_audit_select).toBe(true);
    expect(privs?.app_audit_insert).toBe(true);
    expect(privs?.app_audit_update).toBe(false);
    expect(privs?.app_audit_delete).toBe(false);
    expect(privs?.app_vendors_select).toBe(true);
    expect(privs?.token_prospect_insert).toBe(true);
    expect(privs?.token_vendors_insert).toBe(false);
    expect(privs?.token_vendors_select).toBe(false);
    expect(privs?.token_quote_insert).toBe(true);
    // INSERT but NOT SELECT on vendor_quotes — so submitQuote supplies the quote UUID app-side
    // (no RETURNING under the token role). This is the property that keeps the token write blind.
    expect(privs?.token_quote_select).toBe(false);
    // Token may APPEND audit rows (0007) but never alter/erase them (append-only triggers + no grant).
    expect(privs?.token_audit_insert).toBe(true);
    expect(privs?.token_audit_update).toBe(false);
    expect(privs?.token_audit_delete).toBe(false);
    expect(privs?.token_proposals_insert).toBe(false);
  });

  it("grants: hermes_vendor has its read surface + the PR-K scoped write surface, nothing more", () => {
    expect(privs).toBeDefined();
    // Reads (0009 + 0010): own quotes/vendor row, in-org RFQ browse, own quote line items.
    expect(privs?.vendor_quote_select).toBe(true);
    expect(privs?.vendor_vendors_select).toBe(true);
    expect(privs?.vendor_solicitations_select).toBe(true);
    expect(privs?.vendor_line_items_select).toBe(true);
    // Writes (0011, PR K): the logged-in submit inserts a quote, its lines, and the VENDOR_QUOTE doc,
    // each constrained to the vendor's own scope by the RESTRICTIVE WITH CHECK arms (0009/0010).
    expect(privs?.vendor_quote_insert).toBe(true);
    expect(privs?.vendor_line_items_insert).toBe(true);
    expect(privs?.vendor_documents_insert).toBe(true);
    // audit_log is APPEND-only for the vendor: INSERT (the in-tx submit audit row) but never SELECT —
    // a vendor can write the log atomically with its quote and can never read, alter, or erase it.
    expect(privs?.vendor_audit_insert).toBe(true);
    expect(privs?.vendor_audit_select).toBe(false);
    // Still no access to the link/identity (users) or other firms' prospects — unchanged by PR K.
    expect(privs?.vendor_users_select).toBe(false);
    expect(privs?.vendor_prospects_select).toBe(false);
  });
});
