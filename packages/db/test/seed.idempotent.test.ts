/**
 * The seed is idempotent: first run creates org + admin; a second run with the same natural keys is
 * a no-op (no duplicate rows, same org id). Runs inside a rolled-back transaction with a test-only
 * slug/email so the real seeded org is untouched.
 */
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { HAS_DB, withRollback } from "./helpers/db.js";
import * as schema from "../src/schema/index.js";
import { seedOrg } from "../src/seed-core.js";

const d = HAS_DB ? describe : describe.skip;

d("seed idempotency", () => {
  it("creates org + admin on first run and no-ops on the second", () =>
    withRollback(async (c) => {
      const db = drizzle(c, { schema });
      const orgSlug = "seed-idempotency-test";
      const adminEmail = "seed-idem@example.test";

      const first = await seedOrg(db, { orgSlug, adminEmail });
      expect(first.orgCreated).toBe(true);
      expect(first.adminCreated).toBe(true);

      const second = await seedOrg(db, { orgSlug, adminEmail });
      expect(second.orgCreated).toBe(false);
      expect(second.adminCreated).toBe(false);
      expect(second.orgId).toBe(first.orgId);

      const orgCount = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM orgs WHERE slug = $1`,
        [orgSlug],
      );
      expect(orgCount.rows[0]?.n).toBe(1);

      const userCount = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM users WHERE lower(email) = lower($1)`,
        [adminEmail],
      );
      expect(userCount.rows[0]?.n).toBe(1);
    }));
});
