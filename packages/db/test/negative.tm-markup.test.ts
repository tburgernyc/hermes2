/**
 * T&M zero-markup lock (CLAUDE.md §6.2): under a T&M solicitation, MATERIAL and SUBCONTRACT line
 * items must carry 0 markup (profit lives only in burdened labor rates). The line item's
 * contract_type is denormalized + trigger-synced from its quote's solicitation, so these tests also
 * prove the sync trigger drives the lock.
 */
import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import { insertOrg, insertQuote, insertSolicitation, insertVendor } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

async function quoteUnder(
  c: PoolClient,
  contractType: "TM" | "FFP",
): Promise<{ orgId: string; quoteId: string }> {
  const orgId = await insertOrg(c);
  const solId = await insertSolicitation(c, orgId, { contractType });
  const vendorId = await insertVendor(c, orgId);
  const quoteId = await insertQuote(c, orgId, { solicitationId: solId, vendorId });
  return { orgId, quoteId };
}

// `placeholder` is a deliberately-wrong client-supplied contract_type; the sync trigger must
// overwrite it from the solicitation before the lock CHECK is evaluated.
async function insertLineItem(
  c: PoolClient,
  orgId: string,
  quoteId: string,
  costType: string,
  markupPct: number,
  placeholder = "FFP",
): Promise<void> {
  await c.query(
    `INSERT INTO vendor_quote_line_items
       (org_id, quote_id, cost_type, contract_type, description, unit_rate, markup_pct)
     VALUES ($1, $2, $3::cost_type, $5::contract_type, 'line', 100, $4)`,
    [orgId, quoteId, costType, markupPct, placeholder],
  );
}

async function storedContractType(c: PoolClient, quoteId: string): Promise<string | undefined> {
  const r = await c.query<{ contract_type: string }>(
    `SELECT contract_type FROM vendor_quote_line_items WHERE quote_id = $1`,
    [quoteId],
  );
  return r.rows[0]?.contract_type;
}

d("T&M zero-markup lock + contract_type sync", () => {
  it("rejects nonzero markup on MATERIAL under a T&M solicitation", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "TM");
      const err = await capturePgError(() => insertLineItem(c, orgId, quoteId, "MATERIAL", 5));
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("line_items_tm_markup_lock");
    }));

  it("rejects nonzero markup on SUBCONTRACT under a T&M solicitation", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "TM");
      const err = await capturePgError(() => insertLineItem(c, orgId, quoteId, "SUBCONTRACT", 10));
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("line_items_tm_markup_lock");
    }));

  it("allows zero markup on MATERIAL under T&M and syncs contract_type to TM", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "TM");
      await insertLineItem(c, orgId, quoteId, "MATERIAL", 0);
      expect(await storedContractType(c, quoteId)).toBe("TM");
    }));

  it("allows nonzero markup on LABOR under T&M (lock targets MATERIAL/SUBCONTRACT only)", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "TM");
      await expect(insertLineItem(c, orgId, quoteId, "LABOR", 15)).resolves.toBeUndefined();
    }));

  it("allows nonzero markup on MATERIAL under FFP, overwriting a wrong 'TM' placeholder → FFP", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "FFP");
      // Passing 'TM' as the placeholder: if the sync trigger did NOT overwrite it, contract_type
      // would stay 'TM' and MATERIAL markup 5 would violate the lock. It succeeding + storing 'FFP'
      // proves the trigger overwrote from the solicitation.
      await insertLineItem(c, orgId, quoteId, "MATERIAL", 5, "TM");
      expect(await storedContractType(c, quoteId)).toBe("FFP");
    }));

  it("rejects flipping markup to nonzero on an existing T&M MATERIAL row (UPDATE path)", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "TM");
      await insertLineItem(c, orgId, quoteId, "MATERIAL", 0); // valid: 0 markup under T&M
      const err = await capturePgError(() =>
        c.query(`UPDATE vendor_quote_line_items SET markup_pct = 5 WHERE quote_id = $1`, [quoteId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("line_items_tm_markup_lock");
    }));
});

// FAR 52.219-14 (CLAUDE.md §6.1): a line item flagged similarly-situated must have a SMALL sub
// status — line_items_sim_situated_consistency. Exercised under FFP so the T&M lock can't interfere.
d("similarly-situated consistency (FAR 52.219-14)", () => {
  async function insertSub(
    c: PoolClient,
    orgId: string,
    quoteId: string,
    similarlySituated: boolean | null,
    subStatus: string | null,
  ): Promise<void> {
    await c.query(
      `INSERT INTO vendor_quote_line_items
         (org_id, quote_id, cost_type, contract_type, description, unit_rate, markup_pct,
          similarly_situated, sub_small_business_status)
       VALUES ($1, $2, 'SUBCONTRACT', 'FFP', 'sub', 100, 0, $3, $4::small_business_status)`,
      [orgId, quoteId, similarlySituated, subStatus],
    );
  }

  it("rejects similarly_situated=TRUE with a non-SMALL sub status", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "FFP");
      const err = await capturePgError(() => insertSub(c, orgId, quoteId, true, "OTHER_THAN_SMALL"));
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("line_items_sim_situated_consistency");
    }));

  it("rejects similarly_situated=TRUE with a NULL sub status (IS DISTINCT FROM 'SMALL' catches NULL)", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "FFP");
      const err = await capturePgError(() => insertSub(c, orgId, quoteId, true, null));
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("line_items_sim_situated_consistency");
    }));

  it("accepts similarly_situated=TRUE with a SMALL sub status", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "FFP");
      await expect(insertSub(c, orgId, quoteId, true, "SMALL")).resolves.toBeUndefined();
    }));

  it("accepts similarly_situated=FALSE regardless of sub status", () =>
    withRollback(async (c) => {
      const { orgId, quoteId } = await quoteUnder(c, "FFP");
      await expect(insertSub(c, orgId, quoteId, false, "OTHER_THAN_SMALL")).resolves.toBeUndefined();
    }));
});
