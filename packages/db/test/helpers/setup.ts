/**
 * Vitest setupFile (runs once per test file). Ends the shared pool after each file so Vitest can
 * exit cleanly, and prints a one-line notice when no DSN is configured so a DB-less run is an
 * explicit SKIP rather than a silent green.
 */
import { afterAll } from "vitest";
import { HAS_DB, endTestPool } from "./db.js";

// CI's `db` / `db-acceptance` jobs export REQUIRE_DB=1. There, a missing DSN is a HARD FAILURE, never a
// silent skip: without this guard, a DSN that failed to reach the vitest process would turn every
// schema/RLS/negative suite into `describe.skip`, and `vitest run --passWithNoTests` would still exit 0
// — a green gate that verified nothing. The DB-level tenant-isolation / no-auto-submit guarantees are
// enforced ONLY by these suites, so refuse to report success when they could not run.
if (process.env.REQUIRE_DB && !HAS_DB) {
  throw new Error(
    "REQUIRE_DB is set but no Postgres DSN (MIGRATION_DATABASE_URL / DATABASE_URL_UNPOOLED) is configured. " +
      "Refusing to skip the DB-backed schema/RLS/negative suites and report a false green.",
  );
}

if (!HAS_DB) {
  console.warn(
    "[db tests] No Postgres DSN (MIGRATION_DATABASE_URL / DATABASE_URL_UNPOOLED) — DB-backed suites SKIPPED; pure unit suites still run.",
  );
}

afterAll(async () => {
  await endTestPool();
});
