/**
 * Test harness for the live schema. Connects via the DIRECT OWNER DSN so the suite can:
 *   - run DDL-catalog introspection (schema-contract assertions), and
 *   - `SET LOCAL ROLE` into hermes_app / hermes_token to exercise grants + RLS as the runtime would.
 *
 * Isolation: every behavioural test runs inside BEGIN … ROLLBACK (withRollback), so nothing is ever
 * committed to the shared Neon database — the migrated `public` schema and the seeded org are
 * untouched no matter what the tests insert.
 *
 * If no DSN is configured the DB-backed suites SKIP with a logged notice (never a silent green);
 * pure unit suites (e.g. directives) still run. CI wires a real database in Stage 4.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
// packages/db/test/helpers -> repo root (.env lives there, gitignored).
dotenv.config({ path: resolve(here, "../../../..", ".env") });

/** Direct (unpooled) owner connection: needed for SET ROLE membership + session-level commands. */
const dsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;

/** True when a Postgres DSN is configured. DB-backed suites gate on this. */
export const HAS_DB = Boolean(dsn && /^postgres(ql)?:\/\//.test(dsn));

/** The non-owner runtime roles the schema's grants + RLS policies target. */
export type RuntimeRole = "hermes_app" | "hermes_token" | "hermes_auth";
const RUNTIME_ROLES: readonly RuntimeRole[] = ["hermes_app", "hermes_token", "hermes_auth"];

let poolSingleton: Pool | undefined;

/** Lazily create the shared pool. Re-creatable: endTestPool() clears it so a later file can reopen. */
export function getTestPool(): Pool {
  if (!dsn) {
    throw new Error("No test DSN: set MIGRATION_DATABASE_URL or DATABASE_URL_UNPOOLED.");
  }
  if (!poolSingleton) {
    poolSingleton = new Pool({ connectionString: dsn, max: 4 });
  }
  return poolSingleton;
}

/** Close the pool (idempotent). Called from the shared afterAll so Vitest can exit cleanly. */
export async function endTestPool(): Promise<void> {
  if (poolSingleton) {
    const p = poolSingleton;
    poolSingleton = undefined;
    await p.end();
  }
}

/**
 * Run `fn` against a dedicated client inside a transaction that is ALWAYS rolled back. Use for any
 * test that writes — the rollback guarantees the shared database is never mutated.
 */
export async function withRollback<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getTestPool().connect();
  try {
    await client.query("BEGIN");
    return await fn(client);
  } finally {
    try {
      await client.query("ROLLBACK");
      client.release();
    } catch (rollbackErr) {
      // A connection that can't ROLLBACK is poisoned: destroy it (release with an error) so no open
      // transaction or leftover SET LOCAL state can survive into the next test on a pooled conn.
      client.release(rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr)));
    }
  }
}

/**
 * Switch the current transaction to a non-owner runtime role (transaction-scoped via SET LOCAL).
 * The role is validated against a fixed allowlist — it is never user input — so interpolating it
 * into the un-parameterizable SET ROLE statement is safe.
 */
export async function setLocalRole(client: PoolClient, role: RuntimeRole): Promise<void> {
  if (!RUNTIME_ROLES.includes(role)) {
    throw new Error(`Refusing to SET ROLE to non-allowlisted role: ${role}`);
  }
  await client.query(`SET LOCAL ROLE "${role}"`);
}

/** Set the RLS tenant context for the current transaction (bind-safe; mirrors client.withOrg). */
export async function setOrgContext(client: PoolClient, orgId: string): Promise<void> {
  await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
}

/** Shape of the fields we read off node-postgres / Postgres errors. */
export interface PgError extends Error {
  code?: string;
  constraint?: string;
}

/** Narrow an unknown thrown value to a PgError so tests can assert on code/constraint. */
export function asPgError(err: unknown): PgError {
  if (err instanceof Error) return err as PgError;
  return new Error(String(err)) as PgError;
}

/**
 * Run `fn` and return the PgError it threw (or undefined if it resolved). Lets negative tests assert
 * on `.code` / `.constraint` without per-test try/catch boilerplate, and avoids leaving an aborted
 * transaction half-asserted.
 */
export async function capturePgError(fn: () => Promise<unknown>): Promise<PgError | undefined> {
  try {
    await fn();
    return undefined;
  } catch (err) {
    return asPgError(err);
  }
}

/** Postgres SQLSTATE codes asserted by the negative tests. */
export const PG = {
  CHECK_VIOLATION: "23514",
  INSUFFICIENT_PRIVILEGE: "42501", // covers both "permission denied" and RLS WITH CHECK failures
  RAISE_EXCEPTION: "P0001", // PL/pgSQL RAISE (audit immutability, solicitation submit guard)
} as const;
