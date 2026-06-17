/**
 * VENDOR_INVITE onboarding e2e (Phase-6 portal). Drives the full path: an admin (password + live TOTP)
 * mints a single-use invite link for the seeded VETTED vendor, the invitee opens the PUBLIC /invite page
 * and sets a password, and the newly-created VENDOR user then signs in and reaches /portal already linked
 * to the vendor. Proves the DB→session vendorId path for a user the admin never touched directly, and that
 * the invite is delivered copy-link (no automated outbound — CLAUDE.md §2).
 */
import { expect, test, type Page } from "@playwright/test";

import { loginAdmin } from "./admin-auth";

// A fresh invitee email per run so re-runs against a persisted DB never collide on users_email_lower_key.
function uniqueEmail(): string {
  return `invitee-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

async function loginVendor(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

// Warm the cold-start window up front (admin login drives the TOTP step-up — see admin-auth.ts).
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

test("admin mints an invite; invitee onboards and signs in to the linked portal", async ({ page }) => {
  const invitedEmail = uniqueEmail();
  const password = "Sub-Contractor-Pw-123!";

  // 1. Admin mints a single-use invite for the seeded VETTED vendor.
  await loginAdmin(page);
  await page.goto("/admin/vendors");
  await page.getByRole("heading", { name: "Invite a vendor user" }).scrollIntoViewIfNeeded();
  await page.selectOption('select[name="vendorId"]', { label: "E2E Vendor Co" });
  await page.fill('input[name="email"]', invitedEmail);
  await page.getByRole("button", { name: "Create invite link" }).click();

  // The link is shown ONCE (we persist only its hash). Read it and reduce to the local path.
  const link = page.getByTestId("invite-link").locator("code");
  await expect(link).toBeVisible();
  const linkText = (await link.textContent())?.trim() ?? "";
  expect(linkText).toContain("/invite/");
  const invitePath = new URL(linkText).pathname;

  // 2. The invitee opens the PUBLIC accept page (no session) and sets a password.
  await page.goto(invitePath);
  await expect(page.getByRole("heading", { name: "Set up your subcontractor account" })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toHaveValue(invitedEmail);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/login/);

  // 3. The new VENDOR user signs in → /portal, already linked to the vendor (DB → session vendorId).
  await loginVendor(page, invitedEmail, password);
  await page.waitForURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Subcontractor Portal" })).toBeVisible();
  await expect(page.getByTestId("vendor-link")).toContainText("Vendor account linked");
});

test("an invalid invite token shows the invalid-link page (no stack trace)", async ({ page }) => {
  await page.goto("/invite/not-a-real-token");
  await expect(page.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
});
