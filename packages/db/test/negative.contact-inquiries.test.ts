/**
 * Public contact-inquiry boundary (Phase 7a). The /contact form writes through hermes_app via
 * withOrg(firmOrgId): a server-resolved org GUC, never the client. These tests prove the row is
 * tenant-isolated (the WITH CHECK + USING arms of contact_inquiries_tenant_isolation) and that the
 * text-present CHECK rejects an empty submission — the DB belt behind the action's Zod validation.
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
import { insertOrg } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

const INSERT = `INSERT INTO contact_inquiries (org_id, name, email, intent, message)
                VALUES ($1, $2, $3, $4, $5)`;

d("contact-inquiry boundary", () => {
  it("hermes_app CAN insert a contact inquiry for its own org", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      await expect(
        c.query(INSERT, [orgId, "Jane CO", "jane@example.test", "TEAMING", "We'd like to team."]),
      ).resolves.toBeDefined();
    }));

  it("tenant isolation: WITH CHECK rejects an inquiry whose org_id is not the GUC org", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgA); // context = A, but the row claims B
      const err = await capturePgError(() =>
        c.query(INSERT, [orgB, "Mallory", "m@example.test", "OTHER", "cross-tenant write"]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
      expect(err?.message).toMatch(/row-level security/i);
    }));

  it("cross-org read isolation: org A cannot SELECT org B's inquiry", () =>
    withRollback(async (c) => {
      const orgA = await insertOrg(c);
      const orgB = await insertOrg(c);
      // Owner is RLS-exempt: seed an inquiry for B before switching to the bound app role.
      await c.query(INSERT, [orgB, "Bravo", "b@example.test", "AGENCY", "B's private inquiry."]);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgA);
      const res = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM contact_inquiries`,
      );
      expect(res.rows[0]?.n).toBe("0");
    }));

  it("text-present CHECK rejects a blank message", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_app");
      await setOrgContext(c, orgId);
      const err = await capturePgError(() =>
        c.query(INSERT, [orgId, "Jane", "jane@example.test", "OTHER", "   "]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("contact_inquiries_text_present");
    }));
});
