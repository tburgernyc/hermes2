/**
 * RLS tenant isolation: under hermes_app, a row is visible/writable only when its org_id matches the
 * app.current_org_id context (USING + WITH CHECK). Cross-tenant reads return nothing; cross-tenant
 * writes are rejected; with no context set, nothing is visible.
 */
import { describe, expect, it } from "vitest";
import {
  HAS_DB,
  PG,
  capturePgError,
  setLocalRole,
  setOrgContext,
  withRollback,
} from "./helpers/db.js";
import { insertOrg, insertProspect } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("RLS tenant isolation", () => {
  it("a role sees only its own org's rows and cannot write into another org", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c, { slug: "rls-a" });
      const orgB = await insertOrg(c, { slug: "rls-b" });
      const pA = await insertProspect(c, orgA, { companyName: "A Co" });
      await insertProspect(c, orgB, { companyName: "B Co" });

      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgA);

      const visible = await c.query<{ id: string }>(
        `SELECT id FROM vendor_prospects WHERE id = ANY($1::uuid[])`,
        [[pA]],
      );
      expect(visible.rows.map((r) => r.id)).toEqual([pA]);

      // Cross-tenant read: org B is invisible under context A regardless of how we ask.
      const all = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM vendor_prospects`,
      );
      expect(all.rows[0]?.n).toBe(1);

      // Cross-tenant write: WITH CHECK rejects inserting into org B under context A.
      const err = await capturePgError(() =>
        c.query(`INSERT INTO vendor_prospects (org_id, company_name) VALUES ($1, 'X')`, [orgB]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/row-level security/i);
    }));

  it("a role bound to org B sees ONLY org B's row (USING pins equality, not mere emptiness)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c, { slug: "rls-eq-a" });
      const orgB = await insertOrg(c, { slug: "rls-eq-b" });
      const pA = await insertProspect(c, orgA, { companyName: "A Co" });
      const pB = await insertProspect(c, orgB, { companyName: "B Co" });

      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgB);
      const r = await c.query<{ id: string }>(
        `SELECT id FROM vendor_prospects WHERE id = ANY($1::uuid[])`,
        [[pA, pB]],
      );
      // Exactly B's row — distinguishes USING(org_id = ctx) from USING(false) and USING(org_id <> ctx).
      expect(r.rows.map((row) => row.id)).toEqual([pB]);
    }));

  it("an UNSET org context fails closed (errors or zero rows — never leaks)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      await insertProspect(c, orgA, {});
      await setLocalRole(c, "hermes_app");
      // No setOrgContext on purpose: current_setting(...,true) is '' on a reused pooled connection →
      // ''::uuid raises 22P02; on a truly-fresh connection it is NULL → zero rows. Both fail closed.
      let rows: number | undefined;
      const err = await capturePgError(async () => {
        const r = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM vendor_prospects`);
        rows = r.rows[0]?.n;
      });
      if (err) {
        expect(err.code).toBe("22P02"); // invalid_input_syntax for uuid
      } else {
        expect(rows).toBe(0);
      }
    }));

  it("hermes_token is also bound: it cannot write into another org (tenant WITH CHECK)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c, { slug: "rls-tok-a" });
      const orgB = await insertOrg(c, { slug: "rls-tok-b" });
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgA);
      const err = await capturePgError(() =>
        c.query(`INSERT INTO vendor_prospects (org_id, company_name) VALUES ($1, 'X')`, [orgB]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/row-level security/i);
    }));
});
