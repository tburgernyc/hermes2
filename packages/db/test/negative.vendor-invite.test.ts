/**
 * VENDOR_INVITE onboarding boundary (Phase-6 vendor portal — CLAUDE.md §7). The /invite accept action
 * runs as hermes_app (withOrg) and creates a VENDOR user from a server-verified token. The structural
 * guarantees proven here are:
 *   • single-use: a conditional `accepted_at IS NULL` claim consumes exactly the pending row, so a
 *     concurrent / replayed accept matches zero rows;
 *   • hermes_app can only write an invite in its OWN org (tenant_isolation WITH CHECK);
 *   • an invite can never reference a vendor in another org (the composite vendor FK);
 *   • accepted_at / accepted_user_id are set together (the accept-pair CHECK);
 *   • (org_id, token_jti) is unique;
 *   • an invite can never mint an ADMIN-with-vendor-link (the users_vendor_link_role CHECK).
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
import { insertOrg, insertUser, insertVendor, insertVendorInvite } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("vendor_invites — single-use + tenant + link boundary", () => {
  it("claims a pending invite exactly once (a replayed accept matches zero rows)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const admin = await insertUser(c, orgId, { role: "ADMIN" });
      const vendorId = await insertVendor(c, orgId);
      const inviteId = await insertVendorInvite(c, orgId, { vendorId, createdBy: admin });
      const acceptUser = await insertUser(c, orgId, { role: "VENDOR" });

      // Connect as the public accept action does: org context, then the RLS-bound app role.
      await setOrgContext(c, orgId);
      await setLocalRole(c, "hermes_app");

      const claim = `UPDATE vendor_invites
           SET accepted_at = now(), accepted_user_id = $1
         WHERE org_id = $2 AND id = $3 AND accepted_at IS NULL
         RETURNING id`;
      const first = await c.query(claim, [acceptUser, orgId, inviteId]);
      expect(first.rowCount).toBe(1);
      const second = await c.query(claim, [acceptUser, orgId, inviteId]);
      expect(second.rowCount).toBe(0); // already claimed — single-use
    }));

  it("hermes_app cannot write an invite for a DIFFERENT org (tenant_isolation WITH CHECK)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const adminB = await insertUser(c, orgB, { role: "ADMIN" });
      const vendorB = await insertVendor(c, orgB);

      await setOrgContext(c, orgA); // the session is org A …
      await setLocalRole(c, "hermes_app");

      // … but the row claims org B. FKs are all valid in org B, so the failure is purely RLS.
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_invites
             (org_id, vendor_id, invited_email, token_hash, token_jti, expires_at, created_by)
           VALUES ($1, $2, 'x@e.test', 'h', 'j', now() + interval '7 days', $3)`,
          [orgB, vendorB, adminB],
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("an invite can never reference a vendor in another org (composite vendor FK)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const adminA = await insertUser(c, orgA, { role: "ADMIN" });
      const vendorB = await insertVendor(c, orgB);

      // Owner connection (RLS exempt) so the composite FK is the sole guard.
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_invites
             (org_id, vendor_id, invited_email, token_hash, token_jti, expires_at, created_by)
           VALUES ($1, $2, 'x@e.test', 'h', 'j', now() + interval '7 days', $3)`,
          [orgA, vendorB, adminA],
        ),
      );
      expect(err?.code).toBe(PG.FK_VIOLATION);
    }));

  it("rejects a row with accepted_at set but accepted_user_id null (accept-pair CHECK)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const admin = await insertUser(c, orgId, { role: "ADMIN" });
      const vendorId = await insertVendor(c, orgId);
      const err = await capturePgError(() =>
        insertVendorInvite(c, orgId, { vendorId, createdBy: admin, acceptedAt: new Date() }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("vendor_invites_accept_pair");
    }));

  it("enforces a unique (org_id, token_jti)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const admin = await insertUser(c, orgId, { role: "ADMIN" });
      const vendorId = await insertVendor(c, orgId);
      await insertVendorInvite(c, orgId, { vendorId, createdBy: admin, tokenJti: "dup-jti" });
      const err = await capturePgError(() =>
        insertVendorInvite(c, orgId, { vendorId, createdBy: admin, tokenJti: "dup-jti" }),
      );
      expect(err?.code).toBe(PG.UNIQUE_VIOLATION);
    }));

  it("an invite can never mint an ADMIN-with-vendor-link (users_vendor_link_role CHECK)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorId = await insertVendor(c, orgId);
      // The accept action hardcodes role='VENDOR'; the DB belt is the CHECK — an admin row can never
      // carry a vendor link, so even a buggy/forged accept cannot create a vendor-bound admin.
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO users (org_id, email, role, password_hash, vendor_id)
           VALUES ($1, 'admin-link@e.test', 'ADMIN', '!hash', $2)`,
          [orgId, vendorId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("users_vendor_link_role");
    }));
});
