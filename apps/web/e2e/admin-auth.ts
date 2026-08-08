/**
 * Shared admin-login helper for the e2e specs. Extracted from admin-console.spec.ts so every admin-driving
 * spec uses the same self-verifying TOTP step-up loop (it confirms a GUARDED page actually renders rather
 * than trusting the redirect URL — see the cold-start note below). Specs run their own beforeAll warmup.
 */
import { expect, type Page } from "@playwright/test";

import { generateTotpCode } from "@hermes/core";

import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_TOTP_SECRET } from "./fixtures";

export { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_TOTP_SECRET };

export interface AdminCreds {
  email: string;
  password: string;
  totpSecret: string;
}

/**
 * Same self-verifying TOTP step-up loop as `loginAdmin`, parameterized over WHICH admin fixture logs in —
 * `admin-rbac.spec.ts` uses this with the §3.6 CAPTURE-role fixture (see fixtures.ts). `loginAdmin` below
 * is the pre-existing FULL-admin convenience wrapper every other spec already calls.
 */
export async function loginAdminAs(page: Page, creds: AdminCreds, maxAttempts = 8): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/totp$/);

  // Establish the TOTP step-up, confirming the session is actually LIVE (a guarded page renders) rather
  // than trusting the redirect URL alone. On a cold/contended CI runner next-auth's unstable_update
  // intermittently fails to PERSIST the refreshed session cookie (confirmed via CI diagnostics): the
  // step-up action still computes totpVerified=true and redirects to /admin, but the cookie isn't written,
  // so middleware bounces /admin back to /admin/totp. Fast retries don't help — the standalone server needs
  // wall-clock TIME (not just more calls) to warm — so we re-submit a fresh code with a growing backoff.
  // The beforeAll warmup relentlessly establishes a session up front to prove the server warm; once warm,
  // per-test logins succeed on the first attempt. auth.spec.ts keeps the single-attempt path as the canary.
  const trace: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (!page.url().includes("/admin/totp")) {
      await page.goto("/admin/totp");
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
    if (page.url().includes("/admin/totp")) {
      await page.fill('input[name="code"]', generateTotpCode(creds.totpSecret));
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    await page.goto("/admin");
    if (await page.getByRole("heading", { name: "Admin Console" }).isVisible().catch(() => false)) {
      if (attempt > 1) {
        console.log(`[loginAdmin] admin session established after ${attempt} attempts (cold-start warming)`);
      }
      return;
    }
    trace.push(`#${attempt}:${new URL(page.url()).pathname}`);
    // Back off so a cold/contended standalone server gets wall-clock time to warm before the next try.
    await page.waitForTimeout(Math.min(1500 * attempt, 4000));
  }

  throw new Error(`loginAdmin: no live admin session after ${maxAttempts} step-up attempts [${trace.join(", ")}]`);
}

/** The FULL-admin convenience wrapper every pre-existing spec calls (unchanged signature/behavior). */
export async function loginAdmin(page: Page, maxAttempts = 8): Promise<void> {
  return loginAdminAs(
    page,
    { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD, totpSecret: E2E_ADMIN_TOTP_SECRET },
    maxAttempts,
  );
}

/** Tiny convenience used by some specs to assert a heading once logged in. */
export async function expectAdminConsole(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
}
