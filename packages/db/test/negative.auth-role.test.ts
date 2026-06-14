/**
 * The hermes_auth login role (0005_auth.sql). Authentication is a CROSS-TENANT lookup — it resolves a
 * user by email before any org context exists — so this role can read ANY user's auth columns and write
 * ONLY the lockout columns. It must be able to do nothing else: no other column on users, no INSERT/
 * DELETE on users, and no access to any other table. These are the privilege/policy guarantees the
 * Auth.js credentials path (packages/core/auth-users.ts via client.withAuthRole) depends on.
 */
import { describe, expect, it } from "vitest";
import {
  HAS_DB,
  PG,
  capturePgError,
  setLocalRole,
  withRollback,
} from "./helpers/db.js";
import { insertOrg, insertUser } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("hermes_auth login role boundary", () => {
  it("CAN read a user across orgs with NO org context (the login-by-email lookup)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      await insertUser(c, orgA, { email: "a@example.test" });
      await insertUser(c, orgB, { email: "b@example.test" });
      // Elevate AFTER owner setup. Deliberately set NO app.current_org_id — auth has no org yet.
      await setLocalRole(c, "hermes_auth");
      const res = await c.query<{ email: string }>(
        `SELECT email FROM users WHERE email IN ('a@example.test', 'b@example.test') ORDER BY email`,
      );
      expect(res.rows.map((r) => r.email)).toEqual(["a@example.test", "b@example.test"]);
    }));

  it("CAN write the lockout columns (failed_login_count, locked_until)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      await setLocalRole(c, "hermes_auth");
      await expect(
        c.query(
          `UPDATE users SET failed_login_count = failed_login_count + 1, locked_until = now() WHERE id = $1`,
          [userId],
        ),
      ).resolves.toBeDefined();
    }));

  it("CANNOT update any non-lockout column (column-scoped UPDATE grant)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      await setLocalRole(c, "hermes_auth");
      const err = await capturePgError(() =>
        c.query(`UPDATE users SET password_hash = 'tampered' WHERE id = $1`, [userId]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/permission denied/i);
    }));

  it("CANNOT INSERT a user (no INSERT grant — auth never creates accounts)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_auth");
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO users (org_id, email, role) VALUES ($1, 'x@example.test', 'VENDOR')`,
          [orgId],
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("CANNOT DELETE a user (no DELETE grant)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      await setLocalRole(c, "hermes_auth");
      const err = await capturePgError(() =>
        c.query(`DELETE FROM users WHERE id = $1`, [userId]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("CANNOT read any other table (grant is scoped to users only)", () =>
    withRollback(async (c) => {
      await insertOrg(c);
      await setLocalRole(c, "hermes_auth");
      const err = await capturePgError(() => c.query(`SELECT id FROM orgs LIMIT 1`));
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/permission denied/i);
    }));
});
