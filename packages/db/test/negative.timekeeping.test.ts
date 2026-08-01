/**
 * §3.5 DCAA timekeeping integrity (Phase A): the timesheet-period approval human gate
 * (CHECK-enforced, same pattern as outreach approval), direct-labor-requires-contract
 * segregation, and the APPEND-ONLY correction trail (triggers + REVOKE mirror audit_log —
 * a correction can never be silently rewritten or erased, even by the app role).
 */
import { describe, expect, it } from "vitest";
import {
  HAS_DB,
  PG,
  capturePgError,
  setLocalRole,
  setOrgContext,
  withRollback,
} from "./helpers/db.js";
import {
  insertContract,
  insertOrg,
  insertTimeEntry,
  insertTimesheetPeriod,
  insertUser,
} from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("timekeeping: approval gate, segregation, append-only corrections", () => {
  it("blocks a period → APPROVED without a recorded approver (the human gate)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const periodId = await insertTimesheetPeriod(c, orgId, {
        userId,
        status: "SUBMITTED",
        submittedAt: new Date(),
      });
      const err = await capturePgError(() =>
        c.query(`UPDATE timesheet_periods SET status = 'APPROVED' WHERE id = $1`, [periodId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("timesheet_periods_approval_gate");
    }));

  it("blocks SUBMITTED without submitted_at", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const err = await capturePgError(() =>
        insertTimesheetPeriod(c, orgId, { userId, status: "SUBMITTED" }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("timesheet_periods_submit_requires_timestamp");
    }));

  it("allows APPROVED with approver + timestamps (the explicit admin approval)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" });
      await expect(
        insertTimesheetPeriod(c, orgId, {
          userId,
          status: "APPROVED",
          submittedAt: new Date(),
          approvedBy: adminId,
          approvedAt: new Date(),
        }),
      ).resolves.toBeDefined();
    }));

  it("rejects DIRECT labor with no contract (segregation of direct costs)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const err = await capturePgError(() =>
        insertTimeEntry(c, orgId, { userId, chargeClass: "DIRECT" }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("time_entries_direct_requires_contract");
    }));

  it("accepts DIRECT labor charged to a contract; rejects out-of-range hours", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const contractId = await insertContract(c, orgId);
      await expect(
        insertTimeEntry(c, orgId, { userId, chargeClass: "DIRECT", contractId }),
      ).resolves.toBeDefined();
      const err = await capturePgError(() =>
        insertTimeEntry(c, orgId, { userId, hours: "25.00" }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("time_entries_hours_range");
    }));

  it("rejects a blank work description (DCAA: what was performed, always)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const err = await capturePgError(() =>
        insertTimeEntry(c, orgId, { userId, description: "   " }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("time_entries_description_present");
    }));

  it("records a correction (old/new/reason) and blocks UPDATE on it — append-only", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const entryId = await insertTimeEntry(c, orgId, { userId });
      const inserted = await c.query<{ id: string }>(
        `INSERT INTO time_entry_corrections
           (org_id, time_entry_id, corrected_by, old_values, new_values, reason)
         VALUES ($1, $2, $3, '{"hours":"8.00"}', '{"hours":"6.50"}', 'Entered wrong hours')
         RETURNING id`,
        [orgId, entryId, userId],
      );
      const correctionId = inserted.rows[0]?.id;
      expect(correctionId).toBeDefined();
      const err = await capturePgError(() =>
        c.query(`UPDATE time_entry_corrections SET reason = 'rewritten' WHERE id = $1`, [
          correctionId,
        ]),
      );
      expect(err?.code).toBe(PG.RAISE_EXCEPTION);
      expect(err?.message).toMatch(/append-only/i);
    }));

  it("blocks DELETE of a correction (even as the owner — trigger, not just REVOKE)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const entryId = await insertTimeEntry(c, orgId, { userId });
      await c.query(
        `INSERT INTO time_entry_corrections
           (org_id, time_entry_id, corrected_by, old_values, new_values, reason)
         VALUES ($1, $2, $3, '{}', '{}', 'r')`,
        [orgId, entryId, userId],
      );
      const err = await capturePgError(() => c.query(`DELETE FROM time_entry_corrections`));
      expect(err?.code).toBe(PG.RAISE_EXCEPTION);
    }));

  it("hermes_app cannot UPDATE/DELETE corrections (0004 REVOKE — the suspenders)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const entryId = await insertTimeEntry(c, orgId, { userId });
      await c.query(
        `INSERT INTO time_entry_corrections
           (org_id, time_entry_id, corrected_by, old_values, new_values, reason)
         VALUES ($1, $2, $3, '{}', '{}', 'r')`,
        [orgId, entryId, userId],
      );
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      const err = await capturePgError(() =>
        c.query(`UPDATE time_entry_corrections SET reason = 'x'`),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("rejects a correction with a blank reason", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const entryId = await insertTimeEntry(c, orgId, { userId });
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO time_entry_corrections
             (org_id, time_entry_id, corrected_by, old_values, new_values, reason)
           VALUES ($1, $2, $3, '{}', '{}', '  ')`,
          [orgId, entryId, userId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("time_entry_corrections_reason_present");
    }));

  it("an entry with corrections cannot be deleted (RESTRICT — the trail pins the entry)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const userId = await insertUser(c, orgId);
      const entryId = await insertTimeEntry(c, orgId, { userId });
      await c.query(
        `INSERT INTO time_entry_corrections
           (org_id, time_entry_id, corrected_by, old_values, new_values, reason)
         VALUES ($1, $2, $3, '{}', '{}', 'r')`,
        [orgId, entryId, userId],
      );
      const err = await capturePgError(() =>
        c.query(`DELETE FROM time_entries WHERE id = $1`, [entryId]),
      );
      // Composite-FK ON DELETE RESTRICT raises 23001 (restrict_violation), not 23503 (Phase-1 footgun).
      expect(["23001", "23503"]).toContain(err?.code);
    }));
});
