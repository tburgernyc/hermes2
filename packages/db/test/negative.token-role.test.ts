/**
 * Verifies migration 0006 applied: hermes_app is a member of hermes_token WITH INHERIT FALSE — the grant
 * that lets client.withTokenRole SET ROLE into the low-trust role for a tokenized write, while the app
 * does NOT ambiently inherit hermes_token's (narrower) privileges on a normal query. The behavioral
 * boundary itself (a token may only write a prospect-scoped row, never a vetted vendor) is proven in
 * negative.tenant-boundary.test.ts; this asserts the production elevation wiring is in place.
 */
import { describe, expect, it } from "vitest";

import { HAS_DB, withRollback } from "./helpers/db.js";

const d = HAS_DB ? describe : describe.skip;

d("hermes_token ← hermes_app membership (migration 0006)", () => {
  it("hermes_app is a member of hermes_token WITH INHERIT FALSE", () =>
    withRollback(async (c) => {
      const res = await c.query<{ inherit_option: boolean }>(
        `SELECT m.inherit_option
           FROM pg_auth_members m
           JOIN pg_roles r ON r.oid = m.roleid
           JOIN pg_roles g ON g.oid = m.member
          WHERE r.rolname = 'hermes_token' AND g.rolname = 'hermes_app'`,
      );
      expect(res.rowCount).toBe(1);
      expect(res.rows[0]?.inherit_option).toBe(false);
    }));
});
