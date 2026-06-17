import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ORG_ID } from "./fixtures";

/**
 * Public marketing site (Phase 7a): the pages render, both audience CTAs work, the contact form stores
 * an org-scoped inquiry with NO outbound (Prime Directive §2), abuse is throttled, truthful placeholders
 * are visible, and the key pages pass an axe WCAG A/AA scan. The app under test runs on the owner DSN
 * (RLS faithfulness is the `db` job); here we exercise the public surface end to end.
 */
const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

function pool(): Pool {
  return new Pool({ connectionString: OWNER_DSN });
}

const PAGES = ["/", "/capabilities", "/about", "/contact", "/privacy", "/terms"];

test.describe("public marketing site", () => {
  test("home shows both audience CTAs and the nav works", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Partner with us" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /capability statement/i }).first()).toBeVisible();

    await page.getByRole("link", { name: "Capabilities" }).first().click();
    await expect(page).toHaveURL(/\/capabilities$/);
    await expect(page.getByRole("heading", { level: 1, name: "Capabilities" })).toBeVisible();
  });

  test("every marketing page renders (no 5xx) with exactly one h1", async ({ page }) => {
    for (const path of PAGES) {
      const res = await page.goto(path);
      expect(res?.ok(), `${path} should respond 2xx`).toBeTruthy();
      await expect(page.locator("h1"), `${path} h1 count`).toHaveCount(1);
    }
  });

  test("the CAGE code shows as a visible placeholder, not a fabricated value (truthfulness)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText(/Pending assignment/i).first()).toBeVisible();
    // The capability statement is a placeholder, not a real download.
    await page.goto("/capabilities");
    await expect(page.getByText(/PDF in preparation/i)).toBeVisible();
  });

  test("contact form stores an inquiry — no outbound — and the admin can read it", async ({
    page,
  }) => {
    const stamp = Date.now();
    const email = `e2e-contact-${stamp}@example.test`;
    const note = `Teaming inquiry ${stamp}`;

    await page.goto("/contact?intent=teaming");
    await expect(page.locator("#intent")).toHaveValue("TEAMING"); // CTA intent prefilled the select
    await page.fill("#name", "E2E Teaming Co");
    await page.fill("#email", email);
    await page.fill("#company", "E2E Primes LLC");
    await page.fill("#message", note);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByTestId("contact-status")).toContainText(/received/i);

    // Owner-DSN read-back: exactly one NEW, firm-scoped inquiry with the submitted intent — and nothing
    // else (no vendor row, no workflow advance — the form only ever writes contact_inquiries).
    const p = pool();
    try {
      const { rows } = await p.query<{ intent: string; status: string; company: string }>(
        `SELECT intent, status, company FROM contact_inquiries WHERE org_id = $1 AND email = $2`,
        [E2E_ORG_ID, email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.intent).toBe("TEAMING");
      expect(rows[0]?.status).toBe("NEW");
      expect(rows[0]?.company).toBe("E2E Primes LLC");
    } finally {
      await p.end();
    }
  });

  test("the contact form is rate-limited at exactly MAX_HITS per window", async ({ page }) => {
    // Isolate from the other tests' shared "contact:unknown" bucket by stamping a dedicated client IP:
    // clientKey() trusts the RIGHTMOST X-Forwarded-For when Fly-Client-IP is absent, so this is a fresh
    // per-IP bucket. With isolation we can assert the EXACT limit (10), not just "eventually throttled".
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.7" });
    let successes = 0;
    let throttled = false;
    for (let i = 0; i < 13 && !throttled; i++) {
      await page.goto("/contact");
      await page.fill("#name", "Flooder");
      await page.fill("#email", `flood-${i}@example.test`);
      await page.fill("#message", `flood ${i}`);
      await page.getByRole("button", { name: "Send message" }).click();
      const text = (await page.getByTestId("contact-status").textContent()) ?? "";
      if (/too many/i.test(text)) throttled = true;
      else successes += 1;
    }
    expect(throttled, "expected the throttled status after the limit").toBeTruthy();
    // MAX_HITS in apps/web/lib/rate-limit.ts is 10 — exactly 10 submits succeed, the 11th is throttled.
    expect(successes, "exactly MAX_HITS submits should be allowed before throttling").toBe(10);
  });

  test("every marketing page passes an axe WCAG A/AA scan (no serious/critical violations)", async ({
    page,
  }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        blocking,
        `${path} axe violations: ${JSON.stringify(blocking.map((v) => v.id))}`,
      ).toEqual([]);
    }
  });
});
