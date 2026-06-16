/**
 * Proposal review surface e2e (PR H). Inngest does not run in web-e2e, so we SEED a DRAFT proposal directly
 * (owner DSN) and drive the human review gates in a real browser: render the deterministic brief, record
 * counsel review, mark ready — and then prove the Prime Directive (CLAUDE.md §2/§6): a human pressing
 * "Submit" is STRUCTURALLY BLOCKED on the provisional baseline (the proposal stays READY_TO_SUBMIT,
 * submitted_by stays NULL, and a BID_SUBMIT_BLOCKED audit row lands). No real bid can leave the building.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ADMIN_EMAIL, E2E_ORG_SLUG } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("proposal.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

async function orgId(db: Pool): Promise<string> {
  const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
  const id = org.rows[0]?.id;
  if (!id) throw new Error("proposal.spec: e2e org not found (global-setup did not run?)");
  return id;
}

async function adminUserId(db: Pool, oid: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
    [oid, E2E_ADMIN_EMAIL],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("proposal.spec: e2e admin not found (global-setup did not run?)");
  return id;
}

const PRICING_JSON = JSON.stringify({
  watermark: "PROVISIONAL — illustrative indirect rates",
  disclaimer: "Scenarios are a decision aid; you choose the number.",
  scenarios: [
    { label: "Conservative", feePct: 0.07, price: 120000, marginPct: 0.065, vsBenchmarkMedianPct: -0.05 },
    { label: "Target", feePct: 0.1, price: 130000, marginPct: 0.09, vsBenchmarkMedianPct: 0.02 },
  ],
});

const COMPLIANCE_JSON = JSON.stringify({
  provisional: true,
  watermark: "PROVISIONAL",
  disclaimer: "Draft for human + external counsel review.",
  compliance: {
    checklist: [{ item: "Limitations on subcontracting within 50%", passed: true }],
    blocking: false,
  },
  bidChecklist: {
    checklist: [{ item: "Pricing math reconciles", passed: true }],
    blocking: false,
  },
  liveSubmission: {
    ready: false,
    blockers: [
      "Compliance thresholds not counsel-confirmed (pendingCounsel).",
      "Provisional rates in use — load actual indirect rates.",
      "SAM registration not active (FAR 52.204-7).",
      "CAGE code not assigned.",
    ],
  },
});

/** Seed a PROPOSAL_DRAFT solicitation + a DRAFT proposal with a realistic deterministic brief. */
async function seedDraftProposal(db: Pool, oid: string): Promise<{ solId: string; proposalId: string }> {
  const approver = await adminUserId(db, oid);
  const sol = await db.query<{ id: string }>(
    `INSERT INTO solicitations
       (org_id, notice_id, title, status, contract_type, sourcing_approved_by, sourcing_approved_at, scope_text)
     VALUES ($1, $2, $3, 'PROPOSAL_DRAFT'::solicitation_status, 'FFP'::contract_type, $4, now(),
             'Provide IT support services.')
     RETURNING id`,
    [oid, `E2E-PROP-${randomUUID()}`, `Proposal Solicitation ${randomUUID()}`, approver],
  );
  const solId = sol.rows[0]!.id;
  const prop = await db.query<{ id: string }>(
    `INSERT INTO proposals
       (org_id, solicitation_id, contract_type, status, pricing_scenarios, compliance_checklist,
        government_payment_basis, total_cost_of_work, adequate_price_competition)
     VALUES ($1, $2, 'FFP'::contract_type, 'DRAFT'::proposal_status, $3::jsonb, $4::jsonb, 130000, 118000, true)
     RETURNING id`,
    [oid, solId, PRICING_JSON, COMPLIANCE_JSON],
  );
  return { solId, proposalId: prop.rows[0]!.id };
}

// Warm the cold-start window so the per-test logins run warm (mirrors admin-console.spec).
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

test("renders the deterministic brief: scenarios, compliance, bid checklist, and live blockers", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { solId } = await seedDraftProposal(db, oid);

    await loginAdmin(page);
    await page.goto(`/admin/solicitations/${solId}/proposal`);

    await expect(page.getByRole("heading", { name: "Bid decision-brief" })).toBeVisible();
    const scenarios = page.getByTestId("pricing-scenarios");
    await expect(scenarios).toBeVisible();
    await expect(scenarios).toContainText("Conservative");
    await expect(scenarios).toContainText("Target");
    // Compliance + §3 bid checklist items render.
    await expect(page.getByText("Limitations on subcontracting within 50%")).toBeVisible();
    await expect(page.getByText("Pricing math reconciles")).toBeVisible();
    // The no-real-bid proof: the live-submission blockers are shown.
    const blockers = page.getByTestId("live-blockers");
    await expect(blockers).toContainText("Provisional rates in use");
    await expect(blockers).toContainText("SAM registration not active");
  } finally {
    await db.end();
  }
});

test("human walks counsel-review → ready, then SUBMIT is structurally blocked (Prime Directive)", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { solId, proposalId } = await seedDraftProposal(db, oid);
    const url = `/admin/solicitations/${solId}/proposal`;

    await loginAdmin(page);
    await page.goto(url);

    // 1) Record counsel review (DRAFT → COUNSEL_REVIEW).
    await page.getByRole("button", { name: "Record counsel review" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string; counsel: string | null }>(
          `SELECT status, counsel_reviewed_by AS counsel FROM proposals WHERE id = $1`,
          [proposalId],
        );
        return `${r.rows[0]?.status}:${r.rows[0]?.counsel ? "set" : "null"}`;
      })
      .toBe("COUNSEL_REVIEW:set");

    // 2) Mark ready (COUNSEL_REVIEW → READY_TO_SUBMIT).
    await page.goto(url);
    await page.getByRole("button", { name: "Mark ready to submit" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(`SELECT status FROM proposals WHERE id = $1`, [
          proposalId,
        ]);
        return r.rows[0]?.status;
      })
      .toBe("READY_TO_SUBMIT");

    // 3) Attempt to submit — STRUCTURALLY BLOCKED on the provisional baseline.
    await page.goto(url);
    await page.getByRole("button", { name: "Submit to agency" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM audit_log
             WHERE org_id = $1 AND action = 'BID_SUBMIT_BLOCKED' AND entity_id = $2`,
          [oid, proposalId],
        );
        return r.rows[0]?.n;
      })
      .toBe("1");

    // The proposal did NOT advance and no human submitter was recorded — no real bid left the building.
    const after = await db.query<{ status: string; submitted_by: string | null }>(
      `SELECT status, submitted_by FROM proposals WHERE id = $1`,
      [proposalId],
    );
    expect(after.rows[0]?.status).toBe("READY_TO_SUBMIT");
    expect(after.rows[0]?.submitted_by).toBeNull();
  } finally {
    await db.end();
  }
});
