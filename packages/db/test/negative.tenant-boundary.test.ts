/**
 * Token-role boundary (CLAUDE.md §7): a tokenized public submission may only ever create a
 * prospect-scoped row. hermes_token cannot write a vetted vendor (no grant), CAN write a prospect,
 * and any quote it writes is forced prospect-linked by the RESTRICTIVE RLS policy.
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
import { insertOrg, insertProspect, insertSolicitation, insertVendor } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("token role boundary", () => {
  it("hermes_token CANNOT INSERT a vetted vendor (no grant)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      const err = await capturePgError(() =>
        c.query(`INSERT INTO vendors (org_id, company_name) VALUES ($1, 'Sneaky Vendor')`, [orgId]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/permission denied/i);
    }));

  it("hermes_token CAN INSERT a prospect (its sanctioned write target)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      await expect(
        c.query(
          `INSERT INTO vendor_prospects (org_id, company_name, contact_email)
           VALUES ($1, 'Prospect Co', 'p@example.test')`,
          [orgId],
        ),
      ).resolves.toBeDefined();
    }));

  it("hermes_token quote MUST be prospect-linked: a vendor-linked quote is rejected by RLS", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const vendorId = await insertVendor(c, orgId); // real, owner-created vendor so FK is satisfied
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      const err = await capturePgError(() =>
        c.query(`INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id) VALUES ($1,$2,$3)`, [
          orgId,
          solId,
          vendorId,
        ]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/row-level security/i);
    }));

  it("hermes_token quote that is prospect-linked is accepted", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const prospectId = await insertProspect(c, orgId);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      await expect(
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, prospect_id) VALUES ($1,$2,$3)`,
          [orgId, solId, prospectId],
        ),
      ).resolves.toBeDefined();
    }));

  it("hermes_token CANNOT write a non-prospect document (RESTRICTIVE documents policy)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorId = await insertVendor(c, orgId); // structurally-valid VENDOR document target
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO documents (org_id, entity_type, vendor_id, storage_key, content_type, byte_size)
           VALUES ($1, 'VENDOR', $2, 'k', 'application/pdf', 10)`,
          [orgId, vendorId],
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/row-level security/i);
    }));

  it("hermes_token CAN write a prospect-scoped document (its sanctioned target)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const prospectId = await insertProspect(c, orgId);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      await expect(
        c.query(
          `INSERT INTO documents (org_id, entity_type, prospect_id, storage_key, content_type, byte_size)
           VALUES ($1, 'VENDOR_PROSPECT', $2, 'k', 'application/pdf', 10)`,
          [orgId, prospectId],
        ),
      ).resolves.toBeDefined();
    }));
});
