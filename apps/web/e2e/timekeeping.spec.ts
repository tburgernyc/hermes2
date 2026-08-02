/**
 * §3.5 end-to-end: a real timesheet entry, a correction to it (proving the audit trail — old/new/reason
 * preserved, never overwritten), and the admin approval action that makes a period final/billable.
 *
 * Everything here runs synchronously inside the admin's own request (no Inngest involved), so driving
 * the real UI exercises the real Server Actions exactly as production would — unlike award-subcontract's
 * cascade tests, there is no Inngest-only path to seed around here.
 */
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { todayIsoDate, weekPeriodBounds } from "@hermes/core";

import { E2E_ADMIN_EMAIL, E2E_ORG_SLUG } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("timekeeping.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

interface Ctx {
  orgId: string;
  adminId: string;
}

async function loadContext(): Promise<Ctx> {
  const db = pool();
  try {
    const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
    const orgId = org.rows[0]?.id;
    if (!orgId) throw new Error("timekeeping.spec: e2e org not found (global-setup did not run?)");

    const admin = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [orgId, E2E_ADMIN_EMAIL],
    );
    const adminId = admin.rows[0]?.id;
    if (!adminId) throw new Error("timekeeping.spec: e2e admin not found.");

    return { orgId, adminId };
  } finally {
    await db.end();
  }
}

test.describe("timekeeping (§3.5)", () => {
  let ctx: Ctx;

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

  test("log time charged to a contract/milestone, correct it once submitted (audit trail preserved), then approve the period", async ({
    page,
  }) => {
    const today = todayIsoDate();
    const { periodStart, periodEnd } = weekPeriodBounds(today);
    let contractId = "";
    let milestoneId = "";

    // Seed a contract + milestone to charge DIRECT hours against (the form reads these from the DB).
    // No solicitation link needed — the contract label falls back to "<type> contract <id>" when unset.
    const db = pool();
    try {
      const contract = await db.query<{ id: string }>(
        `INSERT INTO contracts (org_id, contract_type, status) VALUES ($1, 'TM', 'ACTIVE') RETURNING id`,
        [ctx.orgId],
      );
      contractId = contract.rows[0]!.id;
      const milestone = await db.query<{ id: string }>(
        `INSERT INTO contract_milestones (org_id, contract_id, sequence, description, amount)
         VALUES ($1, $2, 1, 'E2E milestone', '1000.00') RETURNING id`,
        [ctx.orgId, contractId],
      );
      milestoneId = milestone.rows[0]!.id;
    } finally {
      await db.end();
    }

    await loginAdmin(page);
    await page.goto("/admin/time");

    // --- Log a DIRECT entry charged to the contract + milestone, same-day. ---
    await page.getByTestId("entry-form").locator('input[name="workDate"]').fill(today);
    await page.getByTestId("entry-form").locator('input[name="hours"]').fill("8");
    await page.getByTestId("entry-form").locator('select[name="chargeClass"]').selectOption("DIRECT");
    await page.getByTestId("entry-form").locator('select[name="contractId"]').selectOption(contractId);
    await page.getByTestId("entry-form").locator('select[name="milestoneId"]').selectOption(milestoneId);
    await page.getByTestId("entry-form").locator('textarea[name="description"]').fill("Initial DCAA e2e work");
    await page.getByTestId("entry-form").getByRole("button", { name: "Log time" }).click();

    await expect(page.getByTestId("time-status")).toContainText("Time entry logged");

    const db2 = pool();
    let entryId = "";
    let periodId = "";
    try {
      const entryRow = await db2.query<{ id: string; hours: string; charge_class: string; contract_id: string; milestone_id: string; period_id: string }>(
        `SELECT id, hours, charge_class, contract_id, milestone_id, period_id FROM time_entries
           WHERE org_id = $1 AND user_id = $2 AND work_date = $3 ORDER BY created_at DESC LIMIT 1`,
        [ctx.orgId, ctx.adminId, today],
      );
      expect(entryRow.rowCount).toBe(1);
      const row = entryRow.rows[0]!;
      entryId = row.id;
      periodId = row.period_id;
      expect(Number(row.hours)).toBe(8);
      expect(row.charge_class).toBe("DIRECT");
      expect(row.contract_id).toBe(contractId);
      expect(row.milestone_id).toBe(milestoneId);

      // node-postgres parses `date` columns to JS Date (UTC midnight) — cast to text so the readback is
      // the same plain YYYY-MM-DD string weekPeriodBounds returns.
      const periodRow = await db2.query<{ period_start: string; period_end: string; status: string }>(
        `SELECT period_start::text, period_end::text, status FROM timesheet_periods WHERE id = $1`,
        [periodId],
      );
      expect(periodRow.rows[0]?.status).toBe("OPEN");
      expect(periodRow.rows[0]?.period_start).toBe(periodStart);
      expect(periodRow.rows[0]?.period_end).toBe(periodEnd);
    } finally {
      await db2.end();
    }

    // --- Submit the period (self-certification) — moves OPEN → SUBMITTED. ---
    await page.goto("/admin/time");
    const periodCard = page.getByTestId(`period-${periodId}`);
    await expect(periodCard).toBeVisible();
    await periodCard.getByRole("button", { name: "Submit period" }).click();
    await expect(page.getByTestId("time-status")).toContainText("Timesheet period submitted");

    const db3 = pool();
    try {
      const r = await db3.query<{ status: string; submitted_at: string | null }>(
        `SELECT status, submitted_at FROM timesheet_periods WHERE id = $1`,
        [periodId],
      );
      expect(r.rows[0]?.status).toBe("SUBMITTED");
      expect(r.rows[0]?.submitted_at).not.toBeNull();
    } finally {
      await db3.end();
    }

    // --- Once submitted, the entry row offers ONLY "Correct" — no Delete button reachable. ---
    await page.goto("/admin/time");
    const entryRowLoc = page.getByTestId(`entry-${entryId}`);
    await expect(entryRowLoc.getByRole("link", { name: "Correct" })).toBeVisible();
    await expect(entryRowLoc.getByRole("button", { name: "Delete" })).toHaveCount(0);

    // --- Correct it: change 8.00 → 6.50 with a required reason. The audit trail must preserve BOTH. ---
    await page.goto(`/admin/time/entries/${entryId}/correct`);
    await expect(page.getByTestId("not-correctable")).toHaveCount(0);
    await page.getByTestId("correction-form").locator('input[name="hours"]').fill("6.5");
    await page
      .getByTestId("correction-form")
      .locator('textarea[name="description"]')
      .fill("Corrected description of work performed");
    await page.getByTestId("correction-reason").fill("Entered wrong hours; should be 6.5, not 8.");
    await page.getByTestId("correction-form").getByRole("button", { name: "Save correction" }).click();

    await expect(page.getByTestId("time-status")).toContainText("Correction recorded");

    const db4 = pool();
    try {
      // The CURRENT row reflects the new value...
      const entryAfter = await db4.query<{ hours: string; description: string }>(
        `SELECT hours, description FROM time_entries WHERE id = $1`,
        [entryId],
      );
      expect(Number(entryAfter.rows[0]?.hours)).toBe(6.5);
      expect(entryAfter.rows[0]?.description).toBe("Corrected description of work performed");

      // ...but the ORIGINAL is preserved (not destroyed) in the append-only correction row, alongside
      // the new value, who made the change, and the required reason.
      const corrections = await db4.query<{
        id: string;
        old_values: { hours?: string };
        new_values: { hours?: string };
        reason: string;
        corrected_by: string;
      }>(
        `SELECT id, old_values, new_values, reason, corrected_by FROM time_entry_corrections WHERE time_entry_id = $1`,
        [entryId],
      );
      expect(corrections.rowCount).toBe(1);
      const corr = corrections.rows[0]!;
      expect(corr.old_values.hours).toBe("8.00");
      expect(corr.new_values.hours).toBe("6.50");
      expect(corr.reason).toBe("Entered wrong hours; should be 6.5, not 8.");
      expect(corr.corrected_by).toBe(ctx.adminId);

      // No silent in-place UPDATE path: the correction row is DB-enforced append-only (Phase A triggers
      // block even the OWNER connection, per migration 0003's header comment) — a direct UPDATE attempt
      // must fail, proving this action could not have taken any other write path even if it tried.
      await expect(
        db4.query(`UPDATE time_entry_corrections SET reason = 'rewritten' WHERE id = $1`, [corr.id]),
      ).rejects.toThrow(/append-only/i);
    } finally {
      await db4.end();
    }

    // --- The correction now shows in the UI's audit trail. ---
    await page.goto("/admin/time");
    await expect(page.getByTestId(`corrections-${entryId}`)).toContainText("1 correction");

    // --- Approve the now-SUBMITTED period (a SEPARATE, explicit admin click — CLAUDE.md §2). ---
    await page.goto("/admin/time/approvals");
    const pendingCard = page.getByTestId(`pending-period-${periodId}`);
    await expect(pendingCard).toBeVisible();
    await pendingCard.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("approvals-status")).toContainText("Period approved");

    const db5 = pool();
    try {
      const r = await db5.query<{ status: string; approved_by: string | null; approved_at: string | null }>(
        `SELECT status, approved_by, approved_at FROM timesheet_periods WHERE id = $1`,
        [periodId],
      );
      expect(r.rows[0]?.status).toBe("APPROVED");
      expect(r.rows[0]?.approved_by).toBe(ctx.adminId);
      expect(r.rows[0]?.approved_at).not.toBeNull();
    } finally {
      await db5.end();
    }
  });
});
