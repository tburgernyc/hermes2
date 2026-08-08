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

test("approvals page shows the full drafted email body and recipient before approve, then approve records it and releases the send gate", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    // TRIAGE_COMPLETE (not READY_FOR_SOURCING+) so the solicitations_sourcing_gate CHECK doesn't require a
    // recorded sourcing approver here — this test only needs a valid parent row for the outreach FK.
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations (org_id, notice_id, title, contract_type, status)
       VALUES ($1, $2, $3, 'FFP'::contract_type, 'TRIAGE_COMPLETE'::solicitation_status)
       RETURNING id`,
      [oid, `E2E-${randomUUID()}`, `Outreach Solicitation ${randomUUID()}`],
    );
    const solId = sol.rows[0]!.id;
    const contactEmail = `recipient-${randomUUID()}@e2e.test`;
    const prospect = await db.query<{ id: string }>(
      `INSERT INTO vendor_prospects (org_id, company_name, contact_email)
       VALUES ($1, 'Outreach Recipient Co', $2) RETURNING id`,
      [oid, contactEmail],
    );
    const prospectId = prospect.rows[0]!.id;
    const bodyLine1 = `Full body line one ${randomUUID()}.`;
    const bodyLine2 = `Full body line two ${randomUUID()}.`;
    const outreach = await db.query<{ id: string }>(
      `INSERT INTO outreach_campaigns (org_id, solicitation_id, prospect_id, step, status, subject, body)
       VALUES ($1, $2, $3, 'DAY_0'::outreach_step, 'PENDING_APPROVAL'::outreach_status, $4, $5)
       RETURNING id`,
      [oid, solId, prospectId, `Outreach subject ${randomUUID()}`, `${bodyLine1}\n${bodyLine2}`],
    );
    const outreachId = outreach.rows[0]!.id;

    await loginAdmin(page);
    await page.goto("/admin/approvals");

    // The CRITICAL gap this closes: the approval card must show WHO it's going to and the full drafted
    // body, not just the subject — an admin cannot approve-and-send something they can't read.
    await expect(page.getByText(contactEmail)).toBeVisible();
    await expect(page.getByText("Outreach Recipient Co")).toBeVisible();
    await expect(page.getByText(bodyLine1)).toBeVisible();
    await expect(page.getByText(bodyLine2)).toBeVisible();

    // Scope the click to this campaign's own card — the approvals list can show more than one pending
    // outreach item, and "Approve & send" is not a unique label across the page.
    const card = page.locator("li").filter({ hasText: contactEmail });
    await card.getByRole("button", { name: "Approve & send" }).click();

    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM outreach_campaigns WHERE id = $1`,
          [outreachId],
        );
        return r.rows[0]?.status;
      })
      .toBe("APPROVED");

    const audit = await db.query(
      `SELECT 1 FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND action = 'OUTREACH_APPROVED' AND entity_id = $2`,
      [oid, outreachId],
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

// §3.2 baseline audit: UNDER_REVIEW was a quoteStatus enum value with no human-facing affordance to reach
// it (shortlistQuote already ACCEPTED it as a valid source status, but nothing ever SET it). Proves the new
// markQuoteUnderReview action closes that gap, and that shortlistQuote's existing UNDER_REVIEW branch
// (previously untested from this direction) still lands on SHORTLISTED.
test("admin marks a submitted quote under review, then shortlists it from there", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const adminId = await adminUserId(db, oid);
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations
         (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
       VALUES ($1, $2, $3, 'FFP'::contract_type, 'PRICING_PENDING'::solicitation_status, $4, now())
       RETURNING id`,
      [oid, `E2E-${randomUUID()}`, `Under Review Solicitation ${randomUUID()}`, adminId],
    );
    const solId = sol.rows[0]!.id;
    const prospect = await db.query<{ id: string }>(
      `INSERT INTO vendor_prospects (org_id, company_name, contact_email)
       VALUES ($1, 'Under Review Sub Co', $2) RETURNING id`,
      [oid, `sub-${randomUUID()}@e2e.test`],
    );
    const prospectId = prospect.rows[0]!.id;
    const quote = await db.query<{ id: string }>(
      `INSERT INTO vendor_quotes
         (org_id, solicitation_id, prospect_id, status, total_price, ai_rank, ai_rationale, evaluated_at)
       VALUES ($1, $2, $3, 'SUBMITTED'::quote_status, 50000, 1, 'Under review test', now())
       RETURNING id`,
      [oid, solId, prospectId],
    );
    const quoteId = quote.rows[0]!.id;

    await loginAdmin(page);
    await page.goto(`/admin/solicitations/${solId}`);
    await expect(page.getByTestId(`quote-${quoteId}`)).toContainText("Under Review Sub Co");

    // SUBMITTED → UNDER_REVIEW (the gap this PR closes).
    await page.getByRole("button", { name: "Mark under review" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM vendor_quotes WHERE id = $1`,
          [quoteId],
        );
        return r.rows[0]?.status;
      })
      .toBe("UNDER_REVIEW");

    // The "Mark under review" affordance disappears once already under review (no re-trigger)…
    await expect(page.getByRole("button", { name: "Mark under review" })).toHaveCount(0);
    // …but Shortlist is still offered, and accepts UNDER_REVIEW as a source (SUBMITTED/UNDER_REVIEW → SHORTLISTED).
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

    const audits = await db.query<{ action: string }>(
      `SELECT action FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND entity_id = $2 ORDER BY action`,
      [oid, quoteId],
    );
    const actions = audits.rows.map((r) => r.action);
    expect(actions).toContain("QUOTE_UNDER_REVIEW");
    expect(actions).toContain("QUOTE_SHORTLISTED");
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

// §3.2 baseline audit: prospect_status RESPONDED and DECLINED were defined enum values with no writer
// anywhere — a reply logged by the admin (outside the system) or an explicit "not interested" had no way
// to be recorded. Proves the new markProspectResponded/markProspectDeclined actions close both gaps.
test("admin logs a prospect response, then declines it — both terminal-adjacent states are reachable", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const prospect = await db.query<{ id: string }>(
      `INSERT INTO vendor_prospects (org_id, company_name, contact_email, status)
       VALUES ($1, 'Responded Sub Co', $2, 'CONTACTED'::prospect_status) RETURNING id`,
      [oid, `responded-${randomUUID()}@e2e.test`],
    );
    const prospectId = prospect.rows[0]!.id;

    await loginAdmin(page);
    await page.goto("/admin/prospects");
    const card = page.getByTestId(`prospect-${prospectId}`);
    await expect(card).toContainText("Responded Sub Co");

    // CONTACTED → RESPONDED (the gap this PR closes).
    await card.getByRole("button", { name: "Log response" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM vendor_prospects WHERE id = $1`,
          [prospectId],
        );
        return r.rows[0]?.status;
      })
      .toBe("RESPONDED");
    // "Log response" is one-shot — it disappears once already responded.
    await expect(page.getByTestId(`prospect-${prospectId}`).getByRole("button", { name: "Log response" })).toHaveCount(0);

    // RESPONDED → DECLINED (the second gap this PR closes) — still reachable, mirrors "Mark qualified".
    await page.getByTestId(`prospect-${prospectId}`).getByRole("button", { name: "Decline" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM vendor_prospects WHERE id = $1`,
          [prospectId],
        );
        return r.rows[0]?.status;
      })
      .toBe("DECLINED");
    // Terminal — no more action buttons on a declined prospect.
    const declinedCard = page.getByTestId(`prospect-${prospectId}`);
    await expect(declinedCard.getByRole("button", { name: "Mark qualified" })).toHaveCount(0);
    await expect(declinedCard.getByRole("button", { name: "Decline" })).toHaveCount(0);

    const audits = await db.query<{ action: string }>(
      `SELECT action FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND entity_id = $2 ORDER BY action`,
      [oid, prospectId],
    );
    const actions = audits.rows.map((r) => r.action);
    expect(actions).toContain("PROSPECT_RESPONDED");
    expect(actions).toContain("PROSPECT_DECLINED");
  } finally {
    await db.end();
  }
});

// §3.2 baseline audit: quote_status WITHDRAWN was a defined enum value with no writer anywhere — a
// subcontractor withdrawing (vendor_quotes is deliberately INSERT-only for the vendor role, migration
// 0011) had no way to have that recorded. Proves the new withdrawQuote admin action closes the gap.
test("admin withdraws a submitted quote on the subcontractor's behalf", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const adminId = await adminUserId(db, oid);
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations
         (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
       VALUES ($1, $2, $3, 'FFP'::contract_type, 'PRICING_PENDING'::solicitation_status, $4, now())
       RETURNING id`,
      [oid, `E2E-${randomUUID()}`, `Withdraw Quote Solicitation ${randomUUID()}`, adminId],
    );
    const solId = sol.rows[0]!.id;
    const prospect = await db.query<{ id: string }>(
      `INSERT INTO vendor_prospects (org_id, company_name, contact_email)
       VALUES ($1, 'Withdraw Sub Co', $2) RETURNING id`,
      [oid, `withdraw-${randomUUID()}@e2e.test`],
    );
    const prospectId = prospect.rows[0]!.id;
    const quote = await db.query<{ id: string }>(
      `INSERT INTO vendor_quotes
         (org_id, solicitation_id, prospect_id, status, total_price, ai_rank, ai_rationale, evaluated_at)
       VALUES ($1, $2, $3, 'SUBMITTED'::quote_status, 42000, 1, 'Withdraw test', now())
       RETURNING id`,
      [oid, solId, prospectId],
    );
    const quoteId = quote.rows[0]!.id;

    await loginAdmin(page);
    await page.goto(`/admin/solicitations/${solId}`);
    await expect(page.getByTestId(`quote-${quoteId}`)).toContainText("Withdraw Sub Co");

    await page.getByRole("button", { name: "Withdraw" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM vendor_quotes WHERE id = $1`,
          [quoteId],
        );
        return r.rows[0]?.status;
      })
      .toBe("WITHDRAWN");

    // Terminal — no more decision buttons on a withdrawn quote.
    const quoteCard = page.getByTestId(`quote-${quoteId}`);
    await expect(quoteCard.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
    await expect(quoteCard.getByRole("button", { name: "Shortlist" })).toHaveCount(0);
    await expect(quoteCard.getByRole("button", { name: "Mark under review" })).toHaveCount(0);

    const audit = await db.query(
      `SELECT 1 FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND action = 'QUOTE_WITHDRAWN' AND entity_id = $2`,
      [oid, quoteId],
    );
    expect(audit.rowCount).toBe(1);
  } finally {
    await db.end();
  }
});

// §3.2 baseline audit: outreach_status BOUNCED had no writer — no bounce ingestion exists. The operator
// sees a bounce as a delivery-failure notice in their own inbox and records it on /admin/prospects; proves
// the new recordOutreachBounced action closes the gap and sends nothing (a status flip + audit row only).
test("admin records a bounced outreach send from the prospects page", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const adminId = await adminUserId(db, oid);
    // SOURCING_IN_PROGRESS is inside the `solicitations_sourcing_gate` human-gate window, so the row MUST
    // carry a recorded approver + timestamp or the insert is rejected (23514). That is also the honest
    // fixture: an outreach campaign can only be SENT if a human approved sourcing first.
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations
         (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
       VALUES ($1, $2, $3, 'FFP'::contract_type, 'SOURCING_IN_PROGRESS'::solicitation_status, $4, now())
       RETURNING id`,
      [oid, `E2E-${randomUUID()}`, `Bounce Solicitation ${randomUUID()}`, adminId],
    );
    const solId = sol.rows[0]!.id;
    const contactEmail = `bounced-${randomUUID()}@e2e.test`;
    const prospect = await db.query<{ id: string }>(
      `INSERT INTO vendor_prospects (org_id, company_name, contact_email)
       VALUES ($1, 'Bounced Recipient Co', $2) RETURNING id`,
      [oid, contactEmail],
    );
    const prospectId = prospect.rows[0]!.id;
    const outreach = await db.query<{ id: string }>(
      `INSERT INTO outreach_campaigns
         (org_id, solicitation_id, prospect_id, step, status, subject, body, approved_by, approved_at, sent_at)
       VALUES ($1, $2, $3, 'DAY_0'::outreach_step, 'SENT'::outreach_status, $4, 'Body text.', $5, now(), now())
       RETURNING id`,
      [oid, solId, prospectId, `Bounce subject ${randomUUID()}`, adminId],
    );
    const outreachId = outreach.rows[0]!.id;

    await loginAdmin(page);
    await page.goto("/admin/prospects");
    const card = page.getByTestId(`sent-outreach-${outreachId}`);
    await expect(card).toContainText(contactEmail);
    await card.getByRole("button", { name: "Record bounce" }).click();

    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT status FROM outreach_campaigns WHERE id = $1`,
          [outreachId],
        );
        return r.rows[0]?.status;
      })
      .toBe("BOUNCED");

    const audit = await db.query(
      `SELECT 1 FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND action = 'OUTREACH_BOUNCED' AND entity_id = $2`,
      [oid, outreachId],
    );
    expect(audit.rowCount).toBe(1);

    // Recording a bounce sends nothing — no new audit row claims a send/approval for this campaign.
    const noSend = await db.query(
      `SELECT 1 FROM audit_log WHERE org_id = $1 AND entity_id = $2 AND action ILIKE '%SENT%'`,
      [oid, outreachId],
    );
    expect(noSend.rowCount).toBe(0);

    // The bounced card no longer appears in the "record a bounce" list (BOUNCED is no longer SENT).
    await page.goto("/admin/prospects");
    await expect(page.getByTestId(`sent-outreach-${outreachId}`)).toHaveCount(0);
  } finally {
    await db.end();
  }
});
