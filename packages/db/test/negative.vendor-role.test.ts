/**
 * The users↔vendors vetting linkage + hermes_vendor isolation (migration 0009 — CLAUDE.md §7).
 * Org-scoped RLS alone gives ZERO isolation between two vendors in the same org, so the structural
 * guarantees proven here are:
 *   • a logged-in vendor (hermes_vendor, scoped by app.current_vendor_id) reads ONLY its own
 *     vendor_quotes / vendors row — a competitor's pricing in the same org is invisible;
 *   • hermes_vendor has NO access to the users (the link/identity) or vendor_prospects tables, and
 *     cannot re-link itself;
 *   • a user can be linked only to a vendor in its OWN org (the composite FK blocks cross-tenant);
 *   • an ADMIN row can never be vendor-bound (the users_vendor_link_role CHECK);
 *   • hermes_app→hermes_vendor membership is WITH INHERIT FALSE (only an explicit withVendorRole
 *     switches in — no ambient inheritance on a normal query).
 */
import { describe, expect, it } from "vitest";

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
  insertContract,
  insertDocument,
  insertLineItem,
  insertOrg,
  insertQuote,
  insertSolicitation,
  insertUser,
  insertVendor,
} from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("hermes_vendor — per-vendor isolation + the users↔vendors link boundary", () => {
  it("hermes_app is a member of hermes_vendor WITH INHERIT FALSE (migration 0009)", () =>
    withRollback(async (c) => {
      const res = await c.query<{ inherit_option: boolean }>(
        `SELECT m.inherit_option
           FROM pg_auth_members m
           JOIN pg_roles r ON r.oid = m.roleid
           JOIN pg_roles g ON g.oid = m.member
          WHERE r.rolname = 'hermes_vendor' AND g.rolname = 'hermes_app'`,
      );
      expect(res.rowCount).toBe(1);
      expect(res.rows[0]?.inherit_option).toBe(false);
    }));

  it("a vendor reads ONLY its own quotes — a same-org competitor's quote is invisible", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      const quoteA = await insertQuote(c, orgId, { solicitationId: solId, vendorId: vendorA });
      const quoteB = await insertQuote(c, orgId, { solicitationId: solId, vendorId: vendorB });

      // Connect as vendor A would: org context + vendor context, then drop to the low-trust role.
      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const rows = await c.query<{ id: string }>(`SELECT id FROM vendor_quotes ORDER BY id`);
      const ids = rows.rows.map((r) => r.id);
      expect(ids).toContain(quoteA);
      expect(ids).not.toContain(quoteB); // the RESTRICTIVE per-vendor policy hides vendor B's row
      expect(ids).toHaveLength(1);
    }));

  it("a vendor reads ONLY its own vendors row", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });

      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const rows = await c.query<{ id: string }>(`SELECT id FROM vendors ORDER BY id`);
      const ids = rows.rows.map((r) => r.id);
      expect(ids).toEqual([vendorA]);
      expect(ids).not.toContain(vendorB);
    }));

  it("hermes_vendor cannot read the users table (the link/identity is off-limits)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId);
      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const err = await capturePgError(() => c.query(`SELECT id FROM users`));
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("hermes_vendor cannot read other firms' prospects", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId);
      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const err = await capturePgError(() => c.query(`SELECT id FROM vendor_prospects`));
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("hermes_vendor cannot UPDATE users — a vendor can never re-link itself", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId);
      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const err = await capturePgError(() =>
        c.query(`UPDATE users SET vendor_id = $1`, [vendorA]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));

  it("a user cannot be linked to a vendor in ANOTHER org (composite FK blocks cross-tenant)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const userA = await insertUser(c, orgA, { role: "VENDOR" });
      const vendorB = await insertVendor(c, orgB); // a vendor in a DIFFERENT org

      // Run as the owner (RLS-exempt) to isolate the FK as the thing that rejects it.
      const err = await capturePgError(() =>
        c.query(`UPDATE users SET vendor_id = $1 WHERE id = $2`, [vendorB, userA]),
      );
      expect(err?.code).toBe(PG.FK_VIOLATION);
    }));

  it("an ADMIN user can never be vendor-bound (users_vendor_link_role CHECK)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const adminId = await insertUser(c, orgId, { role: "ADMIN" });
      const vendorA = await insertVendor(c, orgId); // a valid same-org vendor, so the FK passes first

      const err = await capturePgError(() =>
        c.query(`UPDATE users SET vendor_id = $1 WHERE id = $2`, [vendorA, adminId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
    }));

  // ---- PR J read surface (migration 0010): RFQ browse + documents/line-items EXISTS-to-parent ----

  it("a vendor sees a VENDOR_QUOTE document on its OWN quote — the 0010 EXISTS-to-parent replacement", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      const quoteA = await insertQuote(c, orgId, { solicitationId: solId, vendorId: vendorA });
      const quoteB = await insertQuote(c, orgId, { solicitationId: solId, vendorId: vendorB });
      const docA = await insertDocument(c, orgId, { entityType: "VENDOR_QUOTE", quoteId: quoteA });
      const docB = await insertDocument(c, orgId, { entityType: "VENDOR_QUOTE", quoteId: quoteB });

      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const ids = (await c.query<{ id: string }>(`SELECT id FROM documents ORDER BY id`)).rows.map(
        (r) => r.id,
      );
      // Under the 0009 own-vendor-only policy this set would be EMPTY (the doc has no vendor_id). The
      // 0010 EXISTS-to-parent replacement is precisely what makes the vendor's OWN quote doc visible …
      expect(ids).toContain(docA);
      // … while a same-org competitor's quote doc stays hidden.
      expect(ids).not.toContain(docB);
      expect(ids).toHaveLength(1);
    }));

  it("a vendor sees a CONTRACT document on its OWN subcontract, not a competitor's", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      const contractA = await insertContract(c, orgId, { awardedVendorId: vendorA });
      const contractB = await insertContract(c, orgId, { awardedVendorId: vendorB });
      const docA = await insertDocument(c, orgId, { entityType: "CONTRACT", contractId: contractA });
      const docB = await insertDocument(c, orgId, { entityType: "CONTRACT", contractId: contractB });

      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const ids = (await c.query<{ id: string }>(`SELECT id FROM documents ORDER BY id`)).rows.map(
        (r) => r.id,
      );
      expect(ids).toContain(docA);
      expect(ids).not.toContain(docB);
    }));

  it("a vendor browses in-org solicitations but never another org's (0010 org-scoped grant/policy)", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      const vendorA = await insertVendor(c, orgA);
      const solA = await insertSolicitation(c, orgA);
      const solB = await insertSolicitation(c, orgB);

      await setOrgContext(c, orgA);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const ids = (await c.query<{ id: string }>(`SELECT id FROM solicitations ORDER BY id`)).rows.map(
        (r) => r.id,
      );
      expect(ids).toContain(solA);
      expect(ids).not.toContain(solB); // a different org's RFQ is invisible (org gate)
    }));

  it("a vendor reads the line items of its OWN quote only (0010 EXISTS-to-parent)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "FFP" });
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      const quoteA = await insertQuote(c, orgId, { solicitationId: solId, vendorId: vendorA });
      const quoteB = await insertQuote(c, orgId, { solicitationId: solId, vendorId: vendorB });
      const lineA = await insertLineItem(c, orgId, { quoteId: quoteA });
      const lineB = await insertLineItem(c, orgId, { quoteId: quoteB });

      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const ids = (
        await c.query<{ id: string }>(`SELECT id FROM vendor_quote_line_items ORDER BY id`)
      ).rows.map((r) => r.id);
      expect(ids).toContain(lineA);
      expect(ids).not.toContain(lineB);
      expect(ids).toHaveLength(1);
    }));

  it("a vendor sees a VENDOR-type document it owns (the vendor_id arm), not a competitor's", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      // entity_type VENDOR ⇒ owned via vendor_id (the FIRST OR arm of documents_vendor_scope).
      const docA = await insertDocument(c, orgId, { entityType: "VENDOR", vendorId: vendorA });
      const docB = await insertDocument(c, orgId, { entityType: "VENDOR", vendorId: vendorB });

      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");

      const ids = (await c.query<{ id: string }>(`SELECT id FROM documents ORDER BY id`)).rows.map(
        (r) => r.id,
      );
      expect(ids).toContain(docA);
      expect(ids).not.toContain(docB);
      expect(ids).toHaveLength(1);
    }));

  it("two vendors in the SAME org both see the same in-org RFQ (shared browse, no per-vendor narrowing)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const vendorA = await insertVendor(c, orgId, { companyName: "Vendor A" });
      const vendorB = await insertVendor(c, orgId, { companyName: "Vendor B" });
      const solId = await insertSolicitation(c, orgId);

      await setOrgContext(c, orgId);
      await setVendorContext(c, vendorA);
      await setLocalRole(c, "hermes_vendor");
      const asA = (await c.query<{ id: string }>(`SELECT id FROM solicitations`)).rows.map((r) => r.id);
      expect(asA).toContain(solId);

      // Re-enter as vendor B: reset to the owner, switch the per-vendor GUC, drop back to hermes_vendor
      // (mirrors withVendorRole's set-GUC-then-SET-ROLE flow). The PERMISSIVE org-only policy has no
      // per-vendor narrowing, so the SAME RFQ is visible — RFQs are shared within the org.
      await c.query("RESET ROLE");
      await setVendorContext(c, vendorB);
      await setLocalRole(c, "hermes_vendor");
      const asB = (await c.query<{ id: string }>(`SELECT id FROM solicitations`)).rows.map((r) => r.id);
      expect(asB).toContain(solId);
    }));
});
