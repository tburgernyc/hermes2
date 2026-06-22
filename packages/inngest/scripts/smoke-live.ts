/**
 * LIVE smoke test (operator-run, NOT CI). Proves the front of the pipeline works against the REAL
 * external services with the real keys: (1) the SAM.gov pull returns real opportunities, and (2) the
 * first AI stage (triage) actually fires against Anthropic and returns a real advisory recommendation.
 *
 * It STOPS after triage — it never approves sourcing, sends outreach, prices, drafts, or submits.
 *
 * Billing/secret hygiene (CLAUDE.md §4): this script loads `.env` ITSELF (dotenv, below) inside its own
 * Node process, so the real ANTHROPIC_API_KEY / SAM_API_KEY are used at RUNTIME without ever entering the
 * shell that launched it. Never `export` those keys to run this — just:
 *
 *     pnpm --filter @hermes/inngest exec tsx scripts/smoke-live.ts
 *
 * It is deliberately NOT under test/ (vitest never auto-discovers it) so CI never makes live paid calls.
 * HERMES_TEST_MODE is forced on as a belt-and-suspenders guard even though this script stops before submit.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
// packages/inngest/scripts -> repo root (.env lives there, gitignored).
const repoRoot = resolve(here, "../../..");
dotenv.config({ path: resolve(repoRoot, ".env") });

// Nothing can transmit even though we stop before submit.
process.env.HERMES_TEST_MODE = "true";

import { getEngine } from "@hermes/ai";
import { and, desc, eq, getPool, orgs, solicitations, sql, withOrg } from "@hermes/db";
import { sendBriefEmail, sendOutreachEmail } from "@hermes/emails";

import {
  buildSamSearchUrl,
  ingestSolicitations,
  safeFetchDocument,
  triage,
  type LogicDeps,
} from "../src/index.js";

const FIRM_NAICS_FALLBACK = ["541511", "541512", "541519"] as const;
const WINDOW_DAYS = (() => {
  const raw = Number(process.env.SAM_POSTED_WINDOW_DAYS);
  return Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), 365) : 7;
})();

function line(s = ""): void {
  // eslint-disable-next-line no-console
  console.log(s);
}
function pass(step: string, detail: string): void {
  line(`✅ ${step} — ${detail}`);
}
class SmokeStop extends Error {}
function fail(step: string, detail: string): never {
  line(`❌ ${step} — ${detail}`);
  line("\nSTOPPED at the first failing step (nothing transmitted; no gates walked).");
  throw new SmokeStop();
}

function redactKey(url: string): string {
  return url.replace(/(api_key=)[^&]+/, "$1<redacted>");
}

interface SamNotice {
  noticeId?: string;
  solicitationNumber?: string;
  title?: string;
  fullParentPathName?: string;
  naicsCode?: string;
  responseDeadLine?: string;
}
interface SamPayload {
  totalRecords?: number;
  opportunitiesData?: SamNotice[];
}

async function main(): Promise<void> {
  line("=== LIVE smoke test: SAM pull + first AI triage (stops after triage) ===\n");

  // ---- Step 1: env presence (presence only — never print values) --------------------------------
  const hasSam = Boolean(process.env.SAM_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasSam) fail("env", "SAM_API_KEY is not present in .env");
  if (!hasAnthropic) fail("env", "ANTHROPIC_API_KEY is not present in .env");
  pass(
    "env",
    "harness will load SAM_API_KEY + ANTHROPIC_API_KEY from .env (values not printed)" +
      (process.env.VOYAGE_API_KEY ? " [+VOYAGE_API_KEY]" : ""),
  );

  // Resolve the firm org the same way the crons do.
  const orgIds = (process.env.HERMES_ACTIVE_ORG_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (orgIds.length === 0) fail("env", "HERMES_ACTIVE_ORG_IDS is empty — cannot resolve the firm org");
  const orgId = orgIds[0];

  const org = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ id: orgs.id, directives: orgs.directives })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row ?? null;
  });
  if (!org) fail("env", `org ${orgId} not found — run the seed first`);
  // Diagnostic override: SAM_SMOKE_NAICS=541511 forces a single code (SAM's ncode is single-valued —
  // see the per-NAICS loop in ingestSolicitations). Default uses the firm's configured NAICS list.
  const naics = process.env.SAM_SMOKE_NAICS
    ? [process.env.SAM_SMOKE_NAICS.trim()]
    : org.directives?.naicsCodes && org.directives.naicsCodes.length > 0
      ? org.directives.naicsCodes
      : [...FIRM_NAICS_FALLBACK];
  line(`   org: ${orgId} · NAICS ${naics.join(", ")} · posted window ${WINDOW_DAYS}d\n`);

  const deps: LogicDeps = {
    ai: getEngine(),
    sendOutreachEmail,
    sendBriefEmail,
    fetchDoc: safeFetchDocument,
  };

  // ---- Step 2: SAM pull (real) — one query PER NAICS (ncode is single-valued), merged + deduped -----
  const byNotice = new Map<string, SamNotice>();
  let lastUrl = "";
  let pulledAny = false;
  for (const code of naics) {
    const url = buildSamSearchUrl(code, process.env.SAM_API_KEY ?? "", {
      now: new Date(),
      windowDays: WINDOW_DAYS,
    });
    lastUrl = url;
    try {
      const { bytes } = await safeFetchDocument(url, { allowedTypes: ["application/json"] });
      const payload = JSON.parse(new TextDecoder().decode(bytes)) as SamPayload;
      pulledAny = true;
      for (const n of payload.opportunitiesData ?? []) {
        const id = n.noticeId ?? n.solicitationNumber;
        if (id && !byNotice.has(id)) byNotice.set(id, n);
      }
      line(`   ncode ${code}: ${payload.opportunitiesData?.length ?? 0} (totalRecords=${payload.totalRecords ?? "?"})`);
    } catch (err) {
      line(`   ncode ${code}: ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!pulledAny) {
    fail("sam-pull", `every NAICS query failed. Last URL: ${redactKey(lastUrl)}`);
  }
  const notices = [...byNotice.values()];
  if (notices.length === 0) {
    fail("sam-pull", `SAM returned 0 opportunities across all NAICS. Last URL: ${redactKey(lastUrl)}`);
  }
  pass("sam-pull", `HTTP 200 · ${notices.length} unique opportunities across ${naics.length} NAICS`);
  for (const n of notices.slice(0, 3)) {
    line(
      `   • ${n.noticeId ?? n.solicitationNumber ?? "?"} | ${n.fullParentPathName ?? "?"} | NAICS ${n.naicsCode ?? "?"} | due ${n.responseDeadLine ?? "?"}`,
    );
  }
  line("");

  // ---- Step 3: persist (real schema, idempotent) ------------------------------------------------
  const ingested = await withOrg(orgId, (tx) => ingestSolicitations(tx, deps, { orgId }));
  // Re-running is idempotent (onConflictDoNothing); if nothing new this run, pick an existing real row.
  let targetId: string;
  if (ingested.length > 0) {
    targetId = ingested[0].id;
    pass("persist", `${ingested.length} new row(s) written; target ${targetId}`);
  } else {
    const existing = await withOrg(orgId, async (tx) => {
      const [row] = await tx
        .select({ id: solicitations.id })
        .from(solicitations)
        .where(eq(solicitations.orgId, orgId))
        .orderBy(desc(solicitations.createdAt))
        .limit(1);
      return row ?? null;
    });
    if (!existing) fail("persist", "no solicitation rows exist after ingest");
    targetId = existing.id;
    pass("persist", `0 new (all already ingested — idempotent); using existing real row ${targetId}`);
  }
  // Confirm the row actually exists in the real schema.
  const confirmed = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ id: solicitations.id, noticeId: solicitations.noticeId, status: solicitations.status })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, targetId)))
      .limit(1);
    return row ?? null;
  });
  if (!confirmed) fail("persist", `row ${targetId} not found after insert`);
  line(`   confirmed row: notice ${confirmed.noticeId} · status ${confirmed.status}\n`);

  // ---- Step 4: first AI stage — live Anthropic triage -------------------------------------------
  let triageStatus: string;
  try {
    const result = await withOrg(orgId, (tx) => triage(tx, deps, { orgId, solicitationId: targetId }));
    triageStatus = result.status;
  } catch (err) {
    fail("triage", `live Anthropic call errored: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (triageStatus === "FAILED_CLOSED") {
    fail("triage", "triage FAILED_CLOSED (model output failed validation — canned fallback, not advisory)");
  }
  if (triageStatus !== "TRIAGE_COMPLETE") fail("triage", `unexpected status ${triageStatus}`);

  // Read back the persisted advisory recommendation + the audit row that proves a real verdict landed.
  const after = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        status: solicitations.status,
        feasibilityScore: solicitations.feasibilityScore,
        zeroFloatFit: solicitations.zeroFloatFit,
        triagedAt: solicitations.triagedAt,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, targetId)))
      .limit(1);
    const audit = await tx.execute<{ after: { recommendation?: string; summary?: string } }>(
      sql`SELECT after FROM audit_log
          WHERE org_id = ${orgId} AND entity_id = ${targetId} AND action = 'SOLICITATION_TRIAGED'
          ORDER BY created_at DESC LIMIT 1`,
    );
    const auditRow = (audit as unknown as { rows?: Array<{ after?: { recommendation?: string } }> })
      .rows?.[0];
    return { row, recommendation: auditRow?.after?.recommendation ?? "?" };
  });
  pass(
    "triage",
    `live verdict: feasibility ${after.row?.feasibilityScore ?? "?"} · recommendation ${after.recommendation} · fit ${after.row?.zeroFloatFit ?? "?"}`,
  );
  // Advisory + overridable: the row sits at TRIAGE_COMPLETE — a recommendation a human approves/overrides
  // next. Nothing advanced past it; this is NOT a fail-closed canned fallback.
  line(
    `   advisory + overridable: status ${after.row?.status} (recommendation only — a human approves sourcing or marks no-go next)\n`,
  );

  // ---- Step 5: STOP -----------------------------------------------------------------------------
  line("🛑 STOP — did not approve sourcing, send outreach, price, draft, or submit.");
  line("    The opportunity is left at TRIAGE_COMPLETE for the manual walk.\n");
  line("=== SMOKE PASS: env ✓ · SAM real ✓ · persisted ✓ · live triage ✓ · stopped cleanly ✓ ===");
}

main()
  .catch((err) => {
    if (!(err instanceof SmokeStop)) {
      line(`\n❌ unexpected harness error: ${err instanceof Error ? err.stack : String(err)}`);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    void getPool().end();
  });
