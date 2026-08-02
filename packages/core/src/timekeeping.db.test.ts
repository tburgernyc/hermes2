/**
 * DB-backed proof for `getApprovedHours` (§3.5 item 5 exclusion — the helper a LATER §3.3 T&M-invoicing
 * integration unit will call; not wired into any invoicing path by this PR). `computeApprovedHours`
 * itself is exhaustively covered by pure unit tests in timekeeping.test.ts; this file proves the SQL
 * query around it (the join + WHERE scoping) is correct against a REAL Postgres, the same way
 * packages/inngest's logic.test.ts proves its logic functions against a real DB.
 *
 * Connects via the OWNER DSN (mirrors packages/inngest/test/helpers/db.ts) so fixtures insert freely —
 * this suite is proving the query/reduce logic, not RLS (RLS on these tables is already covered by
 * packages/db's negative.timekeeping.test.ts / schema.guards.test.ts). Seeds are committed (not
 * rollback-wrapped): getApprovedHours opens its OWN connection via withOrg/getDb() — a separate
 * connection from any wrapping transaction — so the seed must actually be visible to it; cleaned up in
 * afterAll.
 *
 * If no DSN is configured the suite SKIPS with a logged notice (never a silent green — mirrors every
 * other DB-backed suite in this repo).
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
// packages/core/src -> repo root (.env lives there, gitignored).
dotenv.config({ path: resolve(here, "../../..", ".env") });

const ownerDsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
const HAS_DB = Boolean(ownerDsn && /^postgres(ql)?:\/\//.test(ownerDsn));
// Point @hermes/db's lazy getDb() at the owner DSN. getDb() reads DATABASE_URL on first call (inside
// beforeAll/getApprovedHours below), so setting it here — before that first call — is sufficient.
// @hermes/db's client module has no import-time side effects (see its own header comment), so this
// static import block below is safe to run even when HAS_DB is false (the suite just skips).
if (HAS_DB && ownerDsn) process.env.DATABASE_URL = ownerDsn;

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  contractMilestones,
  contracts,
  defaultDirectives,
  eq,
  getDb,
  getPool,
  orgs,
  timeEntries,
  timesheetPeriods,
  users,
} from "@hermes/db";

import { getApprovedHours } from "./timekeeping.js";

const d = HAS_DB ? describe : describe.skip;
if (!HAS_DB) {
  console.warn(
    "[@hermes/core timekeeping.db.test] No Postgres DSN — getApprovedHours DB-backed suite SKIPPED.",
  );
}

d("getApprovedHours (DB-backed)", () => {
  let orgId: string;
  let adminId: string;
  let contractA: string;
  let contractB: string;
  let milestone1: string;

  beforeAll(async () => {
    const db = getDb();

    const [org] = await db
      .insert(orgs)
      .values({
        slug: `core-approved-hours-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: "Approved Hours Test Org",
        directives: defaultDirectives(),
      })
      .returning({ id: orgs.id });
    orgId = org!.id;

    const [admin] = await db
      .insert(users)
      .values({
        orgId,
        email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
        role: "ADMIN",
        adminRole: "FULL",
        passwordHash: "!hash",
      })
      .returning({ id: users.id });
    adminId = admin!.id;

    const [cA] = await db
      .insert(contracts)
      .values({ orgId, contractType: "TM", status: "ACTIVE" })
      .returning({ id: contracts.id });
    contractA = cA!.id;
    const [cB] = await db
      .insert(contracts)
      .values({ orgId, contractType: "TM", status: "ACTIVE" })
      .returning({ id: contracts.id });
    contractB = cB!.id;

    const [m1] = await db
      .insert(contractMilestones)
      .values({ orgId, contractId: contractA, sequence: 1, description: "Milestone 1", amount: "1000.00" })
      .returning({ id: contractMilestones.id });
    milestone1 = m1!.id;

    const [approvedPeriod] = await db
      .insert(timesheetPeriods)
      .values({
        orgId,
        userId: adminId,
        periodStart: "2026-07-06",
        periodEnd: "2026-07-12",
        status: "APPROVED",
        submittedAt: new Date(),
        approvedBy: adminId,
        approvedAt: new Date(),
      })
      .returning({ id: timesheetPeriods.id });
    const [submittedPeriod] = await db
      .insert(timesheetPeriods)
      .values({
        orgId,
        userId: adminId,
        periodStart: "2026-07-13",
        periodEnd: "2026-07-19",
        status: "SUBMITTED",
        submittedAt: new Date(),
      })
      .returning({ id: timesheetPeriods.id });
    const [openPeriod] = await db
      .insert(timesheetPeriods)
      .values({ orgId, userId: adminId, periodStart: "2026-07-20", periodEnd: "2026-07-26", status: "OPEN" })
      .returning({ id: timesheetPeriods.id });

    await db.insert(timeEntries).values([
      // APPROVED period: this is the ONLY period whose entries should ever count.
      {
        orgId,
        userId: adminId,
        workDate: "2026-07-06",
        hours: "4.00",
        chargeClass: "DIRECT",
        contractId: contractA,
        milestoneId: milestone1,
        description: "milestone work",
        periodId: approvedPeriod!.id,
      },
      {
        orgId,
        userId: adminId,
        workDate: "2026-07-08",
        hours: "3.50",
        chargeClass: "DIRECT",
        contractId: contractA,
        description: "non-milestone contract A work",
        periodId: approvedPeriod!.id,
      },
      {
        orgId,
        userId: adminId,
        workDate: "2026-07-09",
        hours: "2.00",
        chargeClass: "DIRECT",
        contractId: contractB,
        description: "contract B work",
        periodId: approvedPeriod!.id,
      },
      {
        orgId,
        userId: adminId,
        workDate: "2026-07-10",
        hours: "1.00",
        chargeClass: "INDIRECT",
        description: "overhead",
        periodId: approvedPeriod!.id,
      },
      // SUBMITTED (not yet approved) — must NOT count even though it's DIRECT on contract A.
      {
        orgId,
        userId: adminId,
        workDate: "2026-07-14",
        hours: "6.00",
        chargeClass: "DIRECT",
        contractId: contractA,
        description: "not yet approved",
        periodId: submittedPeriod!.id,
      },
      // OPEN (still a draft) — must NOT count.
      {
        orgId,
        userId: adminId,
        workDate: "2026-07-21",
        hours: "5.00",
        chargeClass: "DIRECT",
        contractId: contractA,
        description: "still a draft",
        periodId: openPeriod!.id,
      },
    ]);
  });

  afterAll(async () => {
    if (!orgId) return;
    const db = getDb();
    await db.delete(timeEntries).where(eq(timeEntries.orgId, orgId));
    await db.delete(timesheetPeriods).where(eq(timesheetPeriods.orgId, orgId));
    await db.delete(contractMilestones).where(eq(contractMilestones.orgId, orgId));
    await db.delete(contracts).where(eq(contracts.orgId, orgId));
    await db.delete(users).where(eq(users.orgId, orgId));
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await getPool().end();
  });

  it("sums only APPROVED-period, DIRECT hours for the queried contract", async () => {
    // 4.00 + 3.50 from the APPROVED period; excludes the SUBMITTED (6.00) and OPEN (5.00) period
    // entries, and excludes the contract-B (2.00) and INDIRECT (1.00) entries.
    await expect(getApprovedHours(orgId, { contractId: contractA })).resolves.toBe(7.5);
  });

  it("scopes to a milestone when requested", async () => {
    await expect(getApprovedHours(orgId, { contractId: contractA, milestoneId: milestone1 })).resolves.toBe(4);
  });

  it("scopes to a different contract independently", async () => {
    await expect(getApprovedHours(orgId, { contractId: contractB })).resolves.toBe(2);
  });

  it("applies an inclusive date window", async () => {
    await expect(
      getApprovedHours(orgId, { contractId: contractA, from: "2026-07-07", to: "2026-07-08" }),
    ).resolves.toBe(3.5);
  });

  it("returns 0 for a contract with no approved direct hours", async () => {
    await expect(getApprovedHours(orgId, { contractId: "00000000-0000-0000-0000-000000000000" })).resolves.toBe(0);
  });
});
