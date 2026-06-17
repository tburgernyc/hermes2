/**
 * The logged-in vendor's WRITE boundary (migration 0011 — PR K, CLAUDE.md §7). PR J proved the READ
 * isolation; this proves the symmetric write isolation now that hermes_vendor has INSERT on
 * vendor_quotes / vendor_quote_line_items / documents / audit_log. Every structural guarantee:
 *   • a vendor can submit ONLY its own quote — naming another vendor, or impersonating a prospect
 *     (vendor_id NULL), is blocked by the RESTRICTIVE _vendor_scope WITH CHECK (42501);
 *   • a vendor can attach line items + a VENDOR_QUOTE document ONLY to a quote it owns — the
 *     EXISTS-to-parent WITH CHECK (0010) rejects a competitor's quote/doc (42501);
 *   • the SECURITY DEFINER sync trigger (0008) still overwrites a line's contract_type from the
 *     solicitation even under the low-trust role (the vendor can't SELECT the join itself);
 *   • one ACTIVE quote per (vendor, solicitation) — a second is blocked (23505), but a terminal
 *     (REJECTED) prior quote does NOT block a resubmit (the partial-index predicate);
 *   • the vendor can APPEND an org-scoped audit row (incl. the actor_user_id FK to users, which it
 *     cannot SELECT — RI checks bypass RLS/privilege) but can never READ the log, and can never
 *     append to another org (the audit_log_vendor_append WITH CHECK).
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import {
  HAS_DB,
  PG,
  capturePgError,
  setLocalRole,
  setOrgContext,
  setVendorContext,
  withRollback,
} from "./helpers/db.js";
import {
  insertOrg,
  insertProspect,
  insertSolicitation,
  insertUser,
  insertVendor,
} from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

/** Insert a vendor_quotes row as the OWNER (RLS-exempt) at an arbitrary status — for competitor/prior seeds. */
async function ownerSeedQuote(
  c: PoolClient,
  orgId: string,
  solId: string,
  vendorId: string,
  status: string,
): Promise<string> {
  const res = await c.query<{ id: string }>(
    `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status)
     VALUES ($1, $2, $3, $4::quote_status) RETURNING id`,
    [orgId, solId, vendorId, status],
  );
  return res.rows[0]!.id;
}

/** Enter the transaction as a given vendor would: org + vendor GUCs, then drop to hermes_vendor. */
async function enterAsVendor(c: PoolClient, orgId: string, vendorId: string): Promise<void> {
  await setOrgContext(c, orgId);
  await setVendorContext(c, vendorId);
  await setLocalRole(c, "hermes_vendor");
}

d("hermes_vendor — the logged-in vendor WRITE boundary (migration 0011)", () => {
  it("a vendor cannot submit a quote that NAMES another vendor (RESTRICTIVE WITH CHECK)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });

      await enterAsVendor(c, orgId, vendorA);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status)
           VALUES ($1, $2, $3, 'SUBMITTED')`,
          [orgId, solId, vendorB], // vendor_id = a COMPETITOR
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("a vendor cannot impersonate a prospect (vendor_id NULL → _vendor_scope WITH CHECK fails)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId);
      const prospect = await insertProspect(c, orgId);

      await enterAsVendor(c, orgId, vendorA);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, prospect_id, status)
           VALUES ($1, $2, NULL, $3, 'SUBMITTED')`,
          [orgId, solId, prospect],
        ),
      );
      // vendor_id = app.current_vendor_id is required by the RESTRICTIVE policy; NULL ≠ the GUC.
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("a vendor CAN submit its own quote + lines + doc; the DEFINER trigger overwrites contract_type", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      // Solicitation is T&M, so the trigger must overwrite the line's claimed FFP with TM.
      const solId = await insertSolicitation(c, orgId, { contractType: "TM" });
      const vendorA = await insertVendor(c, orgId);
      const quoteId = randomUUID(); // app-side, uniform with the tokenized path

      await enterAsVendor(c, orgId, vendorA);

      // The full submit under the low-trust role: quote → line → VENDOR_QUOTE document.
      await c.query(
        `INSERT INTO vendor_quotes (id, org_id, solicitation_id, vendor_id, status, total_price)
         VALUES ($1, $2, $3, $4, 'SUBMITTED', '1000.00')`,
        [quoteId, orgId, solId, vendorA],
      );
      await c.query(
        `INSERT INTO vendor_quote_line_items
           (org_id, quote_id, cost_type, contract_type, description, unit_rate)
         VALUES ($1, $2, 'LABOR', 'FFP', 'Senior engineer', '100.00')`,
        [orgId, quoteId], // claims FFP — the trigger should overwrite it to the sol's TM
      );
      await c.query(
        `INSERT INTO documents
           (org_id, entity_type, quote_id, kind, storage_key, content_type, byte_size, magic_byte_validated)
         VALUES ($1, 'VENDOR_QUOTE', $2, 'QUOTE', $3, 'application/pdf', 2048, true)`,
        [orgId, quoteId, `orgs/${orgId}/vendors/${vendorA}/quotes/${quoteId}.pdf`],
      );

      // Verify as the OWNER (RLS-exempt) — clean read of the persisted state.
      await c.query("RESET ROLE");
      const q = await c.query<{
        vendor_id: string;
        prospect_id: string | null;
        token_jti: string | null;
      }>(`SELECT vendor_id, prospect_id, token_jti FROM vendor_quotes WHERE id = $1`, [quoteId]);
      expect(q.rows[0]?.vendor_id).toBe(vendorA);
      expect(q.rows[0]?.prospect_id).toBeNull();
      expect(q.rows[0]?.token_jti).toBeNull(); // a logged-in submit carries no token jti
      const li = await c.query<{ contract_type: string }>(
        `SELECT contract_type FROM vendor_quote_line_items WHERE quote_id = $1`,
        [quoteId],
      );
      expect(li.rows[0]?.contract_type).toBe("TM"); // overwritten by sync_line_item_contract_type (DEFINER)
      const doc = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM documents WHERE quote_id = $1 AND entity_type = 'VENDOR_QUOTE'`,
        [quoteId],
      );
      expect(doc.rows[0]?.n).toBe("1");
    }));

  it("a vendor cannot attach a line item to a COMPETITOR's quote (EXISTS-to-parent WITH CHECK)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      const quoteB = await ownerSeedQuote(c, orgId, solId, vendorB, "SUBMITTED");

      await enterAsVendor(c, orgId, vendorA);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_quote_line_items
             (org_id, quote_id, cost_type, contract_type, description, unit_rate)
           VALUES ($1, $2, 'LABOR', 'FFP', 'Senior engineer', '100.00')`,
          [orgId, quoteB], // parent is vendor B's quote — invisible to vendor A's RLS
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("a vendor cannot attach a document to a COMPETITOR's quote (documents EXISTS-to-parent WITH CHECK)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      const quoteB = await ownerSeedQuote(c, orgId, solId, vendorB, "SUBMITTED");

      await enterAsVendor(c, orgId, vendorA);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO documents
             (org_id, entity_type, quote_id, kind, storage_key, content_type, byte_size, magic_byte_validated)
           VALUES ($1, 'VENDOR_QUOTE', $2, 'QUOTE', $3, 'application/pdf', 2048, true)`,
          [orgId, quoteB, `orgs/${orgId}/x.pdf`],
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("one ACTIVE quote per (vendor, solicitation): a second active submit is blocked (23505)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId);

      await enterAsVendor(c, orgId, vendorA);
      await c.query(
        `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status)
         VALUES ($1, $2, $3, 'SUBMITTED')`,
        [orgId, solId, vendorA],
      );
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status)
           VALUES ($1, $2, $3, 'SUBMITTED')`,
          [orgId, solId, vendorA], // same (org, sol, vendor), both active
        ),
      );
      expect(err?.code).toBe(PG.UNIQUE_VIOLATION);
    }));

  it("terminal (REJECTED + WITHDRAWN) prior quotes do NOT block a resubmit (both predicate arms)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId);
      // Prior quotes in BOTH terminal states the index predicate excludes. Seeding both proves each
      // arm: if a regression dropped EITHER 'REJECTED' or 'WITHDRAWN' from the predicate, that seed
      // would re-enter the index and collide with the new active quote (23505), failing this test.
      await ownerSeedQuote(c, orgId, solId, vendorA, "REJECTED");
      await ownerSeedQuote(c, orgId, solId, vendorA, "WITHDRAWN");

      await enterAsVendor(c, orgId, vendorA);
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status)
           VALUES ($1, $2, $3, 'SUBMITTED')`,
          [orgId, solId, vendorA],
        ),
      );
      expect(err).toBeUndefined(); // the resubmit succeeds — neither terminal row is in the index
    }));

  it("a vendor can APPEND an org-scoped audit row (incl. the actor_user_id FK), proving the grant+policy", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId);
      const userId = await insertUser(c, orgId, { role: "VENDOR" });
      // Link the user to the vendor (the real session would carry this linkage).
      await c.query(`UPDATE users SET vendor_id = $1 WHERE id = $2`, [vendorA, userId]);

      await enterAsVendor(c, orgId, vendorA);
      // The audit FK is on (org_id, actor_user_id) → users, a table the vendor CANNOT SELECT — but RI
      // checks bypass RLS/privilege, so this append succeeds under the low-trust role.
      await c.query(
        `INSERT INTO audit_log (org_id, actor_type, actor_user_id, action, entity_type)
         VALUES ($1, 'VENDOR', $2, 'QUOTE_SUBMITTED', 'vendor_quotes')`,
        [orgId, userId],
      );

      await c.query("RESET ROLE");
      const n = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM audit_log WHERE org_id = $1 AND action = 'QUOTE_SUBMITTED'`,
        [orgId],
      );
      expect(n.rows[0]?.n).toBe("1");
    }));

  it("a vendor cannot READ the audit_log (append-only: INSERT granted, SELECT never)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId);

      await enterAsVendor(c, orgId, vendorA);
      const err = await capturePgError(() => c.query(`SELECT id FROM audit_log`));
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("a vendor cannot append an audit row to ANOTHER org (audit_log_vendor_append WITH CHECK)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const vendorA = await insertVendor(c, orgA);

      await enterAsVendor(c, orgA, vendorA); // GUC org = orgA
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO audit_log (org_id, actor_type, actor_email, action)
           VALUES ($1, 'VENDOR', 'x@e2e.test', 'QUOTE_SUBMITTED')`,
          [orgB], // row org ≠ the GUC org → WITH CHECK fails
        ),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));
});
