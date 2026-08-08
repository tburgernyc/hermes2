/**
 * §3.6 decision-4 DB-level backstop (migration 0013_admin_role_hardening.sql): direct proof that
 * `orgs` (compliance settings / `orgs.directives`) can no longer be UPDATEd by `hermes_app` unless
 * the `app.current_admin_role` GUC reads exactly 'FULL'. This is the DB-level answer to the
 * verifier's empirical finding — before this migration, the identical sequence below (SET LOCAL
 * ROLE hermes_app + an org-scoped UPDATE) succeeded unconditionally:
 *
 *   BEGIN; SET LOCAL "app.current_org_id" = '...'; SET LOCAL ROLE hermes_app;
 *   UPDATE orgs SET directives = jsonb_set(directives,'{provisionalRatesMode}','false') ...;
 *   UPDATE 1
 *
 * IMPORTANT (empirically verified): because this policy's USING and WITH CHECK clauses are
 * IDENTICAL and depend only on session state (not row content), Postgres RLS denies an UPDATE here
 * by making the row INVISIBLE to the UPDATE's WHERE clause, not by raising 42501 — the row simply
 * contributes to "0 rows affected," with no thrown error (this is standard Postgres RLS behavior:
 * a RESTRICTIVE USING failure excludes the row before WITH CHECK is ever evaluated, and WITH CHECK
 * is what raises an error). So "denied" is asserted here as `rowCount === 0`, and the corresponding
 * app-layer fix in `settings/actions.ts` now checks that count and throws rather than silently
 * no-op'ing and still writing an ORG_SETTINGS_UPDATED audit row.
 *
 * Every case here denies (0 rows) except the one where the GUC is the literal string 'FULL' — an
 * absent GUC, an empty-string GUC (the documented reused-pooled-connection footgun), and the two
 * non-FULL admin_role values (CAPTURE/FINANCE) must all deny.
 */
import { describe, expect, it } from "vitest";

import type { PoolClient } from "pg";

import { HAS_DB, setLocalRole, setOrgContext, withRollback } from "./helpers/db.js";
import { insertOrg } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

/** Mirrors the verifier's exact reproduction: an UPDATE that touches orgs.directives. */
async function attemptDirectivesUpdate(client: PoolClient, orgId: string): Promise<number> {
  const r = await client.query(
    `UPDATE orgs SET directives = jsonb_set(directives, '{provisionalRatesMode}', 'false') WHERE id = $1`,
    [orgId],
  );
  return r.rowCount ?? 0;
}

d("orgs.directives UPDATE requires FULL admin_role at the DB layer (0013)", () => {
  it("DENIES (0 rows) when app.current_admin_role is never set (fail-closed, not defaulted to FULL)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      // Deliberately do NOT set app.current_admin_role at all.
      expect(await attemptDirectivesUpdate(c, orgId)).toBe(0);
    }));

  it("DENIES (0 rows) with an explicit empty-string admin_role GUC (the reused-pooled-connection footgun)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      await c.query("SELECT set_config('app.current_admin_role', '', true)");
      expect(await attemptDirectivesUpdate(c, orgId)).toBe(0);
    }));

  it.each(["CAPTURE", "FINANCE"] as const)("DENIES (0 rows) a non-FULL admin_role GUC (%s)", (level) =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      await c.query("SELECT set_config('app.current_admin_role', $1, true)", [level]);
      expect(await attemptDirectivesUpdate(c, orgId)).toBe(0);
    }),
  );

  it("DENIES (0 rows) a lowercase/garbage admin_role GUC (exact-match only, no case-folding or coercion)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      await c.query("SELECT set_config('app.current_admin_role', 'full', true)");
      expect(await attemptDirectivesUpdate(c, orgId)).toBe(0);
    }));

  it("PERMITS the write (1 row) when app.current_admin_role = 'FULL'", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      await c.query("SELECT set_config('app.current_admin_role', 'FULL', true)");
      expect(await attemptDirectivesUpdate(c, orgId)).toBe(1);

      const r = await c.query<{ directives: { provisionalRatesMode?: boolean } }>(
        `SELECT directives FROM orgs WHERE id = $1`,
        [orgId],
      );
      expect(r.rows[0]?.directives.provisionalRatesMode).toBe(false);
    }));

  it("does not touch SELECT — only UPDATE is gated (reads are unaffected)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      // No admin_role GUC set at all — a plain read must still work exactly as withOrg's callers
      // (every other admin page) rely on today.
      const r = await c.query<{ id: string }>(`SELECT id FROM orgs WHERE id = $1`, [orgId]);
      expect(r.rows[0]?.id).toBe(orgId);
    }));

  it("re-running migration 0013 is idempotent (DROP POLICY IF EXISTS / CREATE POLICY)", () =>
    withRollback(async (c) => {
      // Re-run the exact DDL a second time inside this rolled-back transaction; must not error.
      await c.query(`DROP POLICY IF EXISTS orgs_update_requires_full_admin ON orgs`);
      await c.query(`
        CREATE POLICY orgs_update_requires_full_admin ON orgs
          AS RESTRICTIVE FOR UPDATE TO hermes_app
          USING (current_setting('app.current_admin_role', true) = 'FULL')
          WITH CHECK (current_setting('app.current_admin_role', true) = 'FULL')
      `);
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      await c.query("SELECT set_config('app.current_admin_role', 'FULL', true)");
      expect(await attemptDirectivesUpdate(c, orgId)).toBe(1);
    }));
});
