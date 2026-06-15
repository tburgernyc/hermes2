/**
 * Tokenized public-submission e2e (Phase 5 §B5). Drives a real browser through /quote/[token] and
 * /optout/[token] with a server-minted token, then asserts the §7 trust boundary held in the DB:
 *   • the quote is prospect-scoped (vendor_id NULL) — a token can never become a vetted vendor;
 *   • the document is VENDOR_PROSPECT + magic-byte validated;
 *   • a TOKEN audit row was appended;
 *   • a replayed token is rejected (duplicate);
 *   • opt-out flips the prospect to OPTED_OUT.
 * The app under test connects with the owner DSN, but withTokenRole SET LOCAL ROLE hermes_token, so the
 * RESTRICTIVE token RLS policies genuinely apply during these writes. Storage uses the memory driver.
 */
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { mintToken } from "@hermes/core";

import { E2E_ORG_SLUG } from "./fixtures";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("quote.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

/** Minimal but valid-by-magic-bytes PDF payload. */
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

interface Seed {
  orgId: string;
  prospectId: string;
  solicitationId: string;
}

/** Seed a fresh prospect + solicitation in the e2e org (owner connection; RLS-exempt seed). */
async function seed(): Promise<Seed> {
  const db = pool();
  try {
    const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
    const orgId = org.rows[0]?.id;
    if (!orgId) throw new Error("quote.spec: e2e org not found (global-setup did not run?)");

    const sol = await db.query<{ id: string }>(
      `INSERT INTO solicitations (org_id, notice_id, title, contract_type, status)
       VALUES ($1, $2, 'E2E Quote Solicitation', 'FFP'::contract_type, 'TRIAGE_COMPLETE'::solicitation_status)
       RETURNING id`,
      [orgId, `E2E-${randomUUID()}`],
    );
    const prospect = await db.query<{ id: string }>(
      `INSERT INTO vendor_prospects (org_id, company_name, contact_email)
       VALUES ($1, 'E2E Prospect', $2) RETURNING id`,
      [orgId, `prospect-${randomUUID()}@e2e.test`],
    );
    return { orgId, prospectId: prospect.rows[0]!.id, solicitationId: sol.rows[0]!.id };
  } finally {
    await db.end();
  }
}

test("tokenized quote submission writes a prospect-scoped quote + doc + audit, and blocks replay", async ({
  page,
}) => {
  const { orgId, prospectId, solicitationId } = await seed();
  const token = mintToken({ purpose: "QUOTE_SUBMISSION", orgId, prospectId, solicitationId });

  await page.goto(`/quote/${token}`);
  await expect(page.getByRole("heading", { name: "Submit a quote" })).toBeVisible();

  await page.fill('input[name="description_0"]', "Senior engineer, base year");
  await page.fill('input[name="quantity_0"]', "100");
  await page.fill('input[name="unitRate_0"]', "150");
  await page.setInputFiles('input[name="file"]', {
    name: "quote.pdf",
    mimeType: "application/pdf",
    buffer: PDF_BYTES,
  });
  await page.click('button[type="submit"]');

  await page.waitForURL(/status=submitted/);
  await expect(page.getByRole("heading", { name: /Quote received/ })).toBeVisible();

  // Assert the boundary held in the DB.
  const db = pool();
  try {
    const quote = await db.query<{ id: string; vendor_id: string | null; status: string }>(
      `SELECT id, vendor_id, status FROM vendor_quotes WHERE org_id = $1 AND prospect_id = $2`,
      [orgId, prospectId],
    );
    expect(quote.rowCount).toBe(1);
    expect(quote.rows[0]!.vendor_id).toBeNull(); // the structural trust boundary
    expect(quote.rows[0]!.status).toBe("SUBMITTED");
    const quoteId = quote.rows[0]!.id;

    const lineItems = await db.query(
      `SELECT 1 FROM vendor_quote_line_items WHERE org_id = $1 AND quote_id = $2`,
      [orgId, quoteId],
    );
    expect(lineItems.rowCount).toBe(1);

    const doc = await db.query<{ entity_type: string; kind: string; magic_byte_validated: boolean }>(
      `SELECT entity_type, kind, magic_byte_validated FROM documents
       WHERE org_id = $1 AND prospect_id = $2`,
      [orgId, prospectId],
    );
    expect(doc.rowCount).toBe(1);
    expect(doc.rows[0]!.entity_type).toBe("VENDOR_PROSPECT");
    expect(doc.rows[0]!.kind).toBe("QUOTE");
    expect(doc.rows[0]!.magic_byte_validated).toBe(true);

    const audit = await db.query(
      `SELECT 1 FROM audit_log
       WHERE org_id = $1 AND actor_type = 'TOKEN' AND action = 'QUOTE_SUBMITTED' AND entity_id = $2`,
      [orgId, quoteId],
    );
    expect(audit.rowCount).toBe(1);
  } finally {
    await db.end();
  }

  // Replay the SAME token: the (org_id, token_jti) unique index rejects it → duplicate status.
  await page.goto(`/quote/${token}`);
  await page.fill('input[name="description_0"]', "Replay attempt");
  await page.fill('input[name="quantity_0"]', "1");
  await page.fill('input[name="unitRate_0"]', "1");
  await page.setInputFiles('input[name="file"]', {
    name: "quote.pdf",
    mimeType: "application/pdf",
    buffer: PDF_BYTES,
  });
  await page.click('button[type="submit"]');
  await page.waitForURL(/status=duplicate/);

  const after = pool();
  try {
    const count = await after.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM vendor_quotes WHERE org_id = $1 AND prospect_id = $2`,
      [orgId, prospectId],
    );
    expect(count.rows[0]!.n).toBe("1"); // still exactly one — the replay wrote nothing
  } finally {
    await after.end();
  }
});

test("opt-out token flips the prospect to OPTED_OUT", async ({ page }) => {
  const { orgId, prospectId } = await seed();
  const token = mintToken({ purpose: "OPT_OUT", orgId, prospectId });

  await page.goto(`/optout/${token}`);
  await page.click('button[type="submit"]');
  await page.waitForURL(/status=done/);
  await expect(page.getByRole("heading", { name: /opted out/i })).toBeVisible();

  const db = pool();
  try {
    const p = await db.query<{ status: string }>(
      `SELECT status FROM vendor_prospects WHERE org_id = $1 AND id = $2`,
      [orgId, prospectId],
    );
    expect(p.rows[0]!.status).toBe("OPTED_OUT");
  } finally {
    await db.end();
  }
});

test("a quote token is rejected on the opt-out route (purposes cannot cross)", async ({ page }) => {
  const { orgId, prospectId, solicitationId } = await seed();
  const quoteToken = mintToken({ purpose: "QUOTE_SUBMISSION", orgId, prospectId, solicitationId });

  // The opt-out page verifies OPT_OUT; a QUOTE_SUBMISSION token fails verification → invalid-link page.
  await page.goto(`/optout/${quoteToken}`);
  await expect(page.getByRole("heading", { name: /no longer valid/i })).toBeVisible();
});
