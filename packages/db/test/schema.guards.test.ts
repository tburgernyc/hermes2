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

const UPDATED_AT_TABLES = EXPECTED_TABLES.filter((t) => t !== "audit_log"); // 14 (audit_log is append-only)

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

const EXPECTED_POLICIES = new Set<string>([
  ...EXPECTED_TABLES.map((t) => `${t}.${t}_tenant_isolation`),
  "vendor_quotes.vendor_quotes_token_prospect_only",
  "documents.documents_token_prospect_only",
  // hermes_auth least-privilege login path (0005_auth.sql): read any user, write lockout only.
  "users.users_auth_select",
  "users.users_auth_lockout",
]);

const RESTRICTIVE_POLICIES = new Set<string>([
  "vendor_quotes.vendor_quotes_token_prospect_only",
  "documents.documents_token_prospect_only",
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
  token_proposals_insert: boolean;
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
         FROM pg_roles WHERE rolname IN ('hermes_app', 'hermes_token', 'hermes_auth')`,
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
           has_table_privilege('hermes_token','proposals','INSERT')        AS token_proposals_insert`,
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
    for (const name of ["hermes_app", "hermes_token", "hermes_auth"]) {
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
    expect(privs?.token_proposals_insert).toBe(false);
  });
});
