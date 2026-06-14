/**
 * Vitest setupFile. Mirrors @hermes/db's setup: in CI the `inngest` job exports REQUIRE_DB=1, so a
 * missing DSN is a HARD FAILURE (never a silently-skipped suite reporting a false green). Locally,
 * a DB-less run logs a notice and the DB-backed suites skip; the pure SSRF/gate units still run.
 */
import { afterAll } from "vitest";

import { HAS_DB, endDbPool } from "./db.js";

if (process.env.REQUIRE_DB && !HAS_DB) {
  throw new Error(
    "REQUIRE_DB is set but no Postgres DSN (MIGRATION_DATABASE_URL / DATABASE_URL_UNPOOLED) is configured. " +
      "Refusing to skip the DB-backed logic suites and report a false green.",
  );
}

if (!HAS_DB) {
  console.warn(
    "[inngest tests] No Postgres DSN — DB-backed logic suites SKIPPED; SSRF + gate-wiring units still run.",
  );
}

afterAll(async () => {
  await endDbPool();
});
