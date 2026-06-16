/**
 * packages/inngest/src/functions.ts — the durable Inngest functions. Each is a THIN wrapper: it resolves
 * org context, opens an org-scoped transaction with withOrg(), and calls the corresponding logic.ts
 * function inside a step.run (durable + retried). The business rules and all DB writes live in logic.ts.
 *
 * THE GATE (CLAUDE.md §2): outreachGateFn parks on step.waitForEvent and physically cannot send until the
 * `hermes/outreach.approved` event arrives — and that event is emitted ONLY by an authenticated admin
 * action (apps/web/app/admin/approvals). No cron, model, or autonomous job can satisfy the wait.
 *
 * Org context: crons have no event orgId, so they iterate a configured active-org set
 * (HERMES_ACTIVE_ORG_IDS — a deliberate single-tenant simplification; cross-tenant "list all orgs" needs
 * a scheduler read-role and is deferred). Event-triggered functions get orgId from the event payload.
 */
import { getEngine } from "@hermes/ai";
import { withOrg } from "@hermes/db";
import { sendBriefEmail, sendOutreachEmail } from "@hermes/emails";

import { inngest } from "./client.js";
import { safeFetchDocument } from "./safety.js";
import {
  composeMorningBrief,
  draftProposalBid,
  expireOutreach,
  findUnrankedSolicitationIds,
  ingestSolicitations,
  ingestUsaspending,
  monitorDeadlines,
  onSourcingApproved,
  rankQuotes,
  runArFollowups,
  sendOutreach,
  triage,
  type LogicDeps,
} from "./logic.js";

const TZ = "TZ=America/New_York";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Production deps: the live AI engine, Resend senders, and the SSRF-guarded fetch. Tests inject mocks. */
function defaultDeps(): LogicDeps {
  return { ai: getEngine(), sendOutreachEmail, sendBriefEmail, fetchDoc: safeFetchDocument };
}

/** Active orgs the crons operate on. Comma-separated UUIDs (HERMES_ACTIVE_ORG_IDS). */
export function resolveActiveOrgIds(): string[] {
  return (process.env.HERMES_ACTIVE_ORG_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
}

/* ============================ AUTONOMOUS — SAM scan (4x/day ET) ============================ */
export const samScan = inngest.createFunction(
  { id: "sam-scan", retries: 3 },
  { cron: `${TZ} 0 7,11,15,19 * * *` },
  async ({ step }) => {
    const deps = defaultDeps();
    for (const orgId of resolveActiveOrgIds()) {
      const ingested = await step.run(`ingest-${orgId}`, () =>
        withOrg(orgId, (tx) => ingestSolicitations(tx, deps, { orgId })),
      );
      for (const s of ingested) {
        await step.sendEvent(`ingested-${s.id}`, {
          name: "hermes/solicitation.ingested",
          data: { orgId, solicitationId: s.id },
        });
      }
    }
  },
);

/* ============================ AUTONOMOUS — Triage (recommendation only) ==================== */
export const triageFn = inngest.createFunction(
  { id: "triage-solicitation", retries: 2 },
  { event: "hermes/solicitation.ingested" },
  async ({ event, step }) => {
    const { orgId, solicitationId } = event.data;
    return step.run("triage", () =>
      withOrg(orgId, (tx) => triage(tx, defaultDeps(), { orgId, solicitationId })),
    );
  },
);

/* ============== POST-HUMAN-APPROVAL — discover + DRAFT outreach (no send) ================= */
export const onSourcingApprovedFn = inngest.createFunction(
  { id: "discover-and-draft-outreach", retries: 2 },
  { event: "hermes/sourcing.approved" },
  async ({ event, step }) => {
    const { orgId, solicitationId, approvedBy } = event.data;
    const result = await step.run("draft", () =>
      withOrg(orgId, (tx) =>
        onSourcingApproved(tx, defaultDeps(), { orgId, solicitationId, approvedBy }),
      ),
    );
    // Arm the approval gate for each drafted campaign (this event does NOT authorize a send).
    for (const d of result.drafted) {
      await step.sendEvent(`queue-${d.outreachId}`, {
        name: "hermes/outreach.queued",
        data: { orgId, outreachId: d.outreachId },
      });
    }
  },
);

/* ===================== THE HUMAN GATE — send ONLY after an approval EVENT ================== */
export const outreachGateFn = inngest.createFunction(
  { id: "outreach-approval-gate", retries: 2 },
  { event: "hermes/outreach.queued" },
  async ({ event, step }) => {
    const { orgId, outreachId } = event.data;

    // Park here until a human approves — up to 14 days, then expire. A model score cannot satisfy this.
    const approved = await step.waitForEvent("await-approval", {
      event: "hermes/outreach.approved",
      timeout: "14d",
      match: "data.outreachId",
    });

    if (!approved) {
      await step.run("expire", () =>
        withOrg(orgId, (tx) => expireOutreach(tx, { orgId, outreachId })),
      );
      return; // never sent
    }

    // Approved by a human — NOW (and only now) send.
    return step.run("send", () =>
      withOrg(orgId, (tx) =>
        sendOutreach(tx, defaultDeps(), { orgId, outreachId, approvedBy: approved.data.approvedBy }),
      ),
    );
  },
);

/* ========== POST-HUMAN-SELECTION — draft the priced bid decision-brief (no submit) ========= */
// Triggered by the hermes/quote.selected human-gate event (emitted ONLY by an admin selecting a winner).
// The human already gated by selecting, so this is event-triggered, NOT a waitForEvent gate. It drafts a
// proposals row and advances the solicitation to PROPOSAL_DRAFT — it never submits and never sends.
export const draftProposalBidFn = inngest.createFunction(
  { id: "draft-proposal-bid", retries: 2 },
  { event: "hermes/quote.selected" },
  async ({ event, step }) => {
    const { orgId, solicitationId, quoteId, selectedBy } = event.data;
    return step.run("draft", () =>
      withOrg(orgId, (tx) =>
        draftProposalBid(tx, defaultDeps(), { orgId, solicitationId, quoteId, selectedBy }),
      ),
    );
  },
);

/* ============================ AUTONOMOUS — Quote detector (every 15 min) =================== */
export const quoteDetectorFn = inngest.createFunction(
  { id: "quote-detector", retries: 2 },
  { cron: `${TZ} */15 * * * *` },
  async ({ step }) => {
    const deps = defaultDeps();
    for (const orgId of resolveActiveOrgIds()) {
      const ids = await step.run(`find-${orgId}`, () =>
        withOrg(orgId, (tx) => findUnrankedSolicitationIds(tx, { orgId })),
      );
      for (const solicitationId of ids) {
        await step.run(`rank-${solicitationId}`, () =>
          withOrg(orgId, (tx) => rankQuotes(tx, deps, { orgId, solicitationId })),
        );
      }
    }
  },
);

/* ============================ AUTONOMOUS monitors (read-only) ============================== */
export const usaspendingFn = inngest.createFunction(
  { id: "usaspending-ingest", retries: 2 },
  { cron: `${TZ} 0 */6 * * *` },
  async ({ step }) => {
    const deps = defaultDeps();
    for (const orgId of resolveActiveOrgIds()) {
      await step.run(`usaspending-${orgId}`, () =>
        withOrg(orgId, (tx) => ingestUsaspending(tx, deps, { orgId })),
      );
    }
  },
);

export const deadlineFn = inngest.createFunction(
  { id: "deadline-monitor" },
  { cron: `${TZ} 30 7 * * *` },
  async ({ step }) => {
    for (const orgId of resolveActiveOrgIds()) {
      await step.run(`deadlines-${orgId}`, () =>
        withOrg(orgId, (tx) => monitorDeadlines(tx, { orgId })),
      );
    }
  },
);

export const arFn = inngest.createFunction(
  { id: "ar-followups" },
  { cron: `${TZ} 0 17 * * *` },
  async ({ step }) => {
    for (const orgId of resolveActiveOrgIds()) {
      await step.run(`ar-${orgId}`, () => withOrg(orgId, (tx) => runArFollowups(tx, { orgId })));
    }
  },
);

export const morningBriefFn = inngest.createFunction(
  { id: "morning-brief" },
  { cron: `${TZ} 30 8 * * *` },
  async ({ step }) => {
    const deps = defaultDeps();
    for (const orgId of resolveActiveOrgIds()) {
      await step.run(`brief-${orgId}`, () =>
        withOrg(orgId, (tx) => composeMorningBrief(tx, deps, { orgId })),
      );
    }
  },
);

/* ============================ External dead-man's-switch heartbeat ========================= */
// An app that is down cannot alert on itself (CLAUDE.md §7). Ping an EXTERNAL monitor (healthchecks.io
// style) every ~10 min; the monitor alerts the operator if pings stop. HEARTBEAT_URL is operator-set, so
// a plain fetch is appropriate — but require https. This is NOT routed through the SSRF allowlist (the
// monitor host is intentionally external).
export const heartbeatFn = inngest.createFunction(
  { id: "cron-heartbeat" },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    await step.run("ping", async () => {
      const url = process.env.HEARTBEAT_URL;
      if (!url || !url.startsWith("https://")) return { pinged: false };
      try {
        await fetch(url, { method: "GET" });
        return { pinged: true };
      } catch {
        return { pinged: false }; // a failed ping is itself the signal the external monitor will catch
      }
    });
  },
);

/** The full function set served at /api/inngest. */
export const functions = [
  samScan,
  triageFn,
  onSourcingApprovedFn,
  outreachGateFn,
  draftProposalBidFn,
  quoteDetectorFn,
  usaspendingFn,
  deadlineFn,
  arFn,
  morningBriefFn,
  heartbeatFn,
];
