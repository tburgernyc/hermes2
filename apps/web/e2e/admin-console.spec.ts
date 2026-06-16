/**
 * Admin operator console e2e (PR G). Drives a real browser as the seeded admin (password + live TOTP)
 * through the new console surfaces and asserts each HUMAN decision landed in the DB with an ADMIN audit
 * row — and, critically, that selecting a winning quote does NOT advance the solicitation or submit
 * anything (CLAUDE.md §2 Prime Directive: a human records the choice; the priced bid draft + any
 * submission are separate, gated steps). The app connects with the owner DSN; these assertions read
 * committed rows back directly.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ADMIN_EMAIL, E2E_ORG_SLUG } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("admin-console.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

async function orgId(db: Pool): Promise<string> {
  const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
  const id = org.rows[0]?.id;
  if (!id) throw new Error("admin-console.spec: e2e org not found (global-setup did not run?)");
  return id;
}

async function adminUserId(db: Pool, oid: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
    [oid, E2E_ADMIN_EMAIL],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("admin-console.spec: e2e admin not found (global-setup did not run?)");
  return id;
}

// Warm the standalone server's cold-start window BEFORE any assertion so the per-test logins run warm.
// admin-console runs first in the suite (alphabetical), so warming here warms the whole run. On a very cold
// runner next-auth's unstable_update needs many seconds before it reliably persists the refreshed session
// cookie, so we relentlessly retry the throwaway login until it establishes — only then is the shared
// server proven warm. The generous budget fails loudly only if the cookie never persists (a real bug).
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

test("solicitations board renders the phase lanes and a triaged card", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const title = `Board Solicitation ${randomUUID()}`;
    await db.query(
      `INSERT INTO solicitations
         (org_id, notice_id, title, agency, contract_type, status, feasibility_score, zero_float_fit, scope_text)
       VALUES ($1, $2, $3, 'Test Agency', 'FFP'::contract_type, 'TRIAGE_COMPLETE'::solicitation_status,
               7, 'MODERATE'::zero_float_fit, 'A short scope of work for the board test.')`,
      [oid, `E2E-${randomUUID()}`, title],
    );

    await loginAdmin(page);
    await page.goto("/admin/solicitations");
    await expect(page.getByRole("heading", { name: "Solicitations" })).toBeVisible();
    // The five board lanes are present, and the triaged card sits in the Triage lane.
    await expect(page.getByTestId("column-Triage")).toContainText(title);
    await expect(page.getByTestId("column-Pricing & bid")).toBeVisible();
  } finally {
    await db.end();
  }
});

test("admin marks a triaged solicitation no-go (terminal, audited, no outbound)", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations (org_id, notice_id, title, contract_type, status, feasibility_score)
       VALUES ($1, $2, $3, 'FFP'::contract_type, 'TRIAGE_COMPLETE'::solicitation_status, 4)
       RETURNING id`,
      [oid, `E2E-${randomUUID()}`, `No-go Solicitation ${randomUUID()}`],
    );
    const solId = sol.rows[0]!.id;

    await loginAdmin(page);
    await page.goto(`/admin/solicitations/${solId}`);
    await page.getByRole("button", { name: "No-go" }).click();

    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM solicitations WHERE id = $1`,
          [solId],
        );
        return r.rows[0]?.status;
      })
      .toBe("NO_GO");

    const audit = await db.query(
      `SELECT 1 FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND action = 'SOLICITATION_NO_GO' AND entity_id = $2`,
      [oid, solId],
    );
    expect(audit.rowCount).toBe(1);
  } finally {
    await db.end();
  }
});

test("admin shortlists then selects a winning quote — select records the choice but does NOT advance the solicitation", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    // PRICING_PENDING is past the sourcing gate, so the CHECK requires a recorded human approver —
    // seed it as if an admin had approved sourcing earlier in the lifecycle.
    const adminId = await adminUserId(db, oid);
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations
         (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
       VALUES ($1, $2, $3, 'FFP'::contract_type, 'PRICING_PENDING'::solicitation_status, $4, now())
       RETURNING id`,
      [oid, `E2E-${randomUUID()}`, `Pricing Solicitation ${randomUUID()}`, adminId],
    );
    const solId = sol.rows[0]!.id;
    const prospect = await db.query<{ id: string }>(
      `INSERT INTO vendor_prospects (org_id, company_name, contact_email)
       VALUES ($1, 'Selected Sub Co', $2) RETURNING id`,
      [oid, `sub-${randomUUID()}@e2e.test`],
    );
    const prospectId = prospect.rows[0]!.id;
    const quote = await db.query<{ id: string }>(
      `INSERT INTO vendor_quotes
         (org_id, solicitation_id, prospect_id, status, total_price, ai_rank, ai_rationale, evaluated_at)
       VALUES ($1, $2, $3, 'SUBMITTED'::quote_status, 100000, 1, 'Strong technical fit', now())
       RETURNING id`,
      [oid, solId, prospectId],
    );
    const quoteId = quote.rows[0]!.id;

    await loginAdmin(page);
    await page.goto(`/admin/solicitations/${solId}`);
    await expect(page.getByTestId(`quote-${quoteId}`)).toContainText("Selected Sub Co");

    // Shortlist: SUBMITTED → SHORTLISTED.
    await page.getByRole("button", { name: "Shortlist" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM vendor_quotes WHERE id = $1`,
          [quoteId],
        );
        return r.rows[0]?.status;
      })
      .toBe("SHORTLISTED");

    // Select winner: SHORTLISTED → SELECTED.
    await page.getByRole("button", { name: "Select winner" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM vendor_quotes WHERE id = $1`,
          [quoteId],
        );
        return r.rows[0]?.status;
      })
      .toBe("SELECTED");

    // Prime Directive: selecting the winner does NOT advance the solicitation or submit anything.
    const solAfter = await db.query<{ status: string }>(
      `SELECT status FROM solicitations WHERE id = $1`,
      [solId],
    );
    expect(solAfter.rows[0]!.status).toBe("PRICING_PENDING");
    const proposals = await db.query(
      `SELECT 1 FROM proposals WHERE org_id = $1 AND solicitation_id = $2`,
      [oid, solId],
    );
    expect(proposals.rowCount).toBe(0); // no bid drafted/submitted by selecting

    const audits = await db.query<{ action: string }>(
      `SELECT action FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND entity_id = $2 ORDER BY action`,
      [oid, quoteId],
    );
    const actions = audits.rows.map((r) => r.action);
    expect(actions).toContain("QUOTE_SHORTLISTED");
    expect(actions).toContain("QUOTE_SELECTED");
  } finally {
    await db.end();
  }
});

test("admin manually adds a prospect, then marks it qualified", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const company = `Manual Prospect ${randomUUID()}`;

    await loginAdmin(page);
    await page.goto("/admin/prospects");
    await page.fill('input[name="companyName"]', company);
    await page.fill('input[name="contactEmail"]', `manual-${randomUUID()}@e2e.test`);
    await page.fill('input[name="naicsCodes"]', "541511, 541512");
    await page.getByRole("button", { name: "Add prospect" }).click();

    let prospectId = "";
    await expect
      .poll(async () => {
        const r = await db.query<{ id: string; status: string; prospect_source: string }>(
          `SELECT id, status, prospect_source FROM vendor_prospects WHERE org_id = $1 AND company_name = $2`,
          [oid, company],
        );
        const row = r.rows[0];
        if (row) prospectId = row.id;
        return row ? `${row.status}/${row.prospect_source}` : undefined;
      })
      .toBe("NEW/MANUAL");

    const addAudit = await db.query(
      `SELECT 1 FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND action = 'PROSPECT_ADDED' AND entity_id = $2`,
      [oid, prospectId],
    );
    expect(addAudit.rowCount).toBe(1);

    // Mark qualified (feeds the vendor promotion flow).
    await page.goto("/admin/prospects");
    await page
      .getByTestId(`prospect-${prospectId}`)
      .getByRole("button", { name: "Mark qualified" })
      .click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM vendor_prospects WHERE id = $1`,
          [prospectId],
        );
        return r.rows[0]?.status;
      })
      .toBe("QUALIFIED");
  } finally {
    await db.end();
  }
});
