/**
 * Runtime DB client. Lazy: importing this module has NO side effects (no Pool, no env read) until
 * getDb()/getPool() is called — so the schema can be imported anywhere without a live DATABASE_URL.
 *
 * Tenant isolation: use withOrg(orgId, fn) so every query runs in a transaction with the RLS context
 * set via set_config('app.current_org_id', …). The runtime connects as the non-owner `hermes_app` role.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import * as schema from "./schema/index.js";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function requireDsn(): string {
  const dsn = process.env.DATABASE_URL;
  if (!dsn) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!/^postgres(ql)?:\/\//.test(dsn)) {
    throw new Error(
      "DATABASE_URL must be a postgresql:// connection string, not a Neon Data API REST URL.",
    );
  }
  return dsn;
}

let poolSingleton: Pool | undefined;
export function getPool(): Pool {
  if (!poolSingleton) {
    poolSingleton = new Pool({ connectionString: requireDsn() });
  }
  return poolSingleton;
}

let dbSingleton: Db | undefined;
export function getDb(): Db {
  if (!dbSingleton) {
    dbSingleton = drizzle(getPool(), { schema });
  }
  return dbSingleton;
}

/**
 * Run `fn` inside a transaction with the RLS tenant context set to `orgId`. Uses set_config(...) —
 * the bind-parameter-safe equivalent of SET LOCAL — so org_id is never string-concatenated into SQL.
 */
export async function withOrg<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx);
  });
}
