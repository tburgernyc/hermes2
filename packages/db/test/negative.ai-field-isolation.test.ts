/**
 * Migration 0012 — operator-only AI fields are withheld from the low-trust roles at the GRANT layer.
 * The AI outputs surfaced on the console (triage summary/recommendation, quote injection flags, per-quote
 * score/risks, proposal narrative) live on tables that hermes_vendor / hermes_token can already SELECT, so
 * 0012 switches those grants to column-level (excluding the operator columns). These negatives prove the
 * RUNTIME behaviour the grants imply: a SELECT of an operator-only column under the low-trust role is
 * denied (42501), while the safe browse columns still read. (The catalog-level assertion lives in
 * schema.guards; this is the behavioural belt.)
 *
 * A column-privilege denial is raised before RLS row evaluation, so no seeded rows are required — but we
 * still set the org/vendor GUCs to valid uuids so an unrelated empty-GUC `''::uuid` cast can never mask
 * the assertion. Because a denied query ABORTS the surrounding transaction, every probe runs inside its
 * own SAVEPOINT so the next probe in the same role/transaction is unaffected. outreach_campaigns is not
 * tested here: the low-trust roles have NO grant on it at all (its AI match fields are unreachable).
 */
import { describe, expect, it } from "vitest";

import type { PoolClient } from "pg";

import {
  HAS_DB,
  PG,
  asPgError,
  setLocalRole,
  setOrgContext,
  setVendorContext,
  withRollback,
  type PgError,
} from "./helpers/db.js";

const d = HAS_DB ? describe : describe.skip;

// Arbitrary, valid uuids for the RLS GUCs (no row needs to exist — the column-perm check fires first).
const ORG = "00000000-0000-0000-0000-0000000000aa";
const VENDOR = "00000000-0000-0000-0000-0000000000bb";

/**
 * Run one SELECT inside a SAVEPOINT and return the PgError it raised (or undefined). The savepoint is
 * always rolled back + released, so a denied probe (which aborts its subtransaction) leaves the outer
 * transaction usable for the next probe under the same role.
 */
async function probe(c: PoolClient, sql: string): Promise<PgError | undefined> {
  await c.query("SAVEPOINT p");
  try {
    await c.query(sql);
    await c.query("RELEASE SAVEPOINT p");
    return undefined;
  } catch (err) {
    await c.query("ROLLBACK TO SAVEPOINT p");
    await c.query("RELEASE SAVEPOINT p");
    return asPgError(err);
  }
}

d("0012: low-trust roles cannot read operator-only AI fields", () => {
  it("hermes_vendor is DENIED the solicitations triage AI fields", () =>
    withRollback(async (c) => {
      await setOrgContext(c, ORG);
      await setVendorContext(c, VENDOR);
      await setLocalRole(c, "hermes_vendor");

      expect((await probe(c, "SELECT triage_summary FROM solicitations LIMIT 1"))?.code).toBe(
        PG.INSUFFICIENT_PRIVILEGE,
      );
      expect((await probe(c, "SELECT quote_injection_attempts FROM solicitations LIMIT 1"))?.code).toBe(
        PG.INSUFFICIENT_PRIVILEGE,
      );
      expect((await probe(c, "SELECT triage_recommendation FROM solicitations LIMIT 1"))?.code).toBe(
        PG.INSUFFICIENT_PRIVILEGE,
      );
      // ...but the safe browse columns still read (RFQ browse preserved).
      expect(await probe(c, "SELECT id, title, status, scope_text FROM solicitations LIMIT 1")).toBeUndefined();
    }));

  it("hermes_vendor is DENIED the vendor_quotes AI evaluation fields (own quotes included)", () =>
    withRollback(async (c) => {
      await setOrgContext(c, ORG);
      await setVendorContext(c, VENDOR);
      await setLocalRole(c, "hermes_vendor");

      expect((await probe(c, "SELECT ai_score FROM vendor_quotes LIMIT 1"))?.code).toBe(
        PG.INSUFFICIENT_PRIVILEGE,
      );
      expect((await probe(c, "SELECT ai_risks FROM vendor_quotes LIMIT 1"))?.code).toBe(
        PG.INSUFFICIENT_PRIVILEGE,
      );
      // ...but the existing pricing/rank columns still read.
      expect(await probe(c, "SELECT total_price, ai_rank FROM vendor_quotes LIMIT 1")).toBeUndefined();
    }));

  it("hermes_vendor is DENIED the proposals AI narrative (other proposal columns still read)", () =>
    withRollback(async (c) => {
      await setOrgContext(c, ORG);
      await setVendorContext(c, VENDOR);
      await setLocalRole(c, "hermes_vendor");

      expect((await probe(c, "SELECT narrative FROM proposals LIMIT 1"))?.code).toBe(
        PG.INSUFFICIENT_PRIVILEGE,
      );
      expect(await probe(c, "SELECT status, contract_type FROM proposals LIMIT 1")).toBeUndefined();
    }));

  it("hermes_token is DENIED the solicitations triage AI summary but keeps its browse", () =>
    withRollback(async (c) => {
      await setOrgContext(c, ORG);
      await setLocalRole(c, "hermes_token");

      expect((await probe(c, "SELECT triage_summary FROM solicitations LIMIT 1"))?.code).toBe(
        PG.INSUFFICIENT_PRIVILEGE,
      );
      expect(await probe(c, "SELECT title, contract_type FROM solicitations LIMIT 1")).toBeUndefined();
    }));
});
