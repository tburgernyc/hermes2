/**
 * CLI seed runner (run as the OWNER via MIGRATION_DATABASE_URL). All seed logic lives in
 * `seed-core.ts` (pure + testable); this file is only the entry point: load env, open a Pool,
 * call seedOrg, report, close.
 *
 * Runs as the owner so it is exempt from RLS — there is no org context to set when creating the
 * very first org.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema/index.js";
import { seedOrg, DEFAULT_ADMIN_EMAIL } from "./seed-core.js";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../..", ".env") });

const dsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (!dsn) {
  throw new Error("MIGRATION_DATABASE_URL (or DATABASE_URL_UNPOOLED) is required to seed.");
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: dsn });
  const db = drizzle(pool, { schema });
  try {
    const result = await seedOrg(db);
    process.stdout.write(
      result.orgCreated ? `org created: ${result.orgId}\n` : `org exists: ${result.orgId}\n`,
    );
    process.stdout.write(
      result.adminCreated
        ? `admin created: ${DEFAULT_ADMIN_EMAIL} (password reset required via app)\n`
        : `admin exists: ${DEFAULT_ADMIN_EMAIL}\n`,
    );
    process.stdout.write("✓ seed complete\n");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
