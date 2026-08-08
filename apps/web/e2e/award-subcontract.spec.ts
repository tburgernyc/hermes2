/**
 * §3.1 end-to-end: recording a government award decision, cascading a subcontract record, drafting the
 * agreement, the admin review + explicit e-signature gates, and closing the vendor-side loop on loss.
 *
 * Inngest does NOT run in web-e2e (no event-bus consumer — same limitation documented in proposal.spec.ts),
 * so the hermes/solicitation.awarded cascade (packages/inngest draftSubcontract) cannot execute live here.
 * The cascade LOGIC itself is proven by the DB-backed suite in packages/inngest/test/logic.test.ts (real
 * Postgres, mocked AI) — 9 passing cases covering the happy path, idempotency, and every fail-closed branch.
 * Here we SEED the cascade's OUTPUT directly (owner DSN), exactly as PR H's proposal.spec.ts seeds a DRAFT
 * proposal rather than driving the blocked auto-draft path, then drive the REAL admin review/e-sign gates
 * in a real browser.
 *
 * The multi-quote loss cascade (§3.1 item 5), by contrast, IS driven live: selectQuote runs synchronously
 * inside the admin's own request (no Inngest involved), so clicking "Select winner" for real exercises the
 * loser-rejection + loss-notification-queueing code exactly as production would.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ADMIN_EMAIL, E2E_ORG_SLUG, E2E_VENDOR_EMAIL, E2E_VENDOR_PASSWORD } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("award-subcontract.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

interface Ctx {
  orgId: string;
  adminId: string;
  e2eVendorId: string; // the seeded, LOGGED-IN vendor (global-setup) — plays the LOSER in the cascade test
  e2eVendorEmail: string;
}

async function loadContext(): Promise<Ctx> {
  const db = pool();
  try {
    const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
    const orgId = org.rows[0]?.id;
    if (!orgId) throw new Error("award-subcontract.spec: e2e org not found (global-setup did not run?)");

    const admin = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [orgId, E2E_ADMIN_EMAIL],
    );
    const adminId = admin.rows[0]?.id;
    if (!adminId) throw new Error("award-subcontract.spec: e2e admin not found.");

    const vendor = await db.query<{ id: string; contact_email: string | null }>(
      `SELECT id, contact_email FROM vendors WHERE org_id = $1 AND company_name = 'E2E Vendor Co' LIMIT 1`,
      [orgId],
    );
    const e2eVendorId = vendor.rows[0]?.id;
    if (!e2eVendorId) throw new Error("award-subcontract.spec: seeded E2E vendor not found.");

    // global-setup.ts does not set a contact_email on the seeded vendor (it only needs one for the login
    // link, not for outreach) — the loss-notification cascade needs a resolvable email to queue against,
    // so ensure one deterministically (idempotent: only sets it if still unset).
    let e2eVendorEmail = vendor.rows[0]!.contact_email;
    if (!e2eVendorEmail) {
      e2eVendorEmail = "e2e-vendor-loser@example.test";
      await db.query(`UPDATE vendors SET contact_email = $1 WHERE id = $2 AND contact_email IS NULL`, [
        e2eVendorEmail,
        e2eVendorId,
      ]);
      const reread = await db.query<{ contact_email: string | null }>(
        `SELECT contact_email FROM vendors WHERE id = $1`,
        [e2eVendorId],
      );
      e2eVendorEmail = reread.rows[0]?.contact_email ?? e2eVendorEmail;
    }

    return { orgId, adminId, e2eVendorId, e2eVendorEmail };
  } finally {
    await db.end();
  }
}

async function loginVendor(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', E2E_VENDOR_EMAIL);
  await page.fill('input[name="password"]', E2E_VENDOR_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/portal$/);
}

test.describe("award-subcontract (§3.1)", () => {
  let ctx: Ctx;

  // Warm the cold-start window BEFORE any assertion (mirrors admin-console.spec.ts / proposal.spec.ts):
  // on a cold/contended runner, next-auth's unstable_update can intermittently fail to PERSIST the
  // refreshed session cookie after TOTP step-up — loginAdmin already retries with backoff, but priming a
  // throwaway login here means the per-test logins below run warm.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    ctx = await loadContext();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginAdmin(page, 24);
    } finally {
      await context.close();
    }
  });

  test("selecting a winner among multiple quotes rejects the losers, queues (never auto-sends) a loss notification, and the losing vendor sees an honest 'not selected' status", async ({
    page,
  }) => {
    const db = pool();
    let solId = "";
    let winnerQuoteId = "";
    let loserQuoteId = "";
    // Unique per test invocation (incl. retries) so the approvals-page card lookup below can disambiguate
    // this run's loss notification from any left over by a PREVIOUS retry attempt (retries do not roll
    // back committed DB state — a genuine cold-start TOTP retry can leave earlier queued notifications for
    // the same vendor email sitting in the DB).
    const solicitationTitle = `Multi-Quote RFQ ${randomUUID()}`;
    try {
      // A second vendor (not logged in) plays the WINNER; the E2E vendor (which CAN log in) plays the LOSER
      // so we can verify the honest portal status.
      const winnerVendor = await db.query<{ id: string }>(
        `INSERT INTO vendors (org_id, company_name, status, vetted_by, vetted_at)
         VALUES ($1, $2, 'VETTED', $3, now()) RETURNING id`,
        [ctx.orgId, `Winner Vendor ${randomUUID().slice(0, 8)}`, ctx.adminId],
      );
      const winnerVendorId = winnerVendor.rows[0]!.id;

      const sol = await db.query<{ id: string }>(
        `INSERT INTO solicitations
           (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
         VALUES ($1, $2, $3, 'FFP', 'PRICING_PENDING', $4, now()) RETURNING id`,
        [ctx.orgId, `AWD-${randomUUID().slice(0, 8)}`, solicitationTitle, ctx.adminId],
      );
      solId = sol.rows[0]!.id;

      const winnerQ = await db.query<{ id: string }>(
        `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status, total_price)
         VALUES ($1, $2, $3, 'SHORTLISTED', 50000) RETURNING id`,
        [ctx.orgId, solId, winnerVendorId],
      );
      winnerQuoteId = winnerQ.rows[0]!.id;
      const loserQ = await db.query<{ id: string }>(
        `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status, total_price)
         VALUES ($1, $2, $3, 'SHORTLISTED', 60000) RETURNING id`,
        [ctx.orgId, solId, ctx.e2eVendorId],
      );
      loserQuoteId = loserQ.rows[0]!.id;

      await loginAdmin(page);
      await page.goto(`/admin/solicitations/${solId}`);
      await expect(page.getByTestId(`quote-${winnerQuoteId}`)).toBeVisible();
      await expect(page.getByTestId(`quote-${loserQuoteId}`)).toBeVisible();

      await page.getByTestId(`quote-${winnerQuoteId}`).getByRole("button", { name: "Select winner" }).click();

      await expect
        .poll(async () => {
          const r = await db.query<{ status: string }>(`SELECT status FROM vendor_quotes WHERE id = $1`, [
            winnerQuoteId,
          ]);
          return r.rows[0]?.status;
        })
        .toBe("SELECTED");

      // The cascade: the loser flips to REJECTED in the SAME action — no separate step, no ambiguity.
      const loser = await db.query<{ status: string }>(`SELECT status FROM vendor_quotes WHERE id = $1`, [
        loserQuoteId,
      ]);
      expect(loser.rows[0]?.status).toBe("REJECTED");

      const rejectAudit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'QUOTE_REJECTED' AND entity_id = $2`,
        [ctx.orgId, loserQuoteId],
      );
      expect(rejectAudit.rowCount).toBe(1);

      // Queued, NOT sent — the outbound email is a separate, explicit approval (Prime Directive §2).
      const queued = await db.query<{ after: { to?: string } }>(
        `SELECT after FROM audit_log
           WHERE org_id = $1 AND action = 'LOSS_NOTIFICATION_QUEUED' AND entity_id = $2`,
        [ctx.orgId, loserQuoteId],
      );
      expect(queued.rowCount).toBe(1);
      expect(queued.rows[0]?.after?.to).toBe(ctx.e2eVendorEmail);
      const sentBefore = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'LOSS_NOTIFICATION_SENT' AND entity_id = $2`,
        [ctx.orgId, loserQuoteId],
      );
      expect(sentBefore.rowCount).toBe(0);
    } finally {
      await db.end();
    }

    // The losing vendor logs in and sees an HONEST outcome — not a frozen/ambiguous status.
    await loginVendor(page);
    await page.goto(`/portal/quotes/${loserQuoteId}`);
    await expect(page.getByTestId("quote-status")).toContainText("Rejected");
    await expect(page.getByTestId("quote-outcome-message")).toContainText("not selected");

    // Admin approves + sends the queued loss notification from /admin/approvals. Scope by BOTH the vendor
    // email and this run's unique solicitation title — the vendor email alone is not unique across retries
    // (a documented cold-start TOTP retry can leave an earlier attempt's queued notification uncleaned).
    const adminPage = page;
    await loginAdmin(adminPage);
    await adminPage.goto("/admin/approvals");
    const card = adminPage
      .locator("li")
      .filter({ hasText: ctx.e2eVendorEmail })
      .filter({ hasText: solicitationTitle });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Approve & send" }).click();

    // No RESEND_API_KEY is configured in any test environment (local e2e or CI's web-e2e job), so the
    // actual Resend delivery cannot succeed here — the decisive proof for THIS unit is that the click
    // reaches a REAL terminal outcome (SENT, or a gracefully-audited FAILED) and never crashes the action
    // or falls through to a silent no-op. The admin console keeps rendering either way (no error page).
    const db2 = pool();
    try {
      await expect
        .poll(async () => {
          const r = await db2.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM audit_log
               WHERE org_id = $1 AND entity_id = $2
                 AND action IN ('LOSS_NOTIFICATION_SENT', 'LOSS_NOTIFICATION_SEND_FAILED')`,
            [ctx.orgId, loserQuoteId],
          );
          return r.rows[0]?.n;
        })
        .toBe("1");
      await expect(adminPage.getByRole("heading", { name: "Approvals" })).toBeVisible();
    } finally {
      await db2.end();
    }
  });

  test("recording a government AWARD flips the solicitation + proposal, then the admin reviews the cascaded subcontract before e-signature can start", async ({
    page,
  }) => {
    const db = pool();
    let solId = "";
    let contractId = "";
    const winnerVendorName = `Awarded Vendor ${randomUUID().slice(0, 8)}`;
    try {
      const winnerVendor = await db.query<{ id: string }>(
        `INSERT INTO vendors (org_id, company_name, status, vetted_by, vetted_at, small_business_status)
         VALUES ($1, $2, 'VETTED', $3, now(), 'SMALL') RETURNING id`,
        [ctx.orgId, winnerVendorName, ctx.adminId],
      );
      const winnerVendorId = winnerVendor.rows[0]!.id;

      const sol = await db.query<{ id: string }>(
        `INSERT INTO solicitations
           (org_id, notice_id, title, status, contract_type, sourcing_approved_by, sourcing_approved_at, scope_text)
         VALUES ($1, $2, $3, 'SUBMITTED', 'FFP', $4, now(), 'Provide IT support services.') RETURNING id`,
        [ctx.orgId, `AWD2-${randomUUID().slice(0, 8)}`, `Award Solicitation ${randomUUID().slice(0, 8)}`, ctx.adminId],
      );
      solId = sol.rows[0]!.id;

      const quote = await db.query<{ id: string }>(
        `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, status, total_price)
         VALUES ($1, $2, $3, 'SELECTED', 15000) RETURNING id`,
        [ctx.orgId, solId, winnerVendorId],
      );
      const quoteId = quote.rows[0]!.id;
      await db.query(
        `INSERT INTO vendor_quote_line_items
           (org_id, quote_id, cost_type, contract_type, description, quantity, unit_rate, extended_amount)
         VALUES ($1, $2, 'LABOR', 'FFP', 'Senior engineer', 100, 150, 15000)`,
        [ctx.orgId, quoteId],
      );

      // The honest precondition: a genuinely SUBMITTED proposal with the SELECTED quote already recorded
      // (proposals_submit_requires_human/counsel CHECKs are satisfied — mirrors proposal.spec.ts's seed).
      await db.query(
        `INSERT INTO proposals
           (org_id, solicitation_id, selected_quote_id, contract_type, status, submitted_by, submitted_at,
            counsel_reviewed_by, counsel_reviewed_at)
         VALUES ($1, $2, $3, 'FFP', 'SUBMITTED', $4, now(), $4, now())`,
        [ctx.orgId, solId, quoteId, ctx.adminId],
      );

      await loginAdmin(page);
      await page.goto(`/admin/solicitations/${solId}`);
      await page.selectOption('select[name="outcome"]', "AWARDED");
      await page.fill('input[name="awardedPiid"]', "W12345-26-C-0001");
      await page.fill('input[name="awardedValue"]', "15000");
      await page.fill('input[name="awardDate"]', "2026-07-15");
      await page.fill('input[name="coContactEmail"]', "co@example.mil");
      await page.getByRole("button", { name: "Record outcome" }).click();

      await expect
        .poll(async () => {
          const r = await db.query<{ status: string; recorded_by: string | null }>(
            `SELECT status, outcome_recorded_by AS recorded_by FROM solicitations WHERE id = $1`,
            [solId],
          );
          return `${r.rows[0]?.status}:${r.rows[0]?.recorded_by ? "set" : "null"}`;
        })
        .toBe("AWARDED:set");

      const solAfter = await db.query<{ awarded_piid: string | null; awarded_value: string | null }>(
        `SELECT awarded_piid, awarded_value FROM solicitations WHERE id = $1`,
        [solId],
      );
      expect(solAfter.rows[0]?.awarded_piid).toBe("W12345-26-C-0001");
      expect(Number(solAfter.rows[0]?.awarded_value)).toBe(15000);

      const propAfter = await db.query<{ status: string }>(
        `SELECT status FROM proposals WHERE solicitation_id = $1`,
        [solId],
      );
      expect(propAfter.rows[0]?.status).toBe("WON");

      // Inngest does not run in web-e2e (module header) — seed the cascade's OUTPUT directly so the
      // review/e-sign surface has something real to render. The cascade LOGIC is proven in
      // packages/inngest/test/logic.test.ts (draftSubcontract, DB-backed, 9 passing cases).
      const contract = await db.query<{ id: string }>(
        `INSERT INTO contracts
           (org_id, solicitation_id, proposal_id, awarded_vendor_id, contract_type, total_value,
            status, esign_status, accelerated_payments)
         SELECT $1, $2, p.id, $3, 'FFP', 15000, 'PENDING_SIGNATURE', 'NOT_STARTED', true
         FROM proposals p WHERE p.solicitation_id = $2
         RETURNING id`,
        [ctx.orgId, solId, winnerVendorId],
      );
      contractId = contract.rows[0]!.id;
      await db.query(
        `INSERT INTO contract_milestones (org_id, contract_id, sequence, description, amount, status)
         VALUES ($1, $2, 1, 'LABOR: Senior engineer', 15000, 'PENDING')`,
        [ctx.orgId, contractId],
      );
      const draftText = `SUBCONTRACT AGREEMENT (DRAFT)\nSubcontractor: ${winnerVendorName}\nScope of Work section here.`;
      await db.query(
        `INSERT INTO documents (org_id, entity_type, contract_id, kind, storage_key, content_type, byte_size, sha256, magic_byte_validated)
         VALUES ($1, 'CONTRACT', $2, 'SUBCONTRACT_DRAFT', $3, 'text/markdown', $4, $5, true)`,
        [
          ctx.orgId,
          contractId,
          `orgs/${ctx.orgId}/contracts/${contractId}/documents/seed.md`,
          Buffer.byteLength(draftText),
          "0".repeat(64), // a syntactically-valid placeholder sha256 — content authenticity isn't under test here
        ],
      );
      // Storage-driver-agnostic: the app's runtime uses STORAGE_DRIVER=memory in e2e (playwright.config),
      // so write the same bytes through the app's own storage module via a tiny helper page is overkill —
      // instead, PUT the bytes through the identical in-memory driver by hitting the review page once the
      // key exists in the documents row is not enough on its own (memory store is per-process); to keep
      // this deterministic we store the object via a direct import in a Node script is out of scope for a
      // Playwright test file, so we accept the app will show "could not be loaded" for THIS seeded document
      // and assert on the milestones + gating instead, which do not depend on object-storage content.

      // The outcome summary + subcontract-review link render on the solicitation detail page.
      await page.goto(`/admin/solicitations/${solId}`);
      await expect(page.getByText("Review the subcontract agreement")).toBeVisible();

      await page.goto(`/admin/solicitations/${solId}/subcontract`);
      await expect(page.getByTestId("milestones-table")).toContainText("Senior engineer");
      await expect(page.getByTestId("milestones-table")).toContainText("$15,000.00");
      // Not yet reviewed: no "Start e-signature" button, esign stays NOT_STARTED.
      await expect(page.getByTestId("start-esign-button")).toHaveCount(0);
      await expect(page.getByText("Confirm review above before e-signature can start.")).toBeVisible();

      const esignBefore = await db.query<{ esign_status: string; reviewed_by: string | null }>(
        `SELECT esign_status, agreement_reviewed_by AS reviewed_by FROM contracts WHERE id = $1`,
        [contractId],
      );
      expect(esignBefore.rows[0]?.esign_status).toBe("NOT_STARTED");
      expect(esignBefore.rows[0]?.reviewed_by).toBeNull();
    } finally {
      await db.end();
    }

    // Confirm review. The page renders this form unconditionally while the agreement is unreviewed (it
    // shows a "could not be loaded" note and an EMPTY textarea when the seeded object isn't in the
    // per-process memory store), so the control is always there — assert it with the AUTO-RETRYING
    // expect() rather than a bare isVisible(). /admin is behind a route-level Suspense boundary
    // (app/admin/(console)/loading.tsx), so an instantaneous isVisible() right after goto() reads false
    // while the fallback is still on screen and would silently SKIP the review-confirm click — turning a
    // real assertion into a no-op and failing later on `agreement_reviewed_by`.
    await page.goto(`/admin/solicitations/${solId}/subcontract`);
    const textarea = page.getByTestId("subcontract-draft-textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("SUBCONTRACT AGREEMENT (DRAFT)\nReviewed and confirmed by the admin.");
    await page.getByRole("button", { name: "Confirm review" }).click();

    const db3 = pool();
    try {
      await expect
        .poll(async () => {
          const r = await db3.query<{ reviewed_by: string | null }>(
            `SELECT agreement_reviewed_by AS reviewed_by FROM contracts WHERE id = $1`,
            [contractId],
          );
          return r.rows[0]?.reviewed_by ? "set" : "null";
        })
        .toBe("set");

      // e-signature is STILL NOT_STARTED — review alone never starts it (a separate, explicit action does).
      const afterReview = await db3.query<{ esign_status: string }>(
        `SELECT esign_status FROM contracts WHERE id = $1`,
        [contractId],
      );
      expect(afterReview.rows[0]?.esign_status).toBe("NOT_STARTED");
    } finally {
      await db3.end();
    }

    // Now the "Start e-signature" button appears (review is confirmed) — a SEPARATE explicit click.
    await page.goto(`/admin/solicitations/${solId}/subcontract`);
    await expect(page.getByTestId("start-esign-button")).toBeVisible();
    await page.getByTestId("start-esign-button").click();

    const db4 = pool();
    try {
      await expect
        .poll(async () => {
          const r = await db4.query<{ esign_status: string }>(
            `SELECT esign_status FROM contracts WHERE id = $1`,
            [contractId],
          );
          return r.rows[0]?.esign_status;
        })
        .toBe("SENT");

      const esignAudit = await db4.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'CONTRACT_ESIGN_STARTED' AND entity_id = $2`,
        [ctx.orgId, contractId],
      );
      expect(esignAudit.rowCount).toBe(1);
    } finally {
      await db4.end();
    }
  });

  // §3.2 baseline audit: contract_status ACTIVE/COMPLETED/CLOSED_OUT and esign_status SIGNED/EXPIRED had
  // ZERO writers — a contract cascaded from an award sat at PENDING_SIGNATURE/NOT_STARTED forever, and
  // contract_milestones rows sat at PENDING forever (no UPDATE anywhere). This drives the full post-award
  // lifecycle: an admin resolving a SENT e-signature (expired → resent → signed), activating the contract,
  // advancing a milestone PENDING → IN_PROGRESS → COMPLETED, then completing and closing out the contract.
  test("admin resolves e-signature, activates the contract, advances a milestone, then completes and closes it out", async ({
    page,
  }) => {
    const db = pool();
    let solId = "";
    let contractId = "";
    let milestoneId = "";
    try {
      const vendor = await db.query<{ id: string }>(
        `INSERT INTO vendors (org_id, company_name, status, vetted_by, vetted_at)
         VALUES ($1, $2, 'VETTED', $3, now()) RETURNING id`,
        [ctx.orgId, `Lifecycle Vendor ${randomUUID().slice(0, 8)}`, ctx.adminId],
      );
      const vendorId = vendor.rows[0]!.id;

      // AWARDED sits inside BOTH live human-gate CHECKs — `solicitations_sourcing_gate` and
      // `solicitations_outcome_gate` — so the row MUST carry the sourcing approver AND the outcome
      // recorder (with timestamps) or the insert is rejected (23514). That is also the honest fixture:
      // this test starts AFTER a human approved sourcing and recorded the award (§3.1).
      const sol = await db.query<{ id: string }>(
        `INSERT INTO solicitations
           (org_id, notice_id, title, contract_type, status,
            sourcing_approved_by, sourcing_approved_at, outcome_recorded_by, outcome_recorded_at)
         VALUES ($1, $2, $3, 'FFP', 'AWARDED', $4, now(), $4, now()) RETURNING id`,
        [
          ctx.orgId,
          `LC-${randomUUID().slice(0, 8)}`,
          `Lifecycle Solicitation ${randomUUID().slice(0, 8)}`,
          ctx.adminId,
        ],
      );
      solId = sol.rows[0]!.id;

      // Seed a contract as if draftSubcontract had already cascaded it AND the admin had already
      // confirmed review + sent it for signature (SENT) — this test drives everything past that point.
      const contract = await db.query<{ id: string }>(
        `INSERT INTO contracts
           (org_id, solicitation_id, awarded_vendor_id, contract_type, total_value, status, esign_status,
            agreement_reviewed_by, agreement_reviewed_at)
         VALUES ($1, $2, $3, 'FFP', 25000, 'PENDING_SIGNATURE', 'SENT', $4, now())
         RETURNING id`,
        [ctx.orgId, solId, vendorId, ctx.adminId],
      );
      contractId = contract.rows[0]!.id;
      const milestone = await db.query<{ id: string }>(
        `INSERT INTO contract_milestones (org_id, contract_id, sequence, description, amount, status)
         VALUES ($1, $2, 1, 'Phase 1 deliverable', 25000, 'PENDING') RETURNING id`,
        [ctx.orgId, contractId],
      );
      milestoneId = milestone.rows[0]!.id;

      await loginAdmin(page);
      const url = `/admin/solicitations/${solId}/subcontract`;
      await page.goto(url);

      // esign_status SENT → the resolve buttons are offered; record EXPIRED first (an admin observation).
      await page.getByRole("button", { name: "Record expired" }).click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(`SELECT esign_status AS v FROM contracts WHERE id = $1`, [
            contractId,
          ]);
          return r.rows[0]?.v;
        })
        .toBe("EXPIRED");
      const expiredAudit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'CONTRACT_ESIGN_EXPIRED' AND entity_id = $2`,
        [ctx.orgId, contractId],
      );
      expect(expiredAudit.rowCount).toBe(1);

      // EXPIRED can be explicitly resent (an admin retry, not automatic) — "Resend e-signature" reuses startEsign.
      await page.goto(url);
      await page.getByRole("button", { name: "Resend e-signature" }).click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(`SELECT esign_status AS v FROM contracts WHERE id = $1`, [
            contractId,
          ]);
          return r.rows[0]?.v;
        })
        .toBe("SENT");

      // Now record SIGNED (the countersigned agreement came back).
      await page.goto(url);
      await page.getByRole("button", { name: "Record signed" }).click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(`SELECT esign_status AS v FROM contracts WHERE id = $1`, [
            contractId,
          ]);
          return r.rows[0]?.v;
        })
        .toBe("SIGNED");
      const signedAudit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'CONTRACT_ESIGN_SIGNED' AND entity_id = $2`,
        [ctx.orgId, contractId],
      );
      expect(signedAudit.rowCount).toBe(1);

      // SIGNED unlocks "Activate contract" (contract_status ACTIVE naturally follows a recorded signature).
      await page.goto(url);
      await expect(page.getByTestId("activate-contract-button")).toBeVisible();
      await page.getByTestId("activate-contract-button").click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(`SELECT status AS v FROM contracts WHERE id = $1`, [
            contractId,
          ]);
          return r.rows[0]?.v;
        })
        .toBe("ACTIVE");
      const activatedAudit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'CONTRACT_ACTIVATED' AND entity_id = $2`,
        [ctx.orgId, contractId],
      );
      expect(activatedAudit.rowCount).toBe(1);

      // Milestone: PENDING → IN_PROGRESS → COMPLETED.
      await page.goto(url);
      await page.getByTestId(`milestone-${milestoneId}`).getByRole("button", { name: "Start" }).click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(
            `SELECT status AS v FROM contract_milestones WHERE id = $1`,
            [milestoneId],
          );
          return r.rows[0]?.v;
        })
        .toBe("IN_PROGRESS");
      const startedAudit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'MILESTONE_STARTED' AND entity_id = $2`,
        [ctx.orgId, milestoneId],
      );
      expect(startedAudit.rowCount).toBe(1);

      await page.goto(url);
      await page.getByTestId(`milestone-${milestoneId}`).getByRole("button", { name: "Complete" }).click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(
            `SELECT status AS v FROM contract_milestones WHERE id = $1`,
            [milestoneId],
          );
          return r.rows[0]?.v;
        })
        .toBe("COMPLETED");
      const milestoneCompletedAudit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'MILESTONE_COMPLETED' AND entity_id = $2`,
        [ctx.orgId, milestoneId],
      );
      expect(milestoneCompletedAudit.rowCount).toBe(1);
      // The finance-flow explanation renders — INVOICED/PAID are deliberately never written here.
      await expect(page.getByText(/driven by the §3.3 accounts-receivable flow/)).toBeVisible();

      // Contract: ACTIVE → COMPLETED → CLOSED_OUT.
      await page.goto(url);
      await page.getByRole("button", { name: "Mark completed" }).click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(`SELECT status AS v FROM contracts WHERE id = $1`, [
            contractId,
          ]);
          return r.rows[0]?.v;
        })
        .toBe("COMPLETED");

      await page.goto(url);
      await page.getByRole("button", { name: "Close out" }).click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(`SELECT status AS v FROM contracts WHERE id = $1`, [
            contractId,
          ]);
          return r.rows[0]?.v;
        })
        .toBe("CLOSED_OUT");
      const closedOutAudit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'CONTRACT_CLOSED_OUT' AND entity_id = $2`,
        [ctx.orgId, contractId],
      );
      expect(closedOutAudit.rowCount).toBe(1);

      // Terminal: no lifecycle buttons remain on a CLOSED_OUT contract.
      await page.goto(url);
      await expect(page.getByRole("button", { name: "Mark completed" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Close out" })).toHaveCount(0);
      await expect(page.getByTestId("terminate-contract-button")).toHaveCount(0);
    } finally {
      await db.end();
    }
  });

  // TERMINATED must be reachable independently of the happy path (a deliberate admin decision at any
  // non-terminal point, not inferred from anything else advancing).
  test("admin terminates a contract before signature — a deliberate decision, never inferred", async ({
    page,
  }) => {
    const db = pool();
    try {
      const vendor = await db.query<{ id: string }>(
        `INSERT INTO vendors (org_id, company_name, status, vetted_by, vetted_at)
         VALUES ($1, $2, 'VETTED', $3, now()) RETURNING id`,
        [ctx.orgId, `Terminate Vendor ${randomUUID().slice(0, 8)}`, ctx.adminId],
      );
      const vendorId = vendor.rows[0]!.id;
      // AWARDED sits inside BOTH live human-gate CHECKs (sourcing + outcome), so both approver/recorder
      // pairs are mandatory (23514 otherwise) — and honest: a human did both (§3.1).
      const sol = await db.query<{ id: string }>(
        `INSERT INTO solicitations
           (org_id, notice_id, title, contract_type, status,
            sourcing_approved_by, sourcing_approved_at, outcome_recorded_by, outcome_recorded_at)
         VALUES ($1, $2, $3, 'FFP', 'AWARDED', $4, now(), $4, now()) RETURNING id`,
        [
          ctx.orgId,
          `TERM-${randomUUID().slice(0, 8)}`,
          `Terminate Solicitation ${randomUUID().slice(0, 8)}`,
          ctx.adminId,
        ],
      );
      const solId = sol.rows[0]!.id;
      const contract = await db.query<{ id: string }>(
        `INSERT INTO contracts (org_id, solicitation_id, awarded_vendor_id, contract_type, total_value, status, esign_status)
         VALUES ($1, $2, $3, 'FFP', 5000, 'PENDING_SIGNATURE', 'NOT_STARTED') RETURNING id`,
        [ctx.orgId, solId, vendorId],
      );
      const contractId = contract.rows[0]!.id;

      await loginAdmin(page);
      await page.goto(`/admin/solicitations/${solId}/subcontract`);
      await page.getByTestId("terminate-contract-button").click();
      await expect
        .poll(async () => {
          const r = await db.query<{ v: string }>(`SELECT status AS v FROM contracts WHERE id = $1`, [
            contractId,
          ]);
          return r.rows[0]?.v;
        })
        .toBe("TERMINATED");
      const audit = await db.query(
        `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'CONTRACT_TERMINATED' AND entity_id = $2`,
        [ctx.orgId, contractId],
      );
      expect(audit.rowCount).toBe(1);

      // Terminal — no lifecycle buttons remain.
      await page.goto(`/admin/solicitations/${solId}/subcontract`);
      await expect(page.getByTestId("terminate-contract-button")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Activate contract" })).toHaveCount(0);
    } finally {
      await db.end();
    }
  });
});
