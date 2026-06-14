/**
 * The shared BEFORE UPDATE trigger is authoritative: it overwrites any client-supplied updated_at
 * with now(), so raw SQL / seed / Inngest cannot back-date a row.
 */
import { describe, expect, it } from "vitest";
import { HAS_DB, withRollback } from "./helpers/db.js";
import { insertOrg } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("updated_at trigger authority", () => {
  it("overwrites a client-supplied past updated_at with now() on UPDATE", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await c.query(
        `UPDATE orgs SET updated_at = TIMESTAMPTZ '2000-01-01T00:00:00Z', name = 'renamed' WHERE id = $1`,
        [orgId],
      );
      const r = await c.query<{ updated_at: Date }>(
        `SELECT updated_at FROM orgs WHERE id = $1`,
        [orgId],
      );
      const updatedAt = r.rows[0]?.updated_at;
      expect(updatedAt).toBeDefined();
      expect(new Date(updatedAt as Date).getUTCFullYear()).toBeGreaterThan(2020);
    }));
});
