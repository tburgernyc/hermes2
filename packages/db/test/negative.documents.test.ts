/**
 * documents holds untrusted vendor uploads (CLAUDE.md §5) and is polymorphic. Two CHECKs keep it
 * honest: exactly one owner FK column set (documents_owner_exactly_one) and that column must match
 * entity_type (documents_owner_matches_type). The FK ON DELETE rules also encode "no history
 * erasure": a legal artifact (proposal/contract/…) cannot be cascade-deleted, while a prospect's
 * own documents cascade. Owner-side tests run as the owner (these are CHECK/FK invariants).
 */
import { describe, expect, it } from "vitest";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import {
  insertInsurancePolicy,
  insertOrg,
  insertProposal,
  insertProspect,
  insertSolicitation,
  insertTeamingAgreement,
  insertTeamingPartner,
  insertVendor,
} from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

const DOC_COLS = "storage_key, content_type, byte_size";
const DOC_VALS = "'k', 'application/pdf', 10";

d("documents polymorphic-owner integrity + legal-history FK rules", () => {
  it("rejects a document with NO owner column (documents_owner_exactly_one)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO documents (org_id, entity_type, ${DOC_COLS})
           VALUES ($1, 'SOLICITATION', ${DOC_VALS})`,
          [orgId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("documents_owner_exactly_one");
    }));

  it("rejects a document with TWO owner columns (documents_owner_exactly_one)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const vendorId = await insertVendor(c, orgId);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO documents (org_id, entity_type, solicitation_id, vendor_id, ${DOC_COLS})
           VALUES ($1, 'SOLICITATION', $2, $3, ${DOC_VALS})`,
          [orgId, solId, vendorId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("documents_owner_exactly_one");
    }));

  it("rejects an owner column that does not match entity_type (documents_owner_matches_type)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorId = await insertVendor(c, orgId);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO documents (org_id, entity_type, vendor_id, ${DOC_COLS})
           VALUES ($1, 'SOLICITATION', $2, ${DOC_VALS})`,
          [orgId, vendorId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("documents_owner_matches_type");
    }));

  it("accepts a well-formed, type-matched document", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      await expect(
        c.query(
          `INSERT INTO documents (org_id, entity_type, solicitation_id, ${DOC_COLS})
           VALUES ($1, 'SOLICITATION', $2, ${DOC_VALS})`,
          [orgId, solId],
        ),
      ).resolves.toBeDefined();
    }));

  it("RESTRICTs deleting a proposal that owns a document (no history erasure)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const propId = await insertProposal(c, orgId, { solicitationId: solId, status: "DRAFT" });
      await c.query(
        `INSERT INTO documents (org_id, entity_type, proposal_id, ${DOC_COLS})
         VALUES ($1, 'PROPOSAL', $2, ${DOC_VALS})`,
        [orgId, propId],
      );
      const err = await capturePgError(() =>
        c.query(`DELETE FROM proposals WHERE id=$1`, [propId]),
      );
      // ON DELETE RESTRICT raises 23001 (restrict_violation); NO ACTION would raise 23503. Either
      // way the delete is blocked — the "no history erasure" invariant holds.
      expect(["23001", "23503"]).toContain(err?.code);
    }));

  it("CASCADEs a prospect's documents when the prospect is deleted", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const prospectId = await insertProspect(c, orgId);
      const inserted = await c.query<{ id: string }>(
        `INSERT INTO documents (org_id, entity_type, prospect_id, ${DOC_COLS})
         VALUES ($1, 'VENDOR_PROSPECT', $2, ${DOC_VALS}) RETURNING id`,
        [orgId, prospectId],
      );
      const docId = inserted.rows[0]?.id;
      await c.query(`DELETE FROM vendor_prospects WHERE id=$1`, [prospectId]);
      const after = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM documents WHERE id=$1`,
        [docId],
      );
      expect(after.rows[0]?.n).toBe(0);
    }));

  // ---- Phase A (O3): the two NEW owners join the same XOR + type-match discipline ----

  it("accepts a TEAMING_AGREEMENT-owned document (new owner arm)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const partnerId = await insertTeamingPartner(c, orgId);
      const agreementId = await insertTeamingAgreement(c, orgId, { partnerId });
      await expect(
        c.query(
          `INSERT INTO documents (org_id, entity_type, teaming_agreement_id, ${DOC_COLS})
           VALUES ($1, 'TEAMING_AGREEMENT', $2, ${DOC_VALS})`,
          [orgId, agreementId],
        ),
      ).resolves.toBeDefined();
    }));

  it("accepts an INSURANCE_POLICY-owned document (new owner arm)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const policyId = await insertInsurancePolicy(c, orgId);
      await expect(
        c.query(
          `INSERT INTO documents (org_id, entity_type, insurance_policy_id, ${DOC_COLS})
           VALUES ($1, 'INSURANCE_POLICY', $2, ${DOC_VALS})`,
          [orgId, policyId],
        ),
      ).resolves.toBeDefined();
    }));

  it("rejects TWO owners when one is a NEW owner column (documents_owner_exactly_one)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const partnerId = await insertTeamingPartner(c, orgId);
      const agreementId = await insertTeamingAgreement(c, orgId, { partnerId });
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO documents (org_id, entity_type, solicitation_id, teaming_agreement_id, ${DOC_COLS})
           VALUES ($1, 'TEAMING_AGREEMENT', $2, $3, ${DOC_VALS})`,
          [orgId, solId, agreementId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("documents_owner_exactly_one");
    }));

  it("rejects a TEAMING_AGREEMENT entity_type whose owner column is wrong (type match)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const policyId = await insertInsurancePolicy(c, orgId);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO documents (org_id, entity_type, insurance_policy_id, ${DOC_COLS})
           VALUES ($1, 'TEAMING_AGREEMENT', $2, ${DOC_VALS})`,
          [orgId, policyId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("documents_owner_matches_type");
    }));

  it("RESTRICTs deleting a teaming agreement that owns a document (no history erasure)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const partnerId = await insertTeamingPartner(c, orgId);
      const agreementId = await insertTeamingAgreement(c, orgId, { partnerId });
      await c.query(
        `INSERT INTO documents (org_id, entity_type, teaming_agreement_id, ${DOC_COLS})
         VALUES ($1, 'TEAMING_AGREEMENT', $2, ${DOC_VALS})`,
        [orgId, agreementId],
      );
      const err = await capturePgError(() =>
        c.query(`DELETE FROM teaming_agreements WHERE id=$1`, [agreementId]),
      );
      expect(["23001", "23503"]).toContain(err?.code);
    }));

  // ---- Phase A (§3.7.3): retention review pairing ----

  it("rejects a half-recorded retention review (documents_retention_review_pair)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const inserted = await c.query<{ id: string }>(
        `INSERT INTO documents (org_id, entity_type, solicitation_id, ${DOC_COLS})
         VALUES ($1, 'SOLICITATION', $2, ${DOC_VALS}) RETURNING id`,
        [orgId, solId],
      );
      const err = await capturePgError(() =>
        c.query(`UPDATE documents SET retention_reviewed_at = now() WHERE id = $1`, [
          inserted.rows[0]?.id,
        ]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("documents_retention_review_pair");
    }));
});
