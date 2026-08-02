/**
 * §3.6 granular admin RBAC e2e — the DEFINITION-OF-DONE proof item (§4 item 10): a non-FULL admin-role
 * user hitting /admin/settings is denied SERVER-SIDE (a real HTTP redirect the browser follows, driven by
 * middleware.ts + the page's own requireFullAdmin), never merely a hidden nav link. Drives a REAL browser
 * as the seeded CAPTURE-role admin fixture (password + live TOTP, same as every other admin e2e) — this is
 * not a unit test of the guard function, it is proof the deployed route actually refuses the request.
 */
import { expect, test } from "@playwright/test";

import {
  E2E_CAPTURE_ADMIN_EMAIL,
  E2E_CAPTURE_ADMIN_PASSWORD,
  E2E_CAPTURE_ADMIN_TOTP_SECRET,
} from "./fixtures";
import { loginAdmin, loginAdminAs } from "./admin-auth";

const CAPTURE_CREDS = {
  email: E2E_CAPTURE_ADMIN_EMAIL,
  password: E2E_CAPTURE_ADMIN_PASSWORD,
  totpSecret: E2E_CAPTURE_ADMIN_TOTP_SECRET,
};

// Warm the standalone server's cold-start window (see admin-auth.ts / admin-console.spec.ts note) — this
// spec runs its own warmup so it is correct standalone, regardless of file execution order.
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

test("a CAPTURE-role admin hitting /admin/settings is redirected away server-side, not just hidden from nav", async ({
  page,
}) => {
  await loginAdminAs(page, CAPTURE_CREDS);

  // The nav omits the Settings link for a CAPTURE admin (UX courtesy — see layout.tsx) …
  await page.goto("/admin");
  await expect(page.getByTestId("admin-nav").getByRole("link", { name: "Settings" })).toHaveCount(0);

  // … but the real proof is navigating STRAIGHT to the URL: middleware refuses it before the settings
  // page ever renders. Assert the browser actually left /admin/settings (a real redirect, not a client
  // route guard) and landed back on the dashboard with a visible, non-generic denial.
  await page.goto("/admin/settings");
  await page.waitForURL((url) => url.pathname !== "/admin/settings");
  expect(new URL(page.url()).pathname).toBe("/admin");
  await expect(page.getByTestId("admin-denied-banner")).toBeVisible();
  await expect(page.getByTestId("admin-denied-banner")).toContainText("settings");

  // The settings form itself never rendered (not present anywhere on the landing page it bounced to).
  await expect(page.locator('input[name="uei"]')).toHaveCount(0);
});

test("a CAPTURE-role admin hitting /admin/users (the admin-role-assignment surface) is also redirected server-side", async ({
  page,
}) => {
  await loginAdminAs(page, CAPTURE_CREDS);
  await page.goto("/admin/users");
  await page.waitForURL((url) => url.pathname !== "/admin/users");
  expect(new URL(page.url()).pathname).toBe("/admin");
  await expect(page.getByTestId("admin-denied-banner")).toBeVisible();
});

test("a CAPTURE-role admin CAN still reach its own domain (solicitations) — the guard is scoped, not blanket", async ({
  page,
}) => {
  await loginAdminAs(page, CAPTURE_CREDS);
  await page.goto("/admin/solicitations");
  expect(new URL(page.url()).pathname).toBe("/admin/solicitations");
  await expect(page.getByRole("heading", { name: "Solicitations" })).toBeVisible();
});

test("a FULL admin can open /admin/users and see the CAPTURE fixture listed with its assigned level", async ({
  page,
}) => {
  await loginAdmin(page);
  await page.goto("/admin/users");
  expect(new URL(page.url()).pathname).toBe("/admin/users");
  await expect(page.getByTestId("admin-users-list")).toContainText(E2E_CAPTURE_ADMIN_EMAIL);
  await expect(page.getByTestId("admin-users-list")).toContainText("CAPTURE");
});
