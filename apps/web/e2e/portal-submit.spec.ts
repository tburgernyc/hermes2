/**
 * Phase-6 PR K — the LOGGED-IN vendor quote submit. Seeds an OPEN RFQ (owner connection), signs in as the
 * seeded+linked E2E vendor, fills + submits the quote form, then verifies via an OWNER-DSN read-back that
 * the persisted row is exactly what §7 / the Prime Directive require:
 *   • vendor_id = the SESSION vendor (never the form), prospect_id NULL, token_jti NULL, status SUBMITTED;
 *   • a VENDOR_QUOTE document hangs off the quote; an audit_log row records actor_type=VENDOR + the user.
 * A second submit against the same RFQ is rejected by the one-active-quote partial unique index (the
 * "duplicate" status), proving the structural guard end-to-end. The vendor login still races the cold-start
 * session establishment on a contended runner, so a beforeAll warmup + a retrying loginVendor (vendor-auth.ts)
 * establish a live session up front before the submit.
 */
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { E2E_ORG_SLUG, E2E_VENDOR_EMAIL } from "./fixtures";
import { loginVendor, warmVendorSession } from "./vendor-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("portal-submit.spec: no DSN (MIGRATION_DATABASE_URL/DATABASE_URL).");
  return new Pool({ connectionString: OWNER_DSN });
}

// A minimal but VALID PDF (magic bytes "%PDF") — validateUpload accepts by content, not extension.
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

interface Ctx {
  orgId: string;
  vendorId: string;
  vendorUserId: string;
  adminId: string;
}

async function loadContext(): Promise<Ctx> {
  const db = pool();
  try {
    const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
    const orgId = org.rows[0]?.id;
    if (!orgId) throw new Error("portal-submit.spec: e2e org not found (global-setup did not run).");

    const v = await db.query<{ id: string }>(
      `SELECT id FROM vendors WHERE org_id = $1 AND company_name = 'E2E Vendor Co' LIMIT 1`,
      [orgId],
    );
    const vendorId = v.rows[0]?.id;
    if (!vendorId) throw new Error("portal-submit.spec: seeded vendor not found.");

    const vu = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [orgId, E2E_VENDOR_EMAIL],
    );
    const vendorUserId = vu.rows[0]?.id;
    if (!vendorUserId) throw new Error("portal-submit.spec: seeded vendor user not found.");

    const admin = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE org_id = $1 AND role = 'ADMIN' LIMIT 1`,
      [orgId],
    );
    const adminId = admin.rows[0]?.id;
    if (!adminId) throw new Error("portal-submit.spec: seeded admin not found.");

    return { orgId, vendorId, vendorUserId, adminId };
  } finally {
    await db.end();
  }
}

/** Seed a fresh OPEN RFQ (SOURCING_IN_PROGRESS, sourcing-gate satisfied) and return its id + title. */
async function seedOpenRfq(ctx: Ctx): Promise<{ solId: string; title: string }> {
  const db = pool();
  try {
    const title = `PR-K Submit RFQ ${randomUUID().slice(0, 8)}`;
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations
         (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
       VALUES ($1, $2, $3, 'FFP', 'SOURCING_IN_PROGRESS', $4, now()) RETURNING id`,
      [ctx.orgId, `PRK-${randomUUID().slice(0, 8)}`, title, ctx.adminId],
    );
    return { solId: sol.rows[0]!.id, title };
  } finally {
    await db.end();
  }
}

/** Move an RFQ out of the quotable window (keeps the sourcing-gate columns set, so the CHECK holds). */
async function closeRfq(solId: string): Promise<void> {
  const db = pool();
  try {
    // PRICING_PENDING is past the SOURCING_IN_PROGRESS quote-collection window (and not SUBMITTED, so
    // the no-auto-submit trigger does not fire); the sourcing_approved_* columns stay set.
    await db.query(`UPDATE solicitations SET status = 'PRICING_PENDING' WHERE id = $1`, [solId]);
  } finally {
    await db.end();
  }
}

async function fillAndSubmit(page: Page, solId: string): Promise<void> {
  await page.goto(`/portal/solicitations/${solId}/quote`);
  await expect(page.getByTestId("quote-form")).toBeVisible();
  await page.fill('input[name="description_0"]', "Senior engineer");
  await page.fill('input[name="quantity_0"]', "10");
  await page.fill('input[name="unitRate_0"]', "100.00");
  await page
    .locator('input[name="file"]')
    .setInputFiles({ name: "quote.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
  // Scope to the quote form's submit button: ConsoleShell's nav renders a "Sign out" submit button
  // first in the DOM, so a bare button[type="submit"] would click Sign out (→ signOut → /login).
  await page.getByTestId("quote-form").getByRole("button", { name: "Submit quote" }).click();
}

// Drives the full logged-in multipart submit through a real browser. The submit click MUST target the
// quote form's OWN button (see fillAndSubmit): ConsoleShell's nav renders a "Sign out" submit button
// first in the DOM, so a bare button[type="submit"] selector clicks Sign out (→ signOut → /login) and the
// quote is never sent. The §7 / Prime-Directive invariants are also covered at the DB layer by
// packages/db's negative.vendor-submit.test.ts in the `db` job.
test.describe("vendor portal submit (PR K)", () => {
  let ctx: Ctx;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    ctx = await loadContext();
    await warmVendorSession(browser);
  });

  test("a linked vendor submits a quote; the persisted row is vendor-scoped + audited", async ({
    page,
  }) => {
    const { solId } = await seedOpenRfq(ctx);
    await loginVendor(page);

    // Reach the form via the browse link, proving the wiring (then submit).
    await page.goto("/portal/solicitations");
    await page.getByRole("link", { name: "Submit quote" }).first().waitFor();
    await fillAndSubmit(page, solId);
    // DIAGNOSTIC: the redirect ?status= reveals why a non-success submit failed (closed/duplicate/...).
    await page.waitForURL(/\/quote\?status=/, { timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId("submit-success"), `submit redirected to: ${page.url()}`).toBeVisible();

    // OWNER-DSN read-back: the structural §7 / Prime-Directive assertions.
    const db = pool();
    try {
      const q = await db.query<{
        id: string;
        vendor_id: string | null;
        prospect_id: string | null;
        token_jti: string | null;
        status: string;
      }>(
        `SELECT id, vendor_id, prospect_id, token_jti, status
           FROM vendor_quotes WHERE org_id = $1 AND solicitation_id = $2`,
        [ctx.orgId, solId],
      );
      expect(q.rowCount).toBe(1);
      const quote = q.rows[0]!;
      expect(quote.vendor_id).toBe(ctx.vendorId); // the SESSION vendor — never the form
      expect(quote.prospect_id).toBeNull(); // a logged-in submit is never prospect-scoped
      expect(quote.token_jti).toBeNull(); // no token in the authenticated path
      expect(quote.status).toBe("SUBMITTED");

      const doc = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM documents
           WHERE org_id = $1 AND quote_id = $2 AND entity_type = 'VENDOR_QUOTE'`,
        [ctx.orgId, quote.id],
      );
      expect(doc.rows[0]?.n).toBe("1");

      const audit = await db.query<{ actor_type: string; actor_user_id: string | null }>(
        `SELECT actor_type, actor_user_id FROM audit_log
           WHERE org_id = $1 AND action = 'QUOTE_SUBMITTED' AND entity_id = $2`,
        [ctx.orgId, quote.id],
      );
      expect(audit.rowCount).toBe(1);
      expect(audit.rows[0]?.actor_type).toBe("VENDOR");
      expect(audit.rows[0]?.actor_user_id).toBe(ctx.vendorUserId);
    } finally {
      await db.end();
    }
  });

  test("a second submit for the same RFQ is blocked (one-active-quote partial unique index)", async ({
    page,
  }) => {
    const { solId } = await seedOpenRfq(ctx);
    await loginVendor(page);

    await fillAndSubmit(page, solId);
    await expect(page.getByTestId("submit-success")).toBeVisible();

    // Re-open the form and submit again → the unique index rejects it (23505 → "duplicate" status).
    await fillAndSubmit(page, solId);
    // Target the status alert by testid — getByRole("alert") also matches Next's route announcer.
    await expect(page.getByTestId("submit-status")).toContainText("already submitted");
  });

  test("the firm closing an RFQ blocks a logged-in submit (status re-checked at WRITE time)", async ({
    page,
  }) => {
    const { solId } = await seedOpenRfq(ctx);
    await loginVendor(page);

    // The vendor opens the form while the RFQ is still open (the form renders).
    await page.goto(`/portal/solicitations/${solId}/quote`);
    await expect(page.getByTestId("quote-form")).toBeVisible();

    // The firm moves the RFQ out of the quotable window AFTER the page loaded (a real TOCTOU). The
    // OPEN_RFQ_STATUSES gate is purely app-layer (no DB/RLS backstop), so the action MUST re-check at
    // write time, not just the page at render time.
    await closeRfq(solId);

    await page.fill('input[name="description_0"]', "Senior engineer");
    await page.fill('input[name="quantity_0"]', "10");
    await page.fill('input[name="unitRate_0"]', "100.00");
    await page
      .locator('input[name="file"]')
      .setInputFiles({ name: "quote.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
    // Scope to the quote form's button (not ConsoleShell's "Sign out") — see fillAndSubmit.
    await page.getByTestId("quote-form").getByRole("button", { name: "Submit quote" }).click();

    // Refused: the "closed" status message, and the form is gone (the now-closed RFQ shows rfq-closed).
    await expect(page.getByTestId("submit-status")).toContainText("no longer accepting");
    await expect(page.getByTestId("rfq-closed")).toBeVisible();

    // The decisive proof: NO quote row was written for the closed RFQ — the gate blocked the write.
    const db = pool();
    try {
      const q = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM vendor_quotes WHERE org_id = $1 AND solicitation_id = $2`,
        [ctx.orgId, solId],
      );
      expect(q.rows[0]?.n).toBe("0");
    } finally {
      await db.end();
    }
  });
});
