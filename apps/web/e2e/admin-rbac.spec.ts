/**
 * §3.6 granular admin RBAC e2e — the DEFINITION-OF-DONE proof item (§4 item 10): a non-FULL admin-role
 * user hitting /admin/settings is denied SERVER-SIDE (a real HTTP redirect the browser follows, driven by
 * middleware.ts + the page's own requireFullAdmin), never merely a hidden nav link. Drives a REAL browser
 * as the seeded CAPTURE-role admin fixture (password + live TOTP, same as every other admin e2e) — this is
 * not a unit test of the guard function, it is proof the deployed route actually refuses the request.
 *
 * Also covers the `updateAdminRole` WRITE path (previously untested beyond "the list renders"): a FULL
 * admin actually submitting the /admin/users form, read back directly from the DB (owner DSN, same
 * pattern as admin-console.spec.ts) — the resulting `users.admin_role` AND the `ADMIN_ROLE_UPDATED`
 * audit row, not just the page's own re-render.
 */
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import {
  E2E_CAPTURE_ADMIN_EMAIL,
  E2E_CAPTURE_ADMIN_PASSWORD,
  E2E_CAPTURE_ADMIN_TOTP_SECRET,
  E2E_ORG_SLUG,
} from "./fixtures";
import { loginAdmin, loginAdminAs } from "./admin-auth";

const CAPTURE_CREDS = {
  email: E2E_CAPTURE_ADMIN_EMAIL,
  password: E2E_CAPTURE_ADMIN_PASSWORD,
  totpSecret: E2E_CAPTURE_ADMIN_TOTP_SECRET,
};

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("admin-rbac.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

async function orgId(db: Pool): Promise<string> {
  const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
  const id = org.rows[0]?.id;
  if (!id) throw new Error("admin-rbac.spec: e2e org not found (global-setup did not run?)");
  return id;
}

async function captureAdminUserId(db: Pool, oid: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE org_id = $1 AND lower(email) = lower($2) LIMIT 1`,
    [oid, E2E_CAPTURE_ADMIN_EMAIL],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error("admin-rbac.spec: CAPTURE admin fixture not found");
  return id;
}

async function adminRole(db: Pool, userId: string): Promise<string | null> {
  const r = await db.query<{ admin_role: string | null }>(`SELECT admin_role FROM users WHERE id = $1`, [
    userId,
  ]);
  return r.rows[0]?.admin_role ?? null;
}

// Warm the standalone server's cold-start window (see admin-auth.ts / admin-console.spec.ts note) — this
// spec runs its own warmup so it is correct standalone, regardless of file execution order.
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

test("a CAPTURE-role admin hitting /admin/settings is redirected away server-side, not just hidden from nav", async ({
  page,
}) => {
  await loginAdminAs(page, CAPTURE_CREDS);

  // The nav omits the Settings link for a CAPTURE admin (UX courtesy — see layout.tsx) …
  await page.goto("/admin");
  await expect(page.getByTestId("admin-nav").getByRole("link", { name: "Settings" })).toHaveCount(0);

  // … but the real proof is navigating STRAIGHT to the URL: middleware refuses it before the settings
  // page ever renders. Assert the browser actually left /admin/settings (a real redirect, not a client
  // route guard) and landed back on the dashboard with a visible, non-generic denial.
  await page.goto("/admin/settings");
  await page.waitForURL((url) => url.pathname !== "/admin/settings");
  expect(new URL(page.url()).pathname).toBe("/admin");
  await expect(page.getByTestId("admin-denied-banner")).toBeVisible();
  await expect(page.getByTestId("admin-denied-banner")).toContainText("settings");

  // The settings form itself never rendered (not present anywhere on the landing page it bounced to).
  await expect(page.locator('input[name="uei"]')).toHaveCount(0);
});

test("a CAPTURE-role admin hitting /admin/users (the admin-role-assignment surface) is also redirected server-side", async ({
  page,
}) => {
  await loginAdminAs(page, CAPTURE_CREDS);
  await page.goto("/admin/users");
  await page.waitForURL((url) => url.pathname !== "/admin/users");
  expect(new URL(page.url()).pathname).toBe("/admin");
  await expect(page.getByTestId("admin-denied-banner")).toBeVisible();
});

test("a CAPTURE-role admin CAN still reach its own domain (solicitations) — the guard is scoped, not blanket", async ({
  page,
}) => {
  await loginAdminAs(page, CAPTURE_CREDS);
  await page.goto("/admin/solicitations");
  expect(new URL(page.url()).pathname).toBe("/admin/solicitations");
  await expect(page.getByRole("heading", { name: "Solicitations" })).toBeVisible();
});

test("a FULL admin can open /admin/users and see the CAPTURE fixture listed with its assigned level", async ({
  page,
}) => {
  await loginAdmin(page);
  await page.goto("/admin/users");
  expect(new URL(page.url()).pathname).toBe("/admin/users");
  await expect(page.getByTestId("admin-users-list")).toContainText(E2E_CAPTURE_ADMIN_EMAIL);
  await expect(page.getByTestId("admin-users-list")).toContainText("CAPTURE");
});

test("a FULL admin's updateAdminRole submit actually writes admin_role + an ADMIN_ROLE_UPDATED audit row, not just the page render", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const targetId = await captureAdminUserId(db, oid);

    // Precondition matches the fixture every other test in this file assumes.
    expect(await adminRole(db, targetId)).toBe("CAPTURE");

    await loginAdmin(page);
    await page.goto("/admin/users");

    const row = page.getByTestId(`admin-user-${targetId}`);
    await expect(row).toContainText("CAPTURE");

    await row.getByLabel("Access level").selectOption("FINANCE");
    await row.getByRole("button", { name: "Save" }).click();

    // The DB write is the authoritative proof (not the page's own re-render, which could lag or lie).
    await expect
      .poll(() => adminRole(db, targetId), { message: "users.admin_role did not become FINANCE" })
      .toBe("FINANCE");
    await expect(row).toContainText("FINANCE");

    const audit = await db.query<{ before: { adminRole: string | null }; after: { adminRole: string } }>(
      `SELECT before, after FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND action = 'ADMIN_ROLE_UPDATED'
         AND entity_type = 'users' AND entity_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [oid, targetId],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0]?.before).toEqual({ adminRole: "CAPTURE" });
    expect(audit.rows[0]?.after).toEqual({ adminRole: "FINANCE" });

    // Restore the fixture to CAPTURE — this test must be side-effect-free across the suite (every other
    // test/spec that reads this fixture, and any re-run of this file, expects it to start at CAPTURE).
    await row.getByLabel("Access level").selectOption("CAPTURE");
    await row.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(() => adminRole(db, targetId), { message: "users.admin_role did not revert to CAPTURE" })
      .toBe("CAPTURE");

    const revertAudit = await db.query<{ before: { adminRole: string }; after: { adminRole: string } }>(
      `SELECT before, after FROM audit_log
       WHERE org_id = $1 AND actor_type = 'ADMIN' AND action = 'ADMIN_ROLE_UPDATED'
         AND entity_type = 'users' AND entity_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [oid, targetId],
    );
    expect(revertAudit.rows[0]?.before).toEqual({ adminRole: "FINANCE" });
    expect(revertAudit.rows[0]?.after).toEqual({ adminRole: "CAPTURE" });
  } finally {
    await db.end();
  }
});
