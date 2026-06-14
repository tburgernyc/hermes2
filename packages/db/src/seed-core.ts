/**
 * Seed logic as a pure, side-effect-free function so it can be reused by the CLI runner
 * (`seed.ts`) AND exercised by tests (importing this module starts no Pool and reads no env).
 *
 * Idempotent: existence is checked by natural key (org slug, lower(email)) before inserting, so
 * re-running makes no changes. The admin's password_hash is a non-null sentinel that satisfies the
 * `users_admin_requires_password` CHECK but is not a valid hash — no one can authenticate until it
 * is reset through the app (Phase 2).
 */
import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema/index.js";
import { orgs, users } from "./schema/index.js";
import { parseDirectives, type OrgDirectives } from "./directives.js";

export type SeedDatabase = NodePgDatabase<typeof schema>;

export const DEFAULT_ORG_SLUG = "burger-consulting";
export const DEFAULT_ADMIN_EMAIL = "t.burgernyc@gmail.com";
/** Non-null, intentionally not a valid hash: blocks login until reset via the app. */
export const PASSWORD_RESET_SENTINEL = "!RESET_REQUIRED_VIA_APP";

/**
 * Burger Consulting's directives, validated at module load. Socio-economic eligibility is
 * structurally `false` (CLAUDE.md §6.7); every threshold is flagged `pendingCounsel`.
 */
export const BURGER_DIRECTIVES: OrgDirectives = parseDirectives({
  naicsCodes: ["541511", "541512", "541519"],
  setAsideEligibility: {
    totalSmallBusiness: true,
    eightA: false,
    hubzone: false,
    sdvosb: false,
    wosb: false,
  },
  zeroFloat: { minFeasibilityScore: 6, maxResponseDays: 14 },
  thresholds: {
    priceRealismMinMarginPct: { value: 5, pendingCounsel: true },
    passThroughMaxPct: { value: 70, pendingCounsel: true },
    tinaThresholdUsd: { value: 2_500_000, pendingCounsel: true },
    limitationsOnSubcontractingMaxNonSimilarPct: { value: 50, pendingCounsel: true },
  },
});

export interface SeedOptions {
  orgSlug?: string;
  name?: string;
  ein?: string;
  primaryDomain?: string;
  adminEmail?: string;
  directives?: OrgDirectives;
}

export interface SeedResult {
  orgId: string;
  orgCreated: boolean;
  adminCreated: boolean;
}

/**
 * Create (or find) one org + one admin user. Returns what was created so callers can report and
 * tests can assert the create-then-idempotent path. Runs as whatever role owns `db`'s connection;
 * the CLI runner uses the owner (RLS-exempt) because there is no org context for the very first org.
 */
export async function seedOrg(db: SeedDatabase, opts: SeedOptions = {}): Promise<SeedResult> {
  const orgSlug = opts.orgSlug ?? DEFAULT_ORG_SLUG;
  const adminEmail = opts.adminEmail ?? DEFAULT_ADMIN_EMAIL;
  const directives = opts.directives ?? BURGER_DIRECTIVES;
  const name = opts.name ?? "Burger Consulting LLC";
  const ein = opts.ein ?? "84-3113166";
  const primaryDomain = opts.primaryDomain ?? "burgergov.com";

  const existingOrg = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.slug, orgSlug));
  const foundOrg = existingOrg[0];

  let orgId: string;
  let orgCreated: boolean;
  if (foundOrg) {
    orgId = foundOrg.id;
    orgCreated = false;
  } else {
    const inserted = await db
      .insert(orgs)
      .values({ slug: orgSlug, name, ein, primaryDomain, directives })
      .returning({ id: orgs.id });
    const row = inserted[0];
    if (!row) throw new Error("org insert returned no row");
    orgId = row.id;
    orgCreated = true;
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${adminEmail})`);

  let adminCreated: boolean;
  if (existingUser[0]) {
    adminCreated = false;
  } else {
    await db.insert(users).values({
      orgId,
      email: adminEmail,
      role: "ADMIN",
      passwordHash: PASSWORD_RESET_SENTINEL,
      isActive: true,
    });
    adminCreated = true;
  }

  return { orgId, orgCreated, adminCreated };
}
