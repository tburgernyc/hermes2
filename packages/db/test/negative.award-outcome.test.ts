/**
 * §3.1 award-outcome human gate (Phase A, O6): a solicitation may reach the post-submission
 * outcome states AWARDED / REJECTED / CLOSED only with a recorded human (outcome_recorded_by/at)
 * — the same structural human-gate pattern as solicitations_sourcing_gate. NO_GO (the
 * pre-submission triage rejection) is deliberately NOT gated, so the existing markNoGo path keeps
 * working. Mirrors the Prime Directive: the government's decision is recorded by the operator,
 * never inferred/advanced by a model.
 */
import { describe, expect, it } from "vitest";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import { insertOrg, insertSolicitation, insertUser } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("solicitation award-outcome human gate", () => {
  it.each(["AWARDED", "REJECTED", "CLOSED"] as const)(
    "blocks status → %s without a recorded outcome human",
    (status) =>
      withRollback(async (c) => {
        const orgId = await insertOrg(c);
        const adminId = await insertUser(c, orgId, { role: "ADMIN" });
        // sourcing gate satisfied (required for AWARDED) so ONLY the outcome gate can fire.
        const solId = await insertSolicitation(c, orgId, { sourcingApprovedBy: adminId });
        const err = await capturePgError(() =>
          c.query(`UPDATE solicitations SET status = $2::solicitation_status WHERE id = $1`, [
            solId,
            status,
          ]),
        );
        expect(err?.code).toBe(PG.CHECK_VIOLATION);
        expect(err?.constraint).toBe("solicitations_outcome_gate");
      }),
  );

  it("blocks an outcome with the recorder but NO timestamp", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId, { sourcingApprovedBy: adminId });
      const err = await capturePgError(() =>
        c.query(
          `UPDATE solicitations SET status = 'REJECTED', outcome_recorded_by = $2 WHERE id = $1`,
          [solId, adminId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("solicitations_outcome_gate");
    }));

  it("allows AWARDED with a recorded human + timestamp (and the award details)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId, { sourcingApprovedBy: adminId });
      await expect(
        c.query(
          `UPDATE solicitations SET
             status = 'AWARDED', outcome_recorded_by = $2, outcome_recorded_at = now(),
             awarded_piid = 'W91234-26-C-0001', awarded_value = '250000.00', award_date = now(),
             co_contact = '{"name":"Jane CO","email":"jane.co@agency.gov"}'::jsonb
           WHERE id = $1`,
          [solId, adminId],
        ),
      ).resolves.toBeDefined();
    }));

  it("allows CLOSED (cancellation/no-award) with a recorded human + timestamp", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId);
      await expect(
        c.query(
          `UPDATE solicitations SET
             status = 'CLOSED', outcome_recorded_by = $2, outcome_recorded_at = now(),
             outcome_notes = 'Agency cancelled the solicitation.'
           WHERE id = $1`,
          [solId, adminId],
        ),
      ).resolves.toBeDefined();
    }));

  it("does NOT gate NO_GO (pre-submission triage rejection stays recorder-free)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { status: "TRIAGE_COMPLETE" });
      await expect(
        c.query(`UPDATE solicitations SET status = 'NO_GO' WHERE id = $1`, [solId]),
      ).resolves.toBeDefined();
    }));

  it("rejects a negative awarded_value", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const err = await capturePgError(() =>
        c.query(`UPDATE solicitations SET awarded_value = '-1.00' WHERE id = $1`, [solId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("solicitations_awarded_value_nonneg");
    }));

  it("cross-org outcome recorder is impossible (composite FK)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const adminB = await insertUser(c, orgB, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgA);
      const err = await capturePgError(() =>
        c.query(
          `UPDATE solicitations SET
             status = 'CLOSED', outcome_recorded_by = $2, outcome_recorded_at = now()
           WHERE id = $1`,
          [solId, adminB],
        ),
      );
      expect(err?.code).toBe(PG.FK_VIOLATION);
    }));

  it("L/M matrix requires extraction provenance (solicitations_lm_provenance)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const err = await capturePgError(() =>
        c.query(`UPDATE solicitations SET lm_compliance_matrix = '[]'::jsonb WHERE id = $1`, [
          solId,
        ]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("solicitations_lm_provenance");
    }));
});
