/**
 * The Prime Directive at the data layer: nothing reaches SUBMITTED without explicit human + counsel
 * sign-off, and a solicitation cannot be marked SUBMITTED unless a SUBMITTED (human+counsel-gated)
 * proposal exists. Covers both proposal CHECKs independently + the cross-table trigger (both ways).
 */
import { describe, expect, it } from "vitest";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import { insertOrg, insertProposal, insertSolicitation, insertUser } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("no-auto-submit human + counsel gates", () => {
  it("blocks proposal → SUBMITTED with NEITHER human nor counsel sign-off", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const propId = await insertProposal(c, orgId, { solicitationId: solId, status: "DRAFT" });
      const err = await capturePgError(() =>
        c.query(`UPDATE proposals SET status = 'SUBMITTED' WHERE id = $1`, [propId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(["proposals_submit_requires_human", "proposals_submit_requires_counsel"]).toContain(
        err?.constraint,
      );
    }));

  it("blocks SUBMITTED with human sign-off but NO counsel review", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const userId = await insertUser(c, orgId, { role: "ADMIN" });
      const propId = await insertProposal(c, orgId, { solicitationId: solId, status: "DRAFT" });
      const err = await capturePgError(() =>
        c.query(
          `UPDATE proposals SET status='SUBMITTED', submitted_by=$2, submitted_at=now() WHERE id=$1`,
          [propId, userId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("proposals_submit_requires_counsel");
    }));

  it("blocks SUBMITTED with counsel review but NO human sign-off", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const userId = await insertUser(c, orgId, { role: "ADMIN" });
      const propId = await insertProposal(c, orgId, { solicitationId: solId, status: "DRAFT" });
      const err = await capturePgError(() =>
        c.query(
          `UPDATE proposals SET status='SUBMITTED', counsel_reviewed_by=$2, counsel_reviewed_at=now() WHERE id=$1`,
          [propId, userId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("proposals_submit_requires_human");
    }));

  it("allows SUBMITTED only with BOTH human + counsel sign-off", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const userId = await insertUser(c, orgId, { role: "ADMIN" });
      const propId = await insertProposal(c, orgId, { solicitationId: solId, status: "DRAFT" });
      await expect(
        c.query(
          `UPDATE proposals SET status='SUBMITTED', submitted_by=$2, submitted_at=now(),
             counsel_reviewed_by=$2, counsel_reviewed_at=now() WHERE id=$1`,
          [propId, userId],
        ),
      ).resolves.toBeDefined();
    }));

  it("blocks solicitation → SUBMITTED without a SUBMITTED proposal (cross-table trigger)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const approver = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId, {
        status: "PROPOSAL_DRAFT",
        sourcingApprovedBy: approver,
      });
      const err = await capturePgError(() =>
        c.query(`UPDATE solicitations SET status='SUBMITTED' WHERE id=$1`, [solId]),
      );
      expect(err?.code).toBe(PG.RAISE_EXCEPTION);
      expect(err?.message).toMatch(/proposal/i);
    }));

  it("allows solicitation → SUBMITTED once a human+counsel-gated proposal is SUBMITTED", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const approver = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId, {
        status: "PROPOSAL_DRAFT",
        sourcingApprovedBy: approver,
      });
      await insertProposal(c, orgId, {
        solicitationId: solId,
        status: "SUBMITTED",
        submittedBy: approver,
        counselReviewedBy: approver,
      });
      await expect(
        c.query(`UPDATE solicitations SET status='SUBMITTED' WHERE id=$1`, [solId]),
      ).resolves.toBeDefined();
    }));

  it("blocks solicitation → SUBMITTED when only a DRAFT proposal exists (predicate is status, not existence)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const approver = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId, {
        status: "PROPOSAL_DRAFT",
        sourcingApprovedBy: approver,
      });
      // A proposal EXISTS but is not SUBMITTED — the guard must still block.
      await insertProposal(c, orgId, { solicitationId: solId, status: "DRAFT" });
      const err = await capturePgError(() =>
        c.query(`UPDATE solicitations SET status='SUBMITTED' WHERE id=$1`, [solId]),
      );
      expect(err?.code).toBe(PG.RAISE_EXCEPTION);
      expect(err?.message).toMatch(/proposal/i);
    }));
});

// CLAUDE.md §2 (the AI may not self-advance workflow state): a solicitation cannot enter a
// human-gated sourcing state without a recorded approver + timestamp (solicitations_sourcing_gate).
d("sourcing approval gate", () => {
  it("blocks advancing to READY_FOR_SOURCING with no approver", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId); // PENDING_TRIAGE, no approver
      const err = await capturePgError(() =>
        c.query(`UPDATE solicitations SET status='READY_FOR_SOURCING' WHERE id=$1`, [solId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("solicitations_sourcing_gate");
    }));

  it("blocks advancing to PROPOSAL_DRAFT with no approver", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const err = await capturePgError(() =>
        c.query(`UPDATE solicitations SET status='PROPOSAL_DRAFT' WHERE id=$1`, [solId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("solicitations_sourcing_gate");
    }));

  it("blocks a half-set gate (approver present but timestamp NULL)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const approver = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId);
      const err = await capturePgError(() =>
        c.query(
          `UPDATE solicitations SET status='READY_FOR_SOURCING', sourcing_approved_by=$2,
             sourcing_approved_at=NULL WHERE id=$1`,
          [solId, approver],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("solicitations_sourcing_gate");
    }));

  it("allows the advance once approver + timestamp are recorded", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const approver = await insertUser(c, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(c, orgId);
      await expect(
        c.query(
          `UPDATE solicitations SET status='READY_FOR_SOURCING', sourcing_approved_by=$2,
             sourcing_approved_at=now() WHERE id=$1`,
          [solId, approver],
        ),
      ).resolves.toBeDefined();
    }));
});
