/**
 * §3.8.1 sources-sought/RFI capture-track e2e. Inngest does not run in web-e2e (no INNGEST_EVENT_KEY —
 * mirrors proposal.spec.ts / admin-console.spec.ts's documented reasoning), so the AI-drafted
 * CAPABILITY_DRAFTED transition is proven separately with a mocked model in packages/inngest's DB-backed
 * suite (test/logic.test.ts). Here we drive the REAL admin UI + real Postgres through the parts that do
 * NOT need the model: a real SOURCES_SOUGHT notice on its own lighter status track (RECEIVED), the
 * human-gated request click (RECEIVED → drafting requested, audited), then — after seeding the
 * AI-dependent CAPABILITY_DRAFTED state exactly as proposal.spec.ts seeds PROPOSAL_DRAFT — the pure-DB
 * human transitions RESPONSE_SUBMITTED and CONVERTED, proving the RFI track is a genuinely separate,
 * lighter axis that never touches AWARDED/WON/LOST.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { E2E_ORG_SLUG } from "./fixtures";
import { loginAdmin } from "./admin-auth";

const OWNER_DSN =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

function pool(): Pool {
  if (!OWNER_DSN) throw new Error("rfi.spec: no Postgres DSN configured");
  return new Pool({ connectionString: OWNER_DSN });
}

async function orgId(db: Pool): Promise<string> {
  const org = await db.query<{ id: string }>(`SELECT id FROM orgs WHERE slug = $1`, [E2E_ORG_SLUG]);
  const id = org.rows[0]?.id;
  if (!id) throw new Error("rfi.spec: e2e org not found (global-setup did not run?)");
  return id;
}

async function seedRfiSolicitation(db: Pool, oid: string, title: string): Promise<string> {
  const sol = await db.query<{ id: string }>(
    `INSERT INTO solicitations (org_id, notice_id, title, notice_type, rfi_track_status, scope_text, status)
     VALUES ($1, $2, $3, 'SOURCES_SOUGHT'::notice_type, 'RECEIVED'::rfi_track_status,
             'Provide cybersecurity assessment support.', 'PENDING_TRIAGE'::solicitation_status)
     RETURNING id`,
    [oid, `E2E-RFI-${randomUUID()}`, title],
  );
  return sol.rows[0]!.id;
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

test("a real sources-sought notice sits on its own lighter status track, never the bid/award kanban", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const title = `Cyber Sources Sought ${randomUUID()}`;
    const solId = await seedRfiSolicitation(db, oid, title);

    // It appears on the RFI queue, badged RECEIVED.
    await loginAdmin(page);
    await page.goto("/admin/rfi");
    await expect(page.getByTestId(`rfi-${solId}`)).toContainText(title);
    await expect(page.getByTestId(`rfi-${solId}`)).toContainText("Received");

    // It does NOT appear on the ordinary bid/award kanban (a separate, lighter axis).
    await page.goto("/admin/solicitations");
    await expect(page.locator("body")).not.toContainText(title);

    // The bid/award `status` column is untouched — still PENDING_TRIAGE (never triaged/advanced).
    const row = await db.query<{ status: string }>(`SELECT status FROM solicitations WHERE id = $1`, [
      solId,
    ]);
    expect(row.rows[0]?.status).toBe("PENDING_TRIAGE");
  } finally {
    await db.end();
  }
});

test("RECEIVED → request capability-statement draft (the human gate, audited) → CAPABILITY_DRAFTED (seeded, mirrors proposal.spec's AI-output seeding) → RESPONSE_SUBMITTED → CONVERTED", async ({
  page,
}) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const title = `IT Support Sources Sought ${randomUUID()}`;
    const solId = await seedRfiSolicitation(db, oid, title);
    const url = `/admin/rfi/${solId}`;

    await loginAdmin(page);
    await page.goto(url);

    // 1) RECEIVED: request the AI capability-statement draft — the human gate. Inngest doesn't run in
    //    web-e2e, so the transition itself won't fire live, but the REQUEST (the gate) is real and audited.
    await page.getByRole("button", { name: "Draft capability statement" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM audit_log
             WHERE org_id = $1 AND action = 'RFI_CAPABILITY_STATEMENT_REQUESTED' AND entity_id = $2`,
          [oid, solId],
        );
        return r.rows[0]?.n;
      })
      .toBe("1");

    // 2) Seed the AI-dependent CAPABILITY_DRAFTED state directly (mirrors proposal.spec.ts seeding
    //    PROPOSAL_DRAFT — the model call itself is proven with a mocked model in packages/inngest).
    await db.query(
      `UPDATE solicitations SET rfi_track_status = 'CAPABILITY_DRAFTED'::rfi_track_status WHERE id = $1`,
      [solId],
    );
    await page.goto(url);
    await expect(page.getByText("Capability drafted")).toBeVisible();

    // 3) Record the response as submitted (a pure human recording — real DB write via the real UI).
    await page.getByRole("button", { name: "Record response submitted" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT rfi_track_status AS status FROM solicitations WHERE id = $1`,
          [solId],
        );
        return r.rows[0]?.status;
      })
      .toBe("RESPONSE_SUBMITTED");
    const submittedAudit = await db.query(
      `SELECT actor_type FROM audit_log
         WHERE org_id = $1 AND action = 'RFI_RESPONSE_SUBMITTED' AND entity_id = $2`,
      [oid, solId],
    );
    expect(submittedAudit.rows[0]?.actor_type).toBe("ADMIN");

    // 4) Convert to a tracked pursuit: creates a NEW, ordinary solicitation row.
    await page.goto(url);
    await page.getByRole("button", { name: "Convert to tracked pursuit" }).click();
    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT rfi_track_status AS status FROM solicitations WHERE id = $1`,
          [solId],
        );
        return r.rows[0]?.status;
      })
      .toBe("CONVERTED");

    const created = await db.query<{
      id: string;
      status: string;
      rfi_track_status: string | null;
      converted_from_solicitation_id: string;
    }>(
      `SELECT id, status, rfi_track_status, converted_from_solicitation_id FROM solicitations
         WHERE org_id = $1 AND converted_from_solicitation_id = $2`,
      [oid, solId],
    );
    expect(created.rows).toHaveLength(1);
    const newSol = created.rows[0]!;
    // The new pursuit is a NORMAL, ordinary tracked pursuit — never fast-tracked to an outcome.
    expect(newSol.status).toBe("PENDING_TRIAGE");
    expect(newSol.rfi_track_status).toBeNull();
    expect(["AWARDED", "SUBMITTED", "WON"]).not.toContain(newSol.status);

    // The page shows the link to the new pursuit.
    await page.goto(url);
    await expect(page.getByText("Converted into a tracked pursuit.")).toBeVisible();
  } finally {
    await db.end();
  }
});

test("close (no action) is a terminal human decision — no model, no send", async ({ page }) => {
  const db = pool();
  try {
    const oid = await orgId(db);
    const title = `Declined Sources Sought ${randomUUID()}`;
    const solId = await seedRfiSolicitation(db, oid, title);

    await loginAdmin(page);
    await page.goto(`/admin/rfi/${solId}`);
    await page.getByRole("button", { name: "Close (no action)" }).click();

    await expect
      .poll(async () => {
        const r = await db.query<{ status: string }>(
          `SELECT rfi_track_status AS status FROM solicitations WHERE id = $1`,
          [solId],
        );
        return r.rows[0]?.status;
      })
      .toBe("CLOSED_NO_ACTION");
  } finally {
    await db.end();
  }
});
