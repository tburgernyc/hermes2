/**
 * §3.1.4 subcontract-agreement review gate (Phase A): the drafted subcontract is a binding legal
 * document going to a third party, so the e-signature flow may only START (esign_status leaves
 * NOT_STARTED) after an admin explicitly reviews/confirms the agreement — recorded as
 * agreement_reviewed_by/at, CHECK-enforced. Never auto-kicked the instant the contracts row
 * exists (Prime Directive §2). Plus the vendor-signature pairing CHECK (§7.3 substrate).
 */
import { describe, expect, it } from "vitest";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import { insertContract, insertOrg, insertUser } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("contracts e-sign review gate + signer pairing", () => {
  it.each(["SENT", "SIGNED", "DECLINED", "EXPIRED"] as const)(
    "blocks esign_status → %s without a recorded agreement review",
    (esign) =>
      withRollback(async (c) => {
        const orgId = await insertOrg(c);
        const contractId = await insertContract(c, orgId);
        const err = await capturePgError(() =>
          c.query(`UPDATE contracts SET esign_status = $2::esign_status WHERE id = $1`, [
            contractId,
            esign,
          ]),
        );
        expect(err?.code).toBe(PG.CHECK_VIOLATION);
        expect(err?.constraint).toBe("contracts_esign_requires_review");
      }),
  );

  it("blocks a review recorded without its timestamp from opening the gate", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" });
      const contractId = await insertContract(c, orgId);
      const err = await capturePgError(() =>
        c.query(
          `UPDATE contracts SET esign_status = 'SENT', agreement_reviewed_by = $2 WHERE id = $1`,
          [contractId, adminId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("contracts_esign_requires_review");
    }));

  it("allows the e-sign flow once an admin review is recorded (by + at)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" });
      const contractId = await insertContract(c, orgId);
      await expect(
        c.query(
          `UPDATE contracts SET
             esign_status = 'SENT', agreement_reviewed_by = $2, agreement_reviewed_at = now()
           WHERE id = $1`,
          [contractId, adminId],
        ),
      ).resolves.toBeDefined();
    }));

  it("rejects a half-set vendor signature (contracts_vendor_signed_pair)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const err = await capturePgError(() =>
        c.query(`UPDATE contracts SET vendor_signed_at = now() WHERE id = $1`, [contractId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("contracts_vendor_signed_pair");
    }));

  it("accelerated_payments defaults TRUE (small-business-sub Prompt Payment default)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const contractId = await insertContract(c, orgId);
      const res = await c.query<{ accelerated_payments: boolean }>(
        `SELECT accelerated_payments FROM contracts WHERE id = $1`,
        [contractId],
      );
      expect(res.rows[0]?.accelerated_payments).toBe(true);
    }));
});
