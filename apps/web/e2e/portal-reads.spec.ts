/**
 * Phase-6 PR J — the logged-in vendor's READ surface. Seeds (owner connection, RLS-exempt) an open RFQ,
 * a SUBMITTED quote with a line item, and a VENDOR_QUOTE document for the seeded+linked E2E vendor, then
 * signs in as that vendor and asserts: the portal nav renders, "My Quotes" lists the quote, the detail
 * shows the line item + status, "Open RFQs" lists the solicitation, and "My Documents" lists the quote's
 * PDF — the canary that the 0010 documents EXISTS-to-parent policy replacement is live (under 0009 the
 * vendor's own quote doc was hidden). The untrusted quote `notes` render escaped (as data, never a script
 * element), proving no injection surface. The app connects via the owner DSN but withVendorRole does
 * SET LOCAL ROLE hermes_vendor, so these reads are genuinely RLS-scoped. Vendor login needs no TOTP, so
 * it is immune to the admin cold-start step-up race — no warmup required.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { hashPassword } from "@hermes/core";

import { E2E_ORG_SLUG, E2E_VENDOR_EMAIL, E2E_VENDOR_PASSWORD } from "./fixtures";

// A VENDOR user deliberately left UNLINKED (vendor_id stays NULL) — requireVendorWithVendorId must block
// it from the scoped reads even though middleware lets any vendor-role user reach /portal.
const UNLINKED_VENDOR_EMAIL = "unlinked-vendor@e2e.test";
const UNLINKED_VENDOR_PASSWORD = "unlinked-Password-123!";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("portal-reads.spec: no DSN (MIGRATION_DATABASE_URL/DATABASE_URL).");
  return new Pool({ connectionString: OWNER_DSN });
}

// Untrusted free text with a script payload — must render as visible data, never execute (CLAUDE.md §5).
const NOTES_XSS = "<script>alert('xss')</script> competitive but firm per the RFQ";

interface Seeded {
  quoteId: string;
  solicitationTitle: string;
}

async function seedVendorReads(): Promise<Seeded> {
  const db = pool();
  try {
    const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
    const orgId = org.rows[0]?.id;
    if (!orgId) throw new Error("portal-reads.spec: e2e org not found (global-setup did not run).");

    const v = await db.query<{ id: string }>(
      `SELECT id FROM vendors WHERE org_id = $1 AND company_name = 'E2E Vendor Co' LIMIT 1`,
      [orgId],
    );
    const vendorId = v.rows[0]?.id;
    if (!vendorId) throw new Error("portal-reads.spec: seeded vendor not found.");

    const admin = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE org_id = $1 AND role = 'ADMIN' LIMIT 1`,
      [orgId],
    );
    const adminId = admin.rows[0]?.id;
    if (!adminId) throw new Error("portal-reads.spec: seeded admin not found.");

    const title = `PR-J Reads RFQ ${randomUUID().slice(0, 8)}`;
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations
         (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
       VALUES ($1, $2, $3, 'FFP', 'SOURCING_IN_PROGRESS', $4, now()) RETURNING id`,
      [orgId, `PRJ-${randomUUID().slice(0, 8)}`, title, adminId],
    );
    const solId = sol.rows[0]!.id;

    const quote = await db.query<{ id: string }>(
      `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status, total_price, notes)
       VALUES ($1, $2, $3, 'SUBMITTED', '12345.00', $4) RETURNING id`,
      [orgId, solId, vendorId, NOTES_XSS],
    );
    const quoteId = quote.rows[0]!.id;

    await db.query(
      `INSERT INTO vendor_quote_line_items
         (org_id, quote_id, cost_type, contract_type, description, quantity, unit_rate, extended_amount)
       VALUES ($1, $2, 'LABOR', 'FFP', 'Senior engineer', '10', '100.00', '1000.00')`,
      [orgId, quoteId],
    );

    await db.query(
      `INSERT INTO documents
         (org_id, entity_type, quote_id, kind, storage_key, content_type, byte_size, magic_byte_validated)
       VALUES ($1, 'VENDOR_QUOTE', $2, 'QUOTE', $3, 'application/pdf', 2048, true)`,
      [orgId, quoteId, `orgs/${orgId}/vendors/${vendorId}/quotes/${quoteId}.pdf`],
    );

    // An UNLINKED vendor user (vendor_id stays NULL) for the negative test below. Idempotent upsert.
    await db.query(
      `INSERT INTO users (org_id, email, role, password_hash, is_active)
       VALUES ($1, $2, 'VENDOR', $3, true)
       ON CONFLICT (lower(email)) DO UPDATE SET
         password_hash = EXCLUDED.password_hash, is_active = true,
         failed_login_count = 0, locked_until = NULL`,
      [orgId, UNLINKED_VENDOR_EMAIL, await hashPassword(UNLINKED_VENDOR_PASSWORD)],
    );

    return { quoteId, solicitationTitle: title };
  } finally {
    await db.end();
  }
}

async function loginVendor(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', E2E_VENDOR_EMAIL);
  await page.fill('input[name="password"]', E2E_VENDOR_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/portal$/);
}

test.describe("vendor portal reads (PR J)", () => {
  let seeded: Seeded;

  test.beforeAll(async () => {
    seeded = await seedVendorReads();
  });

  test("a linked vendor reads my quotes, the detail + line items, open RFQs, and my documents", async ({
    page,
  }) => {
    await loginVendor(page);
    await expect(page.getByTestId("portal-nav")).toBeVisible();

    // My Quotes lists the seeded quote.
    await page.goto("/portal/quotes");
    await expect(page.getByTestId("quotes-table")).toContainText(seeded.solicitationTitle);

    // Quote detail: line item + status + the untrusted notes rendered as DATA (escaped).
    await page.getByRole("link", { name: seeded.solicitationTitle }).click();
    await page.waitForURL(new RegExp(`/portal/quotes/${seeded.quoteId}$`));
    await expect(page.getByTestId("quote-lines")).toContainText("Senior engineer");
    await expect(page.getByTestId("quote-status")).toContainText("Submitted");
    await expect(page.getByTestId("quote-notes")).toContainText("competitive but firm per the RFQ");
    // The script payload must NOT exist as an executable element — JSX autoescaped it to text.
    expect(await page.locator("script", { hasText: "alert('xss')" }).count()).toBe(0);

    // Open RFQs lists the in-progress solicitation.
    await page.goto("/portal/solicitations");
    await expect(page.getByTestId("rfqs-table")).toContainText(seeded.solicitationTitle);

    // My Documents lists the quote's PDF — the canary that the 0010 EXISTS-to-parent policy is live.
    await page.goto("/portal/documents");
    await expect(page.getByTestId("documents-table")).toContainText("Quote");
  });

  test("an UNLINKED vendor is recognized as pending and blocked from the scoped reads", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', UNLINKED_VENDOR_EMAIL);
    await page.fill('input[name="password"]', UNLINKED_VENDOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/portal$/);

    // The landing recognizes the unlinked state (requireVendor succeeds; session vendorId is null).
    await expect(page.getByTestId("vendor-link")).toContainText("pending vetting");

    // A vendor-SCOPED page (requireVendorWithVendorId) must NOT render its data — neither the table nor
    // the empty-state — because the guard throws before any read (defense in depth above the RLS layer).
    await page.goto("/portal/quotes");
    await expect(page.getByTestId("quotes-table")).toHaveCount(0);
    await expect(page.getByTestId("quotes-empty")).toHaveCount(0);
  });
});
