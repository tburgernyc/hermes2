import { expect, test, type Page } from "@playwright/test";
import { generateTotpCode } from "@hermes/core";

import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_TOTP_SECRET,
  E2E_VENDOR_EMAIL,
  E2E_VENDOR_PASSWORD,
} from "./fixtures";

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

test("admin signs in with password + TOTP and reaches /admin", async ({ page }) => {
  await login(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  // Correct password → routed to the TOTP step-up page (factor not yet satisfied).
  await page.waitForURL(/\/admin\/totp$/);
  const code = generateTotpCode(E2E_ADMIN_TOTP_SECRET);
  for (let i = 0; i < code.length; i += 1) {
    await page.locator(`[data-testid="totp-cell-${i}"]`).fill(code[i] ?? "");
  }
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
});

test("vendor signs in, reaches /portal, and is blocked from /admin", async ({ page }) => {
  await login(page, E2E_VENDOR_EMAIL, E2E_VENDOR_PASSWORD);
  await page.waitForURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Subcontractor Portal" })).toBeVisible();
  // PR-C linkage: the seeded vendor user is bound to a vetted vendor, so the session carries vendorId
  // end-to-end (DB users.vendor_id → AUTH_COLUMNS → authorize → jwt → session → page).
  await expect(page.getByTestId("vendor-link")).toContainText("Vendor account linked");
  // Middleware bounces a vendor away from the admin surface.
  await page.goto("/admin");
  await page.waitForURL(/\/portal$/);
});

test("unauthenticated access to /admin redirects to /login", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("cross-origin POST to a mutation route handler is rejected (403)", async ({ request }) => {
  const res = await request.post("/api/portal/ping", {
    headers: { origin: "https://evil.example" },
  });
  expect(res.status()).toBe(403);
});
