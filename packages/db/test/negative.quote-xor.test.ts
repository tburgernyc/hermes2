/**
 * vendor_quotes is the structural trust boundary: exactly one of vendor_id / prospect_id is set
 * (vendor ⊕ prospect). All four cases, asserting the constraint name on the rejections.
 */
import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import { insertOrg, insertProspect, insertSolicitation, insertVendor } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

interface Base {
  orgId: string;
  solicitationId: string;
  vendorId: string;
  prospectId: string;
}

async function base(c: PoolClient): Promise<Base> {
  const orgId = await insertOrg(c);
  const solicitationId = await insertSolicitation(c, orgId);
  const vendorId = await insertVendor(c, orgId);
  const prospectId = await insertProspect(c, orgId);
  return { orgId, solicitationId, vendorId, prospectId };
}

d("vendor_quotes vendor⊕prospect XOR", () => {
  it("accepts a vendor-only quote", () =>
    withRollback(async (c) => {
      const b = await base(c);
      await expect(
        c.query(`INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id) VALUES ($1,$2,$3)`, [
          b.orgId,
          b.solicitationId,
          b.vendorId,
        ]),
      ).resolves.toBeDefined();
    }));

  it("accepts a prospect-only quote", () =>
    withRollback(async (c) => {
      const b = await base(c);
      await expect(
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, prospect_id) VALUES ($1,$2,$3)`,
          [b.orgId, b.solicitationId, b.prospectId],
        ),
      ).resolves.toBeDefined();
    }));

  it("rejects a quote naming BOTH vendor and prospect", () =>
    withRollback(async (c) => {
      const b = await base(c);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, prospect_id) VALUES ($1,$2,$3,$4)`,
          [b.orgId, b.solicitationId, b.vendorId, b.prospectId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("vendor_quotes_party_xor");
    }));

  it("rejects a quote naming NEITHER vendor nor prospect", () =>
    withRollback(async (c) => {
      const b = await base(c);
      const err = await capturePgError(() =>
        c.query(`INSERT INTO vendor_quotes (org_id, solicitation_id) VALUES ($1,$2)`, [
          b.orgId,
          b.solicitationId,
        ]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("vendor_quotes_party_xor");
    }));
});
