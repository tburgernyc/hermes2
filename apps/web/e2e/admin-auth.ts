/**
 * Shared admin-login helper for the e2e specs. Extracted from admin-console.spec.ts so every admin-driving
 * spec uses the same self-verifying TOTP step-up loop: it confirms a GUARDED page actually RENDERS rather
 * than trusting the redirect URL (an unestablished session redirects just fine, which is what this helper
 * exists to catch). Specs run their own beforeAll warmup.
 *
 * Every wait in here must be an actual wait for the thing it names. The two bugs fixed below were both
 * "a wait that isn't one", and each on its own is enough to fail every attempt on a healthy app.
 */
import { expect, type Page } from "@playwright/test";

import { generateTotpCode } from "@hermes/core";

import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_TOTP_SECRET } from "./fixtures";

export { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_TOTP_SECRET };

export async function loginAdmin(page: Page, maxAttempts = 8): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', E2E_ADMIN_EMAIL);
  await page.fill('input[name="password"]', E2E_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/totp$/);

  // Establish the TOTP step-up, confirming the session is actually LIVE (a guarded page renders) rather
  // than trusting the redirect URL alone. The retry loop stays: on a cold/contended CI runner next-auth's
  // unstable_update can be slow, and re-submitting a fresh code with a growing backoff rides that out.
  // The beforeAll warmup relentlessly establishes a session up front to prove the server warm; once warm,
  // per-test logins succeed on the first attempt. auth.spec.ts keeps the single-attempt path as the canary.
  //
  // TWO timing bugs used to make this loop fail 100% of the time on a WARM server (fixed here — see the
  // per-step comments): it navigated away before the step-up Server Action had answered (aborting it), and
  // it judged the guarded page with a non-auto-waiting isVisible().
  const trace: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (!page.url().includes("/admin/totp")) {
      await page.goto("/admin/totp");
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
    // Only submit a code when the step-up FORM is really on screen. /admin/totp streams its content behind
    // a route-level Suspense boundary (app/admin/totp/loading.tsx), and once totpVerified is true the page
    // redirects to /admin instead of rendering the form — so "the URL is /admin/totp" is not the same thing
    // as "there is a code input to fill".
    const codeInput = page.locator('input[name="code"]');
    const formReady = await codeInput
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (formReady) {
      await codeInput.fill(generateTotpCode(E2E_ADMIN_TOTP_SECRET));
      // The refreshed session cookie is written by the RESPONSE to this Server Action POST. Wait for that
      // response before touching page.goto(): a navigation destroys the document and ABORTS the in-flight
      // action, so the Set-Cookie never reaches the browser and the session can never go live. The old code
      // used waitForLoadState("networkidle") here, which is NOT a wait for the POST — Playwright returns
      // immediately once the CURRENT document has already reached network-idle (always true after the
      // backoff sleep), so every attempt aborted its own step-up and bounced back to /admin/totp forever.
      const stepUp = page
        .waitForResponse(
          (res) => res.request().method() === "POST" && new URL(res.url()).pathname === "/admin/totp",
          { timeout: 30_000 },
        )
        .catch(() => null);
      await page.click('button[type="submit"]');
      await stepUp;
      // Let the action's redirect settle (success → /admin, rejected code → /admin/totp?error=…) so the
      // cookie is committed before the guarded-page check below. Either outcome resolves fast; a timeout
      // here is not fatal — the guarded-page check is the real verdict.
      await page.waitForURL(/\/admin$|\/admin\/totp\?error=/, { timeout: 15_000 }).catch(() => {});
    }

    // The guarantee this helper exists for: prove the session is genuinely live by making a GUARDED page
    // really render, not by trusting a redirect URL. Use the AUTO-RETRYING assertion: /admin is
    // force-dynamic behind a route-level Suspense boundary (app/admin/(console)/loading.tsx), so at the
    // instant page.goto() resolves the heading is in the DOM but not yet painted — a bare, non-waiting
    // isVisible() reports false for a perfectly live session (reproduced 3/3 locally). Waiting for the
    // heading to become visible does not lower the bar; it still requires the guarded server render.
    await page.goto("/admin");
    const live = await expect(page.getByRole("heading", { name: "Admin Console" }))
      .toBeVisible({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (live) {
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

/** Tiny convenience used by some specs to assert a heading once logged in. */
export async function expectAdminConsole(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
}
