/**
 * Shared vendor-login helper for the e2e specs — the vendor analogue of admin-auth.ts. A cold/contended
 * standalone CI server intermittently fails the vendor Credentials sign-in (CredentialsSignin) or does not
 * immediately persist/serve the session cookie, so a single `login → waitForURL` is flaky: the failure then
 * surfaces wherever it lands — a login timeout, or a later server-action POST bounced to /login. Mirroring
 * loginAdmin, we retry the whole sign-in with a growing backoff until a GUARDED vendor page actually RENDERS
 * (proving the session is LIVE), not just trusting the redirect URL. The beforeAll warmup establishes a
 * session up front so the standalone server is warm before any assertion. auth.spec.ts keeps a single-attempt
 * vendor login as the regression canary.
 */
import { type Browser, type Page } from "@playwright/test";

import { E2E_VENDOR_EMAIL, E2E_VENDOR_PASSWORD } from "./fixtures";

export { E2E_VENDOR_EMAIL, E2E_VENDOR_PASSWORD };

export async function loginVendor(page: Page, maxAttempts = 8): Promise<void> {
  const trace: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto("/login");
    await page.fill('input[name="email"]', E2E_VENDOR_EMAIL);
    await page.fill('input[name="password"]', E2E_VENDOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/portal$/, { timeout: 15_000 }).catch(() => {});

    // Confirm a guarded vendor page actually renders (the session is LIVE + middleware admits it), rather
    // than trusting the post-login redirect URL alone.
    await page.goto("/portal");
    if (await page.getByTestId("portal-nav").isVisible().catch(() => false)) {
      if (attempt > 1) {
        console.log(`[loginVendor] vendor session established after ${attempt} attempts (cold-start warming)`);
      }
      return;
    }
    trace.push(`#${attempt}:${new URL(page.url()).pathname}`);
    // Back off so a cold/contended standalone server gets wall-clock time to warm before the next try.
    await page.waitForTimeout(Math.min(1500 * attempt, 4000));
  }

  throw new Error(`loginVendor: no live vendor session after ${maxAttempts} attempts [${trace.join(", ")}]`);
}

/** beforeAll warmup: relentlessly establish a throwaway vendor session so the server is warm up front. */
export async function warmVendorSession(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginVendor(page, 24);
  } finally {
    await context.close();
  }
}
