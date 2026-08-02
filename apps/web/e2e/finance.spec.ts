/**
 * §3.3 admin UI e2e: proves the two distinct money-flow records (government invoices vs. subcontractor
 * payables) are reachable from nav, that the payment-deadline calculation actually DERIVES from the
 * recorded government-payment date once an invoice is confirmed paid, and that CPARS capture works —
 * mirroring admin-console.spec.ts's pattern (owner-DSN read-back after a real browser click).
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ADMIN_EMAIL, E2E_ORG_SLUG } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("finance.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

async function orgId(db: Pool): Promise<string> {
  const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
  const id = org.rows[0]?.id;
  if (!id) throw new Error("finance.spec: e2e org not found (global-setup did not run?)");
  return id;
}

async function adminUserId(db: Pool, oid: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
    [oid, E2E_ADMIN_EMAIL],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("finance.spec: e2e admin not found (global-setup did not run?)");
  return id;
}

async function seedContract(db: Pool, oid: string): Promise<{ contractId: string; vendorName: string }> {
  const vendorName = `Finance Vendor ${randomUUID()}`;
  const vetterId = await adminUserId(db, oid);
  // vendors_vetted_requires_vetter CHECK: a VETTED vendor must carry a recorded vetter + timestamp.
  const vendor = await db.query<{ id: string }>(
    `INSERT INTO vendors (org_id, company_name, status, vetted_by, vetted_at)
     VALUES ($1, $2, 'VETTED'::vendor_status, $3, now()) RETURNING id`,
    [oid, vendorName, vetterId],
  );
  const vendorId = vendor.rows[0]!.id;
  const contract = await db.query<{ id: string }>(
    `INSERT INTO contracts (org_id, awarded_vendor_id, contract_type, status, accelerated_payments)
     VALUES ($1, $2, 'FFP'::contract_type, 'ACTIVE'::contract_status, false) RETURNING id`,
    [oid, vendorId],
  );
  return { contractId: contract.rows[0]!.id, vendorName };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginAdmin(page, 24);
  } finally {
    await context.close();
  }
});

test("contracts is reachable from admin nav and lists a seeded contract", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { contractId, vendorName } = await seedContract(db, oid);

    await loginAdmin(page);
    await page.goto("/admin");
    await page.getByTestId("admin-nav").getByRole("link", { name: "Contracts" }).click();
    await expect(page).toHaveURL(/\/admin\/contracts$/);
    await expect(page.getByText(vendorName)).toBeVisible();

    await page.getByRole("link", { name: vendorName }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/contracts/${contractId}$`));
  } finally {
    await db.end();
  }
});

test("recording a government invoice, confirming payment, and linking a payable DERIVES the Prompt-Payment deadline from the recorded payment date", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { contractId } = await seedContract(db, oid);

    await loginAdmin(page);
    await page.goto(`/admin/contracts/${contractId}`);

    const invoiceNumber = `E2E-INV-${randomUUID()}`;
    await page.fill('input[name="invoiceNumber"]', invoiceNumber);
    await page.fill('input[name="amount"]', "5000");
    await page.getByRole("button", { name: "Record invoice" }).click();

    await expect(page.getByTestId("invoices-table")).toContainText(invoiceNumber);

    // Not yet submitted: no government-payment deadline shown. Status renders via humanizeStatus
    // (admin-board.ts) — "DRAFT" → "Draft", title case, not the raw enum value.
    const row = page.getByRole("row").filter({ hasText: invoiceNumber });
    await expect(row).toContainText("Draft");

    await row.getByRole("button", { name: "Mark submitted" }).click();
    await expect(page.getByRole("row").filter({ hasText: invoiceNumber })).toContainText("Submitted");
    // The 14-day PROGRESS government-payment deadline now shows (derived from submitted_at).
    await expect(page.getByRole("row").filter({ hasText: invoiceNumber })).toContainText("on_track");

    await page
      .getByRole("row")
      .filter({ hasText: invoiceNumber })
      .getByRole("button", { name: "Confirm government paid" })
      .click();
    await expect(page.getByRole("row").filter({ hasText: invoiceNumber })).toContainText("Paid");

    const invoiceIdRow = await db.query<{ id: string; paid_at: Date }>(
      `SELECT id, paid_at FROM invoices WHERE org_id = $1 AND invoice_number = $2`,
      [oid, invoiceNumber],
    );
    expect(invoiceIdRow.rows[0]!.paid_at).not.toBeNull();

    // Now record a payable and link it to this just-paid invoice — its due date must DERIVE from paid_at
    // (accelerated_payments = false on this seeded contract, so the standard 7-day clock applies).
    // Disambiguate: the invoice form's "amount" field is the first on the page; the payable form's is
    // the second — nth(1) targets the payable form specifically.
    const payableAmountInputs = page.locator('input[name="amount"]');
    await payableAmountInputs.nth(1).fill("4500");
    await page.getByRole("button", { name: "Record payable" }).click();

    await expect(page.getByTestId("payables-table")).toContainText("4,500.00");

    const payableRow = page.getByRole("row").filter({ hasText: "4,500.00" });
    await payableRow.locator("select[name='governmentInvoiceId']").selectOption({ label: invoiceNumber });
    await payableRow.getByRole("button", { name: "Link" }).click();

    // Freshly paid (paid_at ≈ now), 7-day standard clock ⇒ well ON_TRACK, never "not yet started".
    await expect(page.getByTestId("payable-deadline").filter({ hasText: "on_track" })).toBeVisible();

    const payableRows = await db.query<{ government_invoice_id: string | null }>(
      `SELECT government_invoice_id FROM subcontractor_payables WHERE org_id = $1 AND amount = '4500.00'`,
      [oid],
    );
    expect(payableRows.rows[0]!.government_invoice_id).toBe(invoiceIdRow.rows[0]!.id);
  } finally {
    await db.end();
  }
});

test("a payable with no linked invoice is surfaced as 'not yet started', never a fabricated due date", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { contractId } = await seedContract(db, oid);

    await loginAdmin(page);
    await page.goto(`/admin/contracts/${contractId}`);
    const payableAmountInputs = page.locator('input[name="amount"]');
    await payableAmountInputs.nth(1).fill("999");
    await page.getByRole("button", { name: "Record payable" }).click();

    await expect(page.getByTestId("payable-deadline").filter({ hasText: "not yet started" })).toBeVisible();
  } finally {
    await db.end();
  }
});

test("CPARS capture records a rating on the contract", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { contractId } = await seedContract(db, oid);

    await loginAdmin(page);
    await page.goto(`/admin/contracts/${contractId}`);
    await page.selectOption('select[name="rating"]', "EXCEPTIONAL");
    const narrative = `Outstanding delivery ${randomUUID()}.`;
    await page.fill('textarea[name="narrative"]', narrative);
    await page.getByRole("button", { name: "Record rating" }).click();

    await expect(page.getByText(narrative)).toBeVisible();

    const rows = await db.query<{ rating: string }>(
      `SELECT rating FROM past_performance_records WHERE org_id = $1 AND contract_id = $2`,
      [oid, contractId],
    );
    expect(rows.rows[0]?.rating).toBe("EXCEPTIONAL");

    const audit = await db.query(
      `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'CPARS_RECORDED' AND entity_type = 'past_performance_records'`,
      [oid],
    );
    expect(audit.rowCount).toBeGreaterThan(0);
  } finally {
    await db.end();
  }
});

test("financials rollup is reachable from nav and shows the contract's invoice", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { contractId } = await seedContract(db, oid);
    const invoiceNumber = `E2E-ROLLUP-${randomUUID()}`;
    await db.query(
      `INSERT INTO invoices (org_id, contract_id, invoice_number, amount, status)
       VALUES ($1, $2, $3, '1234.00', 'DRAFT'::invoice_status)`,
      [oid, contractId, invoiceNumber],
    );

    await loginAdmin(page);
    await page.goto("/admin");
    await page.getByTestId("admin-nav").getByRole("link", { name: "Financials" }).click();
    await expect(page).toHaveURL(/\/admin\/financials$/);
    await expect(page.getByTestId("financials-invoices-table")).toContainText(invoiceNumber);
  } finally {
    await db.end();
  }
});

test("admin home surfaces the AI-spend rollup and compliance/payments-at-risk tiles", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText("AI spend (7d)")).toBeVisible();
  await expect(page.getByText("Payments at risk / missed")).toBeVisible();
  // exact:true — the plain stat-tile label "Compliance reminders" is also a SUBSTRING of the section
  // heading "Compliance reminders (SAM registration / reps & certs)" further down the same page, which
  // trips Playwright's strict-mode multi-match check under a default (substring) getByText.
  await expect(page.getByText("Compliance reminders", { exact: true })).toBeVisible();
});

test("settings exposes the SAM registration expiry + reps/certs recert date fields", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/settings");
  await expect(page.locator('input[name="samRegistrationExpiresAt"]')).toBeVisible();
  await expect(page.locator('input[name="repsCertsRecertDueAt"]')).toBeVisible();
});
