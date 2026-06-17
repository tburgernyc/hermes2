/**
 * Phase 7b — security headers + CSP (CLAUDE.md §7). Proves the global header set is present on public
 * responses AND that the strict nonce'd CSP does not break the app: every probed page must load with ZERO
 * CSP violations (a blocked framework script logs a console CSP error — that is the real regression catch),
 * and Next must stamp the per-request nonce onto its scripts. Login-free on purpose, so it does not ride
 * the documented admin cold-start flake; the same middleware/policy applies to /admin + /portal.
 */
import { expect, test } from "@playwright/test";

const CSP_VIOLATION_RE = /content security policy|refused to (execute|load|apply|connect|frame)/i;

test.describe("security headers + CSP", () => {
  test("public document carries the strict security header set", async ({ page }) => {
    const res = await page.goto("/");
    expect(res).not.toBeNull();
    const h = res!.headers();

    const csp = h["content-security-policy"];
    expect(csp, "CSP header present").toBeTruthy();
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("report-uri /api/csp-report");

    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    // HSTS + upgrade-insecure-requests are https-gated → ABSENT over the plaintext e2e connection.
    expect(h["strict-transport-security"]).toBeUndefined();
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  test("Next stamps the per-request nonce onto its scripts (CSP is not breaking the framework)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    expect(await page.locator("script[nonce]").count()).toBeGreaterThan(0);
  });

  test("public pages load with NO CSP violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && CSP_VIOLATION_RE.test(m.text())) violations.push(m.text());
    });
    page.on("pageerror", (e) => {
      if (CSP_VIOLATION_RE.test(e.message)) violations.push(e.message);
    });

    // /, marketing, login (framework scripts) + an invalid-invite page (exercises inline style-src).
    for (const path of ["/", "/login", "/contact", "/invite/not-a-valid-token"]) {
      violations.length = 0;
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(300); // let async chunk loads settle so a block would surface
      expect(violations, `CSP violations on ${path}: ${violations.join(" | ")}`).toEqual([]);
    }
  });

  test("/api/health returns 200 ok with nosniff and NO CSP (matcher-excluded)", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["x-content-type-options"]).toBe("nosniff"); // static headers cover /api
    expect(res.headers()["content-security-policy"]).toBeUndefined(); // /api bypasses the CSP matcher
  });

  test("HSTS + upgrade-insecure-requests fire ONLY when x-forwarded-proto=https", async ({ request }) => {
    // Positive proof of the https-gating (the other tests prove they are ABSENT over plaintext).
    const res = await request.get("/", { headers: { "x-forwarded-proto": "https" } });
    expect(res.headers()["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
    expect(res.headers()["content-security-policy"]).toContain("upgrade-insecure-requests");
  });
});
