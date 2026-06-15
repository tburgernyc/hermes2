/**
 * Migration runner (run as the OWNER via MIGRATION_DATABASE_URL).
 *
 * Order is load-bearing:
 *   1. manual/0000_extensions.sql   CREATE EXTENSION vector  (the table migration uses vector())
 *   2. manual/0001_roles.sql        hermes_app / hermes_token roles
 *   3. drizzle migrate()            the generated table migration (migrations/0000_tables.sql)
 *   4. manual/0003_guards.sql       triggers + RLS policies
 *   5. manual/0004_grants.sql       grants + audit REVOKE + token scoping
 *   6. manual/0005_auth.sql         hermes_auth role (cross-tenant login lookup, least-privilege)
 *   7. manual/0006_token_role.sql   hermes_token ← hermes_app membership (tokenized-submission path)
 *   8. manual/0007_token_audit.sql  hermes_token may APPEND audit rows (atomic with a tokenized write)
 *   9. manual/0008_line_item_trigger_definer.sql  line-item contract_type sync runs SECURITY DEFINER
 *
 * Every manual step is idempotent, so re-running is safe.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
dotenv.config({ path: resolve(repoRoot, ".env") });

const dsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (!dsn) {
  throw new Error("MIGRATION_DATABASE_URL (or DATABASE_URL_UNPOOLED) is required to run migrations.");
}

const migrationsFolder = resolve(here, "../migrations");
const manualDir = resolve(migrationsFolder, "manual");

async function runManual(pool: Pool, file: string): Promise<void> {
  const text = readFileSync(resolve(manualDir, file), "utf8");
  process.stdout.write(`→ ${file}\n`);
  await pool.query(text);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: dsn });
  try {
    await runManual(pool, "0000_extensions.sql");
    await runManual(pool, "0001_roles.sql");
    process.stdout.write("→ drizzle migrate (tables)\n");
    await migrate(drizzle(pool), { migrationsFolder });
    await runManual(pool, "0003_guards.sql");
    await runManual(pool, "0004_grants.sql");
    await runManual(pool, "0005_auth.sql");
    await runManual(pool, "0006_token_role.sql");
    await runManual(pool, "0007_token_audit.sql");
    await runManual(pool, "0008_line_item_trigger_definer.sql");

    // Post-condition: the tokenized line-item insert depends on sync_line_item_contract_type being
    // SECURITY DEFINER (0008 — the token role can't SELECT vendor_quotes the trigger reads). If a future
    // migration re-creates this function without that flag and runs AFTER 0008, the token's blind write
    // silently breaks. Assert the end state so any such ordering regression fails the migration loudly.
    const secdef = await pool.query<{ prosecdef: boolean }>(
      `SELECT prosecdef FROM pg_proc WHERE proname = 'sync_line_item_contract_type'`,
    );
    if (!secdef.rows[0]?.prosecdef) {
      throw new Error(
        "sync_line_item_contract_type must be SECURITY DEFINER (set by 0008). A later migration likely " +
          "redefined it without that flag — re-order so the SECURITY DEFINER promotion runs last.",
      );
    }
    process.stdout.write("✓ migrations complete\n");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
