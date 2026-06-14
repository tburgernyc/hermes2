/**
 * Test harness for the @hermes/inngest logic functions. Connects via the DIRECT OWNER DSN (the same one
 * the @hermes/db suite uses) so fixtures insert freely (RLS is enabled-but-not-forced; the owner is
 * exempt) while the logic's explicit org_id filters still scope every query.
 *
 * Isolation: withRollbackTx opens a Drizzle transaction and ALWAYS rolls it back, so nothing the logic
 * writes (or the fixtures insert) ever commits to the shared database. We point @hermes/db's lazy getDb()
 * at the owner DSN by setting DATABASE_URL before the first getDb() call, then reuse the real client — so
 * the tx the logic receives is the exact `Tx` type it expects in production.
 *
 * If no DSN is configured the DB-backed suites SKIP with a logged notice (never a silent green).
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
// packages/inngest/test/helpers -> repo root (.env lives there, gitignored).
dotenv.config({ path: resolve(here, "../../../..", ".env") });

/** Direct (unpooled) owner connection — needed so fixtures bypass RLS the way the db suite does. */
const ownerDsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;

/** True when a Postgres DSN is configured. DB-backed suites gate on this. */
export const HAS_DB = Boolean(ownerDsn && /^postgres(ql)?:\/\//.test(ownerDsn));

// Point @hermes/db's runtime client at the owner DSN. getDb() reads DATABASE_URL lazily (on first call,
// which happens inside a test), so setting it here — before any getDb() — is sufficient.
if (HAS_DB && ownerDsn) {
  process.env.DATABASE_URL = ownerDsn;
}
// mintToken/hashToken need a signing secret; provide a deterministic throwaway for tests if unset.
process.env.TOKEN_SIGNING_SECRET ??= "inngest-test-token-signing-secret-0123456789";

import { getDb, getPool, type Tx } from "@hermes/db";

/** Sentinel used to force a Drizzle transaction to roll back without surfacing as a test error. */
const ROLLBACK = Symbol("rollback");

/**
 * Run `fn` inside a Drizzle transaction that is ALWAYS rolled back. The logic under test receives `tx`
 * exactly as it would in production (withOrg passes the same handle), but nothing commits.
 */
export async function withRollbackTx(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await getDb().transaction(async (tx) => {
      await fn(tx);
      // Throwing makes Drizzle issue ROLLBACK; we swallow the sentinel below.
      return Promise.reject(ROLLBACK);
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
}

/** Close the shared pool so Vitest can exit cleanly (idempotent across the per-file module registry). */
export async function endDbPool(): Promise<void> {
  if (HAS_DB) await getPool().end();
}
