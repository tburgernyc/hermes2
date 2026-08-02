/**
 * §3.8.2 proactive vendor-bench e2e. Adds a vendor to the bench (no opportunity/solicitation involved
 * anywhere in the form) through the real admin UI against real Postgres, then proves the searchable/
 * filterable directory: found by its own NAICS code and by a capability keyword, absent under an
 * unrelated NAICS filter.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ORG_SLUG } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("bench.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

async function orgId(db: Pool): Promise<string> {
  const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
  const id = org.rows[0]?.id;
  if (!id) throw new Error("bench.spec: e2e org not found (global-setup did not run?)");
  return id;
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

test("a vendor added to the bench is independent of any opportunity, then found via directory filter", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const company = `Bench Vendor ${randomUUID()}`;
    const naics = "541512"; // distinct from the firm's default 541511/541519 seeds, low collision risk

    await loginAdmin(page);
    await page.goto("/admin/bench");
    await page.fill('input[name="companyName"]', company);
    await page.fill('input[name="contactEmail"]', `bench-${randomUUID()}@e2e.test`);
    await page.fill('input[name="naicsCodes"]', naics);
    await page.fill('input[name="capabilitiesText"]', "Cloud migration and endpoint management.");
    await page.getByRole("button", { name: "Add to bench" }).click();

    // The row lands directly in `vendors` — no prospect, no promotion, no solicitation reference at all.
    let vendorId = "";
    await expect
      .poll(async () => {
        const r = await db.query<{
          id: string;
          status: string;
          promoted_from_prospect_id: string | null;
        }>(
          `SELECT id, status, promoted_from_prospect_id FROM vendors WHERE org_id = $1 AND company_name = $2`,
          [oid, company],
        );
        const row = r.rows[0];
        if (row) vendorId = row.id;
        return row ? `${row.status}/${row.promoted_from_prospect_id ?? "null"}` : undefined;
      })
      .toBe("PENDING_REVIEW/null");

    const audit = await db.query(
      `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'VENDOR_ADDED_TO_BENCH' AND entity_id = $2`,
      [oid, vendorId],
    );
    expect(audit.rowCount).toBe(1);

    // Found via the directory's NAICS filter.
    await page.goto(`/admin/bench?naics=${naics}`);
    await expect(page.getByTestId(`bench-vendor-${vendorId}`)).toBeVisible();
    await expect(page.getByTestId(`bench-vendor-${vendorId}`)).toContainText(`NAICS ${naics}`);

    // Found via a capability keyword filter too.
    await page.goto(`/admin/bench?q=${encodeURIComponent("Cloud migration")}`);
    await expect(page.getByTestId(`bench-vendor-${vendorId}`)).toBeVisible();

    // NOT found under an unrelated NAICS code.
    await page.goto("/admin/bench?naics=999999");
    await expect(page.getByTestId(`bench-vendor-${vendorId}`)).toHaveCount(0);
  } finally {
    await db.end();
  }
});
