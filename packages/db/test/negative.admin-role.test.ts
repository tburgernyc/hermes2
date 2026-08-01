/**
 * §3.6 granular admin roles — the schema half (Phase A): every ADMIN row carries an explicit
 * admin_role (no silent default — a privilege level is always a deliberate choice) and a VENDOR
 * row can never carry one (the portal split stays orthogonal). RLS/server-side route enforcement
 * is the Phase-B §3.6 builder's work; these CHECKs are the structural substrate.
 */
import { describe, expect, it } from "vitest";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import { insertOrg, insertUser } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("users admin_role pairing CHECKs", () => {
  it("rejects an ADMIN with NO admin_role (users_admin_role_required)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO users (org_id, email, role, password_hash)
           VALUES ($1, 'no-level@example.test', 'ADMIN', '!hash')`,
          [orgId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("users_admin_role_required");
    }));

  it("rejects a VENDOR carrying an admin_role (users_vendor_no_admin_role)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO users (org_id, email, role, admin_role)
           VALUES ($1, 'vendor-esc@example.test', 'VENDOR', 'FULL')`,
          [orgId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("users_vendor_no_admin_role");
    }));

  it("rejects stripping the level from an existing ADMIN", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" }); // fixture sets FULL
      const err = await capturePgError(() =>
        c.query(`UPDATE users SET admin_role = NULL WHERE id = $1`, [adminId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("users_admin_role_required");
    }));

  it.each(["FULL", "CAPTURE", "FINANCE"] as const)("accepts an ADMIN at level %s", (level) =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await expect(insertUser(c, orgId, { role: "ADMIN", adminRole: level })).resolves.toBeDefined();
    }),
  );

  it("accepts a plain VENDOR (admin_role NULL)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await expect(insertUser(c, orgId, { role: "VENDOR" })).resolves.toBeDefined();
    }));
});
