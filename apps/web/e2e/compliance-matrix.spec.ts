/**
 * §3.8.3 Section L/M compliance-matrix e2e. Mirrors proposal.spec.ts's seeding shape (Inngest doesn't run
 * in web-e2e, so the AI extraction itself is proven with a mocked model in packages/ai's engine.test.ts
 * and packages/inngest's DB-backed logic.test.ts — including as a real side effect of draftProposalBid).
 * Here we prove the DoD proof item directly: a real solicitation's Section L/M requirements, extracted
 * into a structured matrix, rendered right next to a drafted proposal on the real review surface.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ADMIN_EMAIL, E2E_ORG_SLUG } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("compliance-matrix.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

async function orgId(db: Pool): Promise<string> {
  const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
  const id = org.rows[0]?.id;
  if (!id) throw new Error("compliance-matrix.spec: e2e org not found (global-setup did not run?)");
  return id;
}

async function adminUserId(db: Pool, oid: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
    [oid, E2E_ADMIN_EMAIL],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("compliance-matrix.spec: e2e admin not found (global-setup did not run?)");
  return id;
}

const LM_MATRIX_JSON = JSON.stringify({
  sectionLFound: true,
  sectionMFound: true,
  items: [
    {
      reference: "Section L.3.1",
      category: "INSTRUCTIONS_TO_OFFERORS",
      requirement: "Submit a technical volume not to exceed 20 pages.",
      proposalSectionMapping: "Volume I — Technical",
    },
    {
      reference: "Section M.1",
      category: "EVALUATION_CRITERIA",
      requirement: "Technical approach is more important than price.",
    },
  ],
  notes: "Two-volume submission required.",
});

/** Seed a PROPOSAL_DRAFT solicitation (with an extracted L/M matrix) + a minimal DRAFT proposal. */
async function seedDraftProposalWithMatrix(
  db: Pool,
  oid: string,
): Promise<{ solId: string }> {
  const approver = await adminUserId(db, oid);
  const sol = await db.query<{ id: string }>(
    `INSERT INTO solicitations
       (org_id, notice_id, title, status, contract_type, sourcing_approved_by, sourcing_approved_at,
        scope_text, lm_compliance_matrix, lm_extracted_at, lm_extraction_model)
     VALUES ($1, $2, $3, 'PROPOSAL_DRAFT'::solicitation_status, 'FFP'::contract_type, $4, now(),
             'Section L: submit a technical volume. Section M: technical is more important than price.',
             $5::jsonb, now(), 'claude-sonnet-4-6')
     RETURNING id`,
    [oid, `E2E-LM-${randomUUID()}`, `L/M Matrix Solicitation ${randomUUID()}`, approver, LM_MATRIX_JSON],
  );
  const solId = sol.rows[0]!.id;
  await db.query(
    `INSERT INTO proposals
       (org_id, solicitation_id, contract_type, status, pricing_scenarios, compliance_checklist,
        government_payment_basis, total_cost_of_work, adequate_price_competition)
     VALUES ($1, $2, 'FFP'::contract_type, 'DRAFT'::proposal_status, '{}'::jsonb, '{}'::jsonb,
             130000, 118000, true)`,
    [oid, solId],
  );
  return { solId };
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

test("the Section L/M compliance matrix renders next to the drafted proposal", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const { solId } = await seedDraftProposalWithMatrix(db, oid);

    await loginAdmin(page);
    await page.goto(`/admin/solicitations/${solId}/proposal`);

    await expect(page.getByRole("heading", { name: "Bid decision-brief" })).toBeVisible();
    await expect(page.getByText("Section L/M compliance matrix")).toBeVisible();

    const table = page.getByTestId("lm-matrix-table");
    await expect(table).toBeVisible();
    await expect(table).toContainText("Section L.3.1");
    await expect(table).toContainText("Submit a technical volume not to exceed 20 pages.");
    await expect(table).toContainText("Volume I — Technical");
    await expect(table).toContainText("Section M.1");
    await expect(table).toContainText("Technical approach is more important than price.");

    const provenance = page.getByTestId("lm-matrix-provenance");
    await expect(provenance).toContainText("Section L found: yes");
    await expect(provenance).toContainText("Section M found: yes");
    await expect(provenance).toContainText("claude-sonnet-4-6");
  } finally {
    await db.end();
  }
});

test("an un-extracted solicitation shows a clean empty state (informative only — never blocks the review surface)", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const approver = await adminUserId(db, oid);
    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations
         (org_id, notice_id, title, status, contract_type, sourcing_approved_by, sourcing_approved_at, scope_text)
       VALUES ($1, $2, $3, 'PROPOSAL_DRAFT'::solicitation_status, 'FFP'::contract_type, $4, now(),
               'Provide IT support services.')
       RETURNING id`,
      [oid, `E2E-LM-NONE-${randomUUID()}`, `No Matrix Yet ${randomUUID()}`, approver],
    );
    const solId = sol.rows[0]!.id;
    await db.query(
      `INSERT INTO proposals
         (org_id, solicitation_id, contract_type, status, pricing_scenarios, compliance_checklist,
          government_payment_basis, total_cost_of_work, adequate_price_competition)
       VALUES ($1, $2, 'FFP'::contract_type, 'DRAFT'::proposal_status, '{}'::jsonb, '{}'::jsonb,
               130000, 118000, true)`,
      [oid, solId],
    );

    await loginAdmin(page);
    await page.goto(`/admin/solicitations/${solId}/proposal`);
    await expect(page.getByText("Section L/M compliance matrix")).toBeVisible();
    await expect(page.getByText("Not yet extracted.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Extract Section L/M requirements" })).toBeVisible();
  } finally {
    await db.end();
  }
});
