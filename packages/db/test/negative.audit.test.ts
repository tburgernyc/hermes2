/**
 * audit_log is append-only. Two independent layers must hold:
 *   - the grant REVOKE: hermes_app keeps SELECT/INSERT but is denied UPDATE/DELETE, and
 *   - the trigger belt: even the OWNER cannot UPDATE/DELETE/TRUNCATE.
 * Each owner-block case runs in its own transaction (a failed statement aborts the rest).
 */
import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { HAS_DB, PG, capturePgError, setLocalRole, setOrgContext, withRollback } from "./helpers/db.js";
import { insertOrg } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

async function insertAuditRow(c: PoolClient, orgId: string): Promise<void> {
  await c.query(
    `INSERT INTO audit_log (org_id, actor_type, action) VALUES ($1, 'SYSTEM', 'test.event')`,
    [orgId],
  );
}

d("audit_log append-only", () => {
  it("hermes_app may INSERT but is DENIED UPDATE (grant REVOKE)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      await insertAuditRow(c, orgId); // INSERT allowed
      const err = await capturePgError(() =>
        c.query(`UPDATE audit_log SET action = 'tamper' WHERE org_id = $1`, [orgId]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("hermes_app is DENIED DELETE (grant REVOKE)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      const err = await capturePgError(() =>
        c.query(`DELETE FROM audit_log WHERE org_id = $1`, [orgId]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("the trigger blocks UPDATE even for the OWNER", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await insertAuditRow(c, orgId);
      const err = await capturePgError(() =>
        c.query(`UPDATE audit_log SET action = 'tamper' WHERE org_id = $1`, [orgId]),
      );
      expect(err?.code).toBe(PG.RAISE_EXCEPTION);
      expect(err?.message).toMatch(/append-only/i);
    }));

  it("the trigger blocks DELETE even for the OWNER", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await insertAuditRow(c, orgId);
      const err = await capturePgError(() =>
        c.query(`DELETE FROM audit_log WHERE org_id = $1`, [orgId]),
      );
      expect(err?.code).toBe(PG.RAISE_EXCEPTION);
      expect(err?.message).toMatch(/append-only/i);
    }));

  it("the trigger blocks TRUNCATE even for the OWNER", () =>
    withRollback(async (c) => {
      const err = await capturePgError(() => c.query(`TRUNCATE audit_log`));
      expect(err?.code).toBe(PG.RAISE_EXCEPTION);
      expect(err?.message).toMatch(/truncat/i);
    }));
});
