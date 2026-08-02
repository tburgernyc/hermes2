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
import { sendBriefEmail, sendLossNotificationEmail, sendOutreachEmail } from "@hermes/emails";

import { inngest } from "./client.js";
import { safeFetchDocument } from "./safety.js";
import {
  closeRfiNoAction,
  composeMorningBrief,
  convertRfiToPursuit,
  draftProposalBid,
  draftRfiCapabilityStatement,
  draftSubcontract,
  expireOutreach,
  extractLmComplianceMatrix,
  findUnrankedSolicitationIds,
  ingestSolicitations,
  ingestUsaspending,
  monitorDeadlines,
  onSourcingApproved,
  rankQuotes,
  recordRfiResponseSubmitted,
  runArFollowups,
  sendLossNotification,
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
        // §3.8.1: an RFI-track row (rfiTrack=true) must NEVER enter the AI-triage / bid-award spine — it
        // stays PENDING_TRIAGE forever on the `status` axis and is worked entirely through rfi_track_status
        // instead (the /admin/rfi surface). Only non-RFI notices get triaged.
        if (s.rfiTrack) continue;
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

/* ========== POST-HUMAN-AWARD — cascade the subcontract + draft the agreement (no send) ===== */
// Triggered by the hermes/solicitation.awarded human-gate event (emitted ONLY by an admin recording a
// government AWARD decision — §3.1). The human already gated by recording the award, so this is
// event-triggered, NOT a waitForEvent gate. It creates the `contracts` row + milestones from the already-
// SELECTED winning quote and drafts the (unsigned) subcontract agreement — it never sends anything to the
// vendor and never starts e-signature (a separate, explicit admin review + confirm action does that).
export const draftSubcontractFn = inngest.createFunction(
  { id: "draft-subcontract", retries: 2 },
  { event: "hermes/solicitation.awarded" },
  async ({ event, step }) => {
    const { orgId, solicitationId, awardedBy } = event.data;
    return step.run("draft", () =>
      withOrg(orgId, (tx) => draftSubcontract(tx, defaultDeps(), { orgId, solicitationId, awardedBy })),
    );
  },
);

/* ============== §3.8.1 POST-HUMAN-REQUEST — draft an RFI capability-statement response (no send) ====== */
// Triggered by hermes/rfi.capability-statement.requested, emitted ONLY by an admin clicking "Draft
// capability statement" on a RECEIVED sources-sought/RFI-track solicitation (/admin/rfi). Event-triggered
// (not a waitForEvent gate) — the human already gated by clicking. Drafts prose only and stores it as a
// CAPABILITY_STATEMENT document for review; it never submits/sends anything (CLAUDE.md §2).
export const draftRfiCapabilityStatementFn = inngest.createFunction(
  { id: "draft-rfi-capability-statement", retries: 2 },
  { event: "hermes/rfi.capability-statement.requested" },
  async ({ event, step }) => {
    const { orgId, solicitationId } = event.data;
    return step.run("draft", () =>
      withOrg(orgId, (tx) => draftRfiCapabilityStatement(tx, defaultDeps(), { orgId, solicitationId })),
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

/* ===== POST-HUMAN-APPROVAL — send a queued loss notification (§3.1 item 5, not a durable fn) ===== */
// A thin, ready-wired call for the approvals Server Action (apps/web/app/admin/(console)/approvals). NOT a
// durable Inngest function: sending is a single Resend call gated by an explicit admin "Approve & send"
// click, so no retry/durability/waitForEvent machinery is warranted (mirrors sendOutreach's dependency
// wiring, minus the gate — the human already gated by clicking approve). apps/web calls this directly
// rather than adding a new package dependency on @hermes/emails.
export async function sendApprovedLossNotification(
  orgId: string,
  quoteId: string,
  approvedBy: string,
  approverEmail: string | null,
): Promise<{ status: "SENT" | "SKIPPED" | "FAILED" }> {
  return withOrg(orgId, (tx) =>
    sendLossNotification(
      tx,
      { sendLossNotificationEmail },
      { orgId, quoteId, approvedBy, approverEmail },
    ),
  );
}

/* ===== §3.8.1 RFI-track human recording actions (pure DB, not durable Inngest functions) ===== */
// Thin, ready-wired calls for the /admin/rfi Server Actions (apps/web). None of these call the model or
// send anything outbound — recordRfiResponseSubmitted/closeRfiNoAction/convertRfiToPursuit are pure human
// decisions recorded directly (mirrors sendApprovedLossNotification's "no durability machinery needed for
// a single admin click" reasoning). Kept in @hermes/inngest/logic.ts (not apps/web) so they get the same
// DB-backed test coverage as every other RFI-track transition.
export async function recordApprovedRfiResponseSubmitted(
  orgId: string,
  solicitationId: string,
  recordedBy: string,
  recordedByEmail: string | null,
): Promise<{ status: "RECORDED" | "REFUSED" }> {
  return withOrg(orgId, (tx) =>
    recordRfiResponseSubmitted(tx, { orgId, solicitationId, recordedBy, recordedByEmail }),
  );
}

export async function closeApprovedRfiNoAction(
  orgId: string,
  solicitationId: string,
  closedBy: string,
  closedByEmail: string | null,
): Promise<{ status: "CLOSED" | "REFUSED" }> {
  return withOrg(orgId, (tx) => closeRfiNoAction(tx, { orgId, solicitationId, closedBy, closedByEmail }));
}

export async function convertApprovedRfiToPursuit(
  orgId: string,
  solicitationId: string,
  convertedBy: string,
  convertedByEmail: string | null,
): Promise<{ status: "CONVERTED"; newSolicitationId: string } | { status: "REFUSED" }> {
  return withOrg(orgId, (tx) =>
    convertRfiToPursuit(tx, { orgId, solicitationId, convertedBy, convertedByEmail }),
  );
}

/* ===== §3.8.3 Section L/M compliance-matrix re-extraction (pure AI read/store, not a durable fn) ===== */
// A thin, ready-wired call for the proposal review Server Action (apps/web). Informative/structuring
// output only (CLAUDE.md §2/§6) — it never gates or blocks anything, so a single direct call (no
// retry/durability machinery) is appropriate, mirroring the RFI actions above. A transient failure is the
// caller's problem to surface; extractLmComplianceMatrix itself already fails closed (never throws) on an
// unvalidated model output.
export async function reextractSolicitationComplianceMatrix(
  orgId: string,
  solicitationId: string,
): Promise<{ status: "EXTRACTED" | "NOT_FOUND" | "FAILED_CLOSED" }> {
  return withOrg(orgId, (tx) => extractLmComplianceMatrix(tx, defaultDeps(), { orgId, solicitationId }));
}

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
  draftSubcontractFn,
  draftRfiCapabilityStatementFn,
  quoteDetectorFn,
  usaspendingFn,
  deadlineFn,
  arFn,
  morningBriefFn,
  heartbeatFn,
];
