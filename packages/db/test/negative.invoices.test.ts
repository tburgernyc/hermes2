/**
 * §3.3/§3.4.5 finance-flow integrity (Phase A, O2): one invoices table with a structural
 * contract-XOR-teaming-agreement link (never one ambiguous bucket), status/timestamp pairing,
 * the payable → government-invoice clock linkage, and tenant isolation on the new tables.
 * The payable deliberately has NO stored due date — it derives from the linked invoice's paid_at.
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
  insertInvoice,
  insertMilestone,
  insertOrg,
  insertTeamingAgreement,
  insertTeamingPartner,
} from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("invoices XOR + payables clock linkage", () => {
  it("rejects an invoice linked to BOTH a contract and a teaming agreement", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const partnerId = await insertTeamingPartner(c, orgId);
      const agreementId = await insertTeamingAgreement(c, orgId, { partnerId });
      const err = await capturePgError(() =>
        insertInvoice(c, orgId, { contractId, teamingAgreementId: agreementId }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("invoices_link_xor");
    }));

  it("rejects an invoice linked to NEITHER side", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const err = await capturePgError(() => insertInvoice(c, orgId, {}));
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("invoices_link_xor");
    }));

  it("accepts a government invoice (contract side) and a partner invoice (teaming side)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const partnerId = await insertTeamingPartner(c, orgId);
      const agreementId = await insertTeamingAgreement(c, orgId, { partnerId });
      await expect(insertInvoice(c, orgId, { contractId })).resolves.toBeDefined();
      await expect(
        insertInvoice(c, orgId, { teamingAgreementId: agreementId }),
      ).resolves.toBeDefined();
    }));

  it("rejects a milestone on a partner-facing invoice (milestones are contract-scoped)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const milestoneId = await insertMilestone(c, orgId, { contractId });
      const partnerId = await insertTeamingPartner(c, orgId);
      const agreementId = await insertTeamingAgreement(c, orgId, { partnerId });
      const err = await capturePgError(() =>
        insertInvoice(c, orgId, { teamingAgreementId: agreementId, milestoneId }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("invoices_milestone_requires_contract");
    }));

  it("rejects status PAID without paid_at (the revenue-recognition timestamp)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const err = await capturePgError(() =>
        insertInvoice(c, orgId, { contractId, status: "PAID", submittedAt: new Date() }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("invoices_paid_requires_timestamp");
    }));

  it("rejects status SUBMITTED without submitted_at", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const err = await capturePgError(() =>
        insertInvoice(c, orgId, { contractId, status: "SUBMITTED" }),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("invoices_submitted_requires_timestamp");
    }));

  it("links a payable to its government invoice — two DISTINCT, linked flows (spec §4.7)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const invoiceId = await insertInvoice(c, orgId, {
        contractId,
        status: "PAID",
        submittedAt: new Date(),
        paidAt: new Date(),
      });
      await expect(
        c.query(
          `INSERT INTO subcontractor_payables (org_id, contract_id, amount, government_invoice_id)
           VALUES ($1, $2, '500.00', $3)`,
          [orgId, contractId, invoiceId],
        ),
      ).resolves.toBeDefined();
      // The payable stores NO due date: the deadline derives at runtime from invoices.paid_at.
      const cols = await c.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'subcontractor_payables' AND column_name LIKE '%due%'`,
      );
      expect(cols.rows).toHaveLength(0);
    }));

  it("rejects a payable marked PAID without paid_at", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO subcontractor_payables (org_id, contract_id, amount, status)
           VALUES ($1, $2, '500.00', 'PAID')`,
          [orgId, contractId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("payables_paid_requires_timestamp");
    }));

  it("duplicate invoice number in one org is rejected (invoices_org_number_key)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      await c.query(
        `INSERT INTO invoices (org_id, contract_id, invoice_number, amount)
         VALUES ($1, $2, 'INV-DUP', '1.00')`,
        [orgId, contractId],
      );
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO invoices (org_id, contract_id, invoice_number, amount)
           VALUES ($1, $2, 'INV-DUP', '2.00')`,
          [orgId, contractId],
        ),
      );
      expect(err?.code).toBe(PG.UNIQUE_VIOLATION);
    }));

  it("tenant isolation: hermes_app cannot write an invoice for another org (WITH CHECK)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const contractB = await insertContract(c, orgB);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgA); // context = A, row claims B
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO invoices (org_id, contract_id, invoice_number, amount)
           VALUES ($1, $2, 'INV-X', '1.00')`,
          [orgB, contractB],
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("tenant isolation: org A cannot read org B's invoices (0 rows)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const contractB = await insertContract(c, orgB);
      await insertInvoice(c, orgB, { contractId: contractB });
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgA);
      const res = await c.query<{ n: string }>(`SELECT count(*)::text AS n FROM invoices`);
      expect(res.rows[0]?.n).toBe("0");
    }));

  it("hermes_token has NO grant on invoices (fail-closed)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      const err = await capturePgError(() => c.query(`SELECT count(*) FROM invoices`));
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));
});
