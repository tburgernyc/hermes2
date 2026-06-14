/**
 * The auth / provenance / attributability / financial-ordering CHECKs that carry correctness or
 * security weight (the rest of the format/non-negativity CHECKs are covered by the contract test's
 * presence assertions). Each pins SQLSTATE 23514 + the exact constraint name.
 */
import { describe, expect, it } from "vitest";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import { insertOrg } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("field-level CHECKs (auth / provenance / attributability)", () => {
  it("rejects an ADMIN with no password_hash (users_admin_requires_password)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO users (org_id, email, role, password_hash) VALUES ($1, 'admin@x.test', 'ADMIN', NULL)`,
          [orgId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("users_admin_requires_password");
    }));

  it("allows a VENDOR with no password_hash (only ADMIN requires one)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await expect(
        c.query(`INSERT INTO users (org_id, email, role) VALUES ($1, 'vendor@x.test', 'VENDOR')`, [
          orgId,
        ]),
      ).resolves.toBeDefined();
    }));

  it("rejects a VETTED vendor with no vetter (vendors_vetted_requires_vetter)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() =>
        c.query(`INSERT INTO vendors (org_id, company_name, status) VALUES ($1, 'V', 'VETTED')`, [
          orgId,
        ]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("vendors_vetted_requires_vetter");
    }));

  it("rejects a non-SYSTEM audit row with no attributable actor (audit_log_attributable)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() =>
        c.query(`INSERT INTO audit_log (org_id, actor_type, action) VALUES ($1, 'ADMIN', 'x')`, [
          orgId,
        ]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("audit_log_attributable");
    }));

  it("rejects a contract whose pop_end precedes pop_start (contracts_pop_order)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO contracts (org_id, contract_type, pop_start, pop_end)
           VALUES ($1, 'FFP', TIMESTAMPTZ '2025-06-01', TIMESTAMPTZ '2025-01-01')`,
          [orgId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("contracts_pop_order");
    }));

  it("rejects a malformed EIN (orgs_ein_format)", () =>
    withRollback(async (c) => {
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO orgs (slug, name, directives, ein) VALUES ('bad-ein-org', 'X', '{}'::jsonb, 'not-an-ein')`,
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("orgs_ein_format");
    }));
});
