/**
 * Phase B DISCOVERY-write negatives. The sourcing engine writes vendor_prospects rows (prospect_source
 * DISCOVERY). These prove the data-layer guarantees the engine relies on:
 *   - the new (org_id, uei) partial unique index dedupes a re-discovered entity (23505), but is PARTIAL so
 *     two NULL-UEI prospects coexist (no false dedupe);
 *   - a DISCOVERY insert obeys org RLS WITH CHECK under the runtime role (can't write another org);
 *   - discovery NEVER overwrites a vetted vendor — it writes a separate vendor_prospects row, leaving the
 *     vendors row untouched (the prompt's "a discovery row cannot overwrite a vetted vendor").
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
import { insertOrg, insertVendor } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

const DISCOVERY_INSERT = `INSERT INTO vendor_prospects (org_id, company_name, uei, prospect_source)
   VALUES ($1, $2, $3, 'DISCOVERY')`;

d("DISCOVERY vendor_prospects write guarantees (Phase B)", () => {
  it("dedupes a re-discovered entity on the (org_id, uei) partial unique index (23505)", () =>
    withRollback(async (c) => {
      const org = await insertOrg(c);
      await c.query(DISCOVERY_INSERT, [org, "Acme IT", "ABC123DEF456"]);
      const dup = await capturePgError(() =>
        c.query(DISCOVERY_INSERT, [org, "Acme IT (again)", "ABC123DEF456"]),
      );
      expect(dup?.code).toBe(PG.UNIQUE_VIOLATION);
    }));

  it("is PARTIAL: two NULL-UEI discovery prospects coexist (no false dedupe)", () =>
    withRollback(async (c) => {
      const org = await insertOrg(c);
      await c.query(
        `INSERT INTO vendor_prospects (org_id, company_name, prospect_source) VALUES ($1, $2, 'DISCOVERY')`,
        [org, "No UEI A"],
      );
      const second = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_prospects (org_id, company_name, prospect_source) VALUES ($1, $2, 'DISCOVERY')`,
          [org, "No UEI B"],
        ),
      );
      expect(second).toBeUndefined(); // both inserts succeed
      const { rows } = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM vendor_prospects WHERE org_id = $1`,
        [org],
      );
      expect(rows[0]!.n).toBe("2");
    }));

  it("the same UEI in a DIFFERENT org is allowed (dedupe is per-org)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      await c.query(DISCOVERY_INSERT, [orgA, "Acme", "ABC123DEF456"]);
      const crossOrg = await capturePgError(() =>
        c.query(DISCOVERY_INSERT, [orgB, "Acme", "ABC123DEF456"]),
      );
      expect(crossOrg).toBeUndefined();
    }));

  it("a DISCOVERY insert obeys org RLS WITH CHECK under hermes_app (can't write another org)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      await setOrgContext(c, orgA);
      await setLocalRole(c, "hermes_app");
      const denied = await capturePgError(() =>
        c.query(DISCOVERY_INSERT, [orgB, "Wrong Org", "ZZZ999ZZZ999"]),
      );
      expect(denied?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("never overwrites a vetted vendor: a same-UEI discovery prospect leaves the vendors row intact", () =>
    withRollback(async (c) => {
      const org = await insertOrg(c);
      const vendorId = await insertVendor(c, org, { companyName: "Vetted Vendor" });
      await c.query(`UPDATE vendors SET uei = $2 WHERE id = $1`, [vendorId, "ABC123DEF456"]);

      // Discovery writes a vendor_prospects row with the same UEI — a separate table, never the vendor.
      await c.query(DISCOVERY_INSERT, [org, "Acme IT", "ABC123DEF456"]);

      const { rows } = await c.query<{ company_name: string; uei: string }>(
        `SELECT company_name, uei FROM vendors WHERE id = $1`,
        [vendorId],
      );
      expect(rows[0]).toMatchObject({ company_name: "Vetted Vendor", uei: "ABC123DEF456" });
    }));
});
