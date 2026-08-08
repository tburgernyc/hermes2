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

/**
 * Run `fn` inside a transaction elevated to the least-privilege `hermes_auth` role — the ONLY path
 * that may read a user cross-tenant (the login-by-email lookup) and write the lockout columns.
 *
 * Authentication has no org context yet (the org is derived FROM the looked-up user), so this path
 * deliberately does NOT set `app.current_org_id`; hermes_auth's policies are `USING (true)`, scoped
 * to the users table only. `SET LOCAL ROLE` is transaction-scoped (reverts on commit/rollback). The
 * role name is a fixed literal — never user input — so interpolation is safe.
 */
export async function withAuthRole<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE hermes_auth`);
    return fn(tx);
  });
}

/**
 * Run `fn` inside a transaction elevated to the low-trust `hermes_token` role with the tenant context
 * set to `orgId` — the tokenized public-submission path (/quote, /optout). Unlike withAuthRole, this
 * path HAS an org (the signed token carries it), so it sets `app.current_org_id` (bind-safe, via
 * set_config) AND switches role. The org context is set FIRST (as hermes_app), then the role is dropped
 * to hermes_token; the RESTRICTIVE token RLS policies (migration 0003) then force every write to be
 * prospect-scoped — a token can never create or overwrite a vetted vendor (CLAUDE.md §7). Requires the
 * hermes_app→hermes_token membership from migration 0006. SET LOCAL ROLE is transaction-scoped. The role
 * name is a fixed literal — never user input — so interpolation is safe.
 */
export async function withTokenRole<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    await tx.execute(sql`SET LOCAL ROLE hermes_token`);
    return fn(tx);
  });
}

/**
 * Run `fn` inside a transaction elevated to the `hermes_vendor` role, scoped to BOTH the org and a
 * single vendor — the authenticated vendor-account path (Phase-6 portal). Org-scoped RLS gives no
 * isolation between two vendors in the same org, so this sets a SECOND context GUC,
 * `app.current_vendor_id`, that the per-vendor RESTRICTIVE policies (migration 0009) AND-narrow every
 * read to. Both GUCs are set as hermes_app FIRST (bind-safe set_config), THEN the role is dropped to
 * hermes_vendor; SET LOCAL ROLE is transaction-scoped. Requires the hermes_app→hermes_vendor
 * membership from 0009.
 *
 * SECURITY: `vendorId` must be the SERVER-resolved id from the session linkage (users.vendor_id),
 * NEVER a client-supplied value — the same rule as the §7 tokenized path. The role name is a fixed
 * literal. (Footgun: on a reused pooled conn the GUC reads as '' and ''::uuid ERRORS — fail-closed —
 * so every hermes_vendor query MUST come through this helper, which always sets it.)
 */
export async function withVendorRole<T>(
  orgId: string,
  vendorId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_vendor_id', ${vendorId}, true)`);
    await tx.execute(sql`SET LOCAL ROLE hermes_vendor`);
    return fn(tx);
  });
}

/**
 * Run `fn` inside a transaction with the RLS tenant context set to `orgId`, AND a second GUC,
 * `app.current_admin_role`, conveying the caller's SERVER-RESOLVED session admin access level
 * (FULL/CAPTURE/FINANCE, or null) to the DB. This is the §3.6 decision-4 DB-level backstop behind
 * `orgs`'s RESTRICTIVE `orgs_update_requires_full_admin` policy (migration 0013): the ONLY thing
 * standing between a compromised/mis-wired server-side check and a non-FULL admin rewriting
 * `orgs.directives` (compliance settings) is this GUC actually being set correctly on every write.
 *
 * Unlike withTokenRole/withVendorRole this does NOT elevate to a different role — hermes_app stays
 * hermes_app. A dedicated low-trust role (mirroring hermes_token/hermes_vendor) would be the wrong
 * shape here: those roles narrow an ALREADY-low-trust caller's surface for many tables; this instead
 * adds one extra fact ("is this session FULL?") on top of an already-fully-trusted hermes_app
 * connection, for exactly one table's UPDATE. A GUC is the minimal primitive for that, and it mirrors
 * withOrg's existing set_config pattern exactly.
 *
 * FAIL CLOSED: passing `null`/`undefined` (or using plain `withOrg` instead of this helper) must
 * never be interpreted as FULL. `current_setting('app.current_admin_role', true)` reads as NULL on a
 * virgin backend and as '' on a pooled connection that set the GUC in an earlier transaction and then
 * ran a plain `withOrg` call that never re-set it (the documented footgun — see withVendorRole above).
 * Both `NULL = 'FULL'` and `'' = 'FULL'` evaluate to NULL/false in SQL, which a RESTRICTIVE policy
 * treats as "row excluded" — so both cases deny by construction; only the literal string 'FULL' passes.
 * Coercing `adminRole` to `''` (never to a truthy sentinel) here keeps that guarantee explicit rather
 * than relying on set_config's own NULL-handling.
 *
 * SECURITY: `adminRole` must be the server-resolved session claim (session.user.adminRole from
 * requireFullAdmin()'s return), never a client-supplied value — the same rule as §7's token/vendor
 * paths.
 */
export async function withOrgAsAdmin<T>(
  orgId: string,
  adminRole: string | null | undefined,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_admin_role', ${adminRole ?? ""}, true)`);
    return fn(tx);
  });
}
