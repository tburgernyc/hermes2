/**
 * inngest/functions.ts
 * The durable workflows. Two categories:
 *   AUTONOMOUS (analyze/recommend only): scan, triage, discovery, quote ranking, monitors.
 *   GATED (cannot act without a human event): outreach send.
 *
 * THE PRODUCT RULE (CLAUDE.md §2): no model output ever triggers a send or a state advance. The outreach
 * function below physically cannot send until it receives `hermes/outreach.approved`, which only an
 * authenticated admin action emits. Audit every autonomous write and every approval.
 */
import { and, eq, isNull, lt } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@hermes/db";
import {
  solicitations,
  vendorProspects,
  outreachMessages,
  vendorQuotes,
  approvals,
} from "@hermes/db/schema";
import { triageSolicitation, scoreProspect, draftSOW, evaluateQuotes, FailClosedError } from "@hermes/ai";
import { inngest } from "./client";
import { safeFetchDocument, audit } from "./safety";

const resend = new Resend(process.env.RESEND_API_KEY);

/* ================================================================== */
/* AUTONOMOUS — SAM scan (4x/day ET). Ingest + dedupe + emit.          */
/* ================================================================== */
export const samScan = inngest.createFunction(
  { id: "sam-scan", retries: 3 },
  { cron: "TZ=America/New_York 0 7,11,15,19 * * *" },
  async ({ step }) => {
    const orgs = await step.run("load-orgs", () => db.query.organizations.findMany());

    for (const org of orgs) {
      const notices = await step.run(`fetch-sam-${org.id}`, async () => {
        const { bytes } = await safeFetchDocument(
          `https://api.sam.gov/opportunities/v2/search?ncode=541511,541512,541519&api_key=${process.env.SAM_API_KEY}`,
          { allowedTypes: ["application/json"] }
        );
        return JSON.parse(new TextDecoder().decode(bytes))?.opportunitiesData ?? [];
      });

      for (const n of notices) {
        // Idempotent upsert on (orgId, samNoticeId): re-running a cron never double-ingests.
        const inserted = await step.run(`upsert-${org.id}-${n.noticeId}`, async () => {
          const rows = await db
            .insert(solicitations)
            .values({
              orgId: org.id,
              samNoticeId: n.noticeId,
              title: n.title,
              agency: n.fullParentPathName,
              naicsCode: n.naicsCode,
              scopeText: n.description ?? "",
              status: "pending_triage",
            })
            .onConflictDoNothing({ target: [solicitations.orgId, solicitations.samNoticeId] })
            .returning({ id: solicitations.id });
          return rows[0] ?? null;
        });

        if (inserted) {
          await step.sendEvent("emit-ingested", {
            name: "hermes/solicitation.ingested",
            data: { orgId: org.id, solicitationId: inserted.id },
          });
        }
      }
    }
  }
);

/* ================================================================== */
/* AUTONOMOUS — Triage. Writes a RECOMMENDATION and STOPS.             */
/* No email. No state advance beyond triage_complete.                  */
/* ================================================================== */
export const triage = inngest.createFunction(
  { id: "triage-solicitation", retries: 2 },
  { event: "hermes/solicitation.ingested" },
  async ({ event, step }) => {
    const { orgId, solicitationId } = event.data;
    const sol = await step.run("load", () =>
      db.query.solicitations.findFirst({ where: eq(solicitations.id, solicitationId) })
    );
    if (!sol) return;

    const verdict = await step.run("ai-triage", async () => {
      try {
        return await triageSolicitation({
          title: sol.title,
          agency: sol.agency ?? undefined,
          scopeText: sol.scopeText ?? "",
        });
      } catch (e) {
        if (e instanceof FailClosedError) return null; // fail closed -> human review
        throw e;
      }
    });

    await step.run("write-recommendation", async () => {
      await db
        .update(solicitations)
        .set({
          status: "triage_complete", // recommendation only — a human approves sourcing next
          feasibilityScore: verdict?.feasibilityScore ?? null,
          zeroFloatFit: verdict?.zeroFloatFit ?? null,
          rejectionReasons: verdict?.rejectionReasons ?? null,
          triagedAt: new Date(),
        })
        .where(eq(solicitations.id, solicitationId));

      await audit({
        orgId,
        actor: "system:triage",
        isAutonomous: true,
        action: verdict ? "triage_complete" : "triage_failed_closed",
        entityTable: "solicitations",
        entityId: solicitationId,
        after: verdict ?? { failedClosed: true },
      });
    });
    // STOP. No outreach, no advance. The next step requires hermes/sourcing.approved (a human).
  }
);

/* ================================================================== */
/* AUTONOMOUS (post human-approval) — Discover subs + DRAFT outreach.  */
/* Triggered by hermes/sourcing.approved (a HUMAN event). Drafts only. */
/* ================================================================== */
export const onSourcingApproved = inngest.createFunction(
  { id: "discover-and-draft-outreach", retries: 2 },
  { event: "hermes/sourcing.approved" },
  async ({ event, step }) => {
    const { orgId, solicitationId } = event.data;
    const sol = await step.run("load", () =>
      db.query.solicitations.findFirst({ where: eq(solicitations.id, solicitationId) })
    );
    if (!sol) return;

    const brief = await step.run("draft-sow", () =>
      draftSOW({ title: sol.title, scopeText: sol.scopeText ?? "" })
    );

    const prospects = await step.run("load-prospects", () =>
      db.query.vendorProspects.findMany({ where: eq(vendorProspects.orgId, orgId) })
    );

    for (const p of prospects) {
      const score = await step.run(`score-${p.id}`, () =>
        scoreProspect({ solicitationScope: sol.scopeText ?? "", prospectCapability: p.capabilityText ?? "" })
      );
      if (score.recommendation === "reject") continue;

      // Draft outreach + create an approval row. NOTHING is sent here.
      await step.run(`draft-outreach-${p.id}`, async () => {
        const [msg] = await db
          .insert(outreachMessages)
          .values({
            orgId,
            solicitationId,
            prospectId: p.id,
            subject: `Subcontracting opportunity: ${brief.title}`,
            body: `${brief.summary}\n\nKey requirements:\n- ${brief.keyRequirements.join("\n- ")}`,
            quoteToken: crypto.randomUUID(), // replace with a signed single-purpose token
            optoutToken: crypto.randomUUID(),
          })
          .returning({ id: outreachMessages.id });

        const [appr] = await db
          .insert(approvals)
          .values({ orgId, type: "outreach", entityTable: "outreach_messages", entityId: msg.id })
          .returning({ id: approvals.id });

        await db.update(solicitations).set({ status: "awaiting_approval" }).where(eq(solicitations.id, solicitationId));
        await audit({ orgId, actor: "system:discovery", isAutonomous: true, action: "outreach_drafted", entityTable: "outreach_messages", entityId: msg.id });

        // Hand the drafted message to the gate function and wait for a human.
        await inngest.send({ name: "hermes/outreach.queued", data: { orgId, outreachId: msg.id, approvalId: appr.id } });
      });
    }
  }
);

/* ================================================================== */
/* THE HUMAN GATE — outreach can ONLY send after an approval EVENT.    */
/* This function blocks on waitForEvent. A model score cannot satisfy  */
/* it; only hermes/outreach.approved (emitted by an admin action) can. */
/* ================================================================== */
export const outreachGate = inngest.createFunction(
  { id: "outreach-approval-gate", retries: 2 },
  { event: "hermes/outreach.queued" },
  async ({ event, step }) => {
    const { orgId, outreachId } = event.data;

    // Park here until a human approves — up to 14 days, then expire. No timeout = no send.
    const approved = await step.waitForEvent("await-human-approval", {
      event: "hermes/outreach.approved",
      timeout: "14d",
      match: "data.outreachId",
    });

    if (!approved) {
      await step.run("expire", async () => {
        await audit({ orgId, actor: "system:gate", isAutonomous: true, action: "outreach_expired_no_approval", entityTable: "outreach_messages", entityId: outreachId });
      });
      return; // never sent
    }

    // Approved by a human. NOW (and only now) we send.
    await step.run("send", async () => {
      const msg = await db.query.outreachMessages.findFirst({ where: eq(outreachMessages.id, outreachId) });
      if (!msg) return;
      const prospect = msg.prospectId
        ? await db.query.vendorProspects.findFirst({ where: eq(vendorProspects.id, msg.prospectId) })
        : null;
      if (!prospect?.contactEmail) return;

      await resend.emails.send({
        from: "Burger Consulting <opportunities@burgergov.com>",
        to: prospect.contactEmail,
        subject: msg.subject,
        // React Email template autoescapes; include CAN-SPAM footer + opt-out link to /optout/[token]
        text: `${msg.body}\n\nOpt out: https://burgergov.com/optout/${msg.optoutToken}`,
      });

      await db.update(outreachMessages).set({ sentAt: new Date() }).where(eq(outreachMessages.id, outreachId));
      await db.update(solicitations).set({ status: "sourcing_in_progress" }).where(eq(solicitations.id, msg.solicitationId!));
      await audit({
        orgId,
        actor: `user:${approved.data.approvedBy}`,
        isAutonomous: false, // a human authorized this
        action: "outreach_sent",
        entityTable: "outreach_messages",
        entityId: outreachId,
      });
    });
  }
);

/* ================================================================== */
/* AUTONOMOUS — Quote detector (every 15 min). Extract + rank + flag.  */
/* ================================================================== */
export const quoteDetector = inngest.createFunction(
  { id: "quote-detector", retries: 2 },
  { cron: "TZ=America/New_York */15 * * * *" },
  async ({ step }) => {
    // Solicitations with unranked quotes
    const pending = await step.run("find-unranked", () =>
      db.query.vendorQuotes.findMany({ where: isNull(vendorQuotes.aiRank) })
    );
    const bySol = new Map<string, typeof pending>();
    for (const q of pending) {
      const arr = bySol.get(q.solicitationId) ?? [];
      arr.push(q);
      bySol.set(q.solicitationId, arr);
    }

    for (const [solicitationId, quotes] of bySol) {
      const sol = await step.run(`load-sol-${solicitationId}`, () =>
        db.query.solicitations.findFirst({ where: eq(solicitations.id, solicitationId) })
      );
      if (!sol) continue;

      const ranking = await step.run(`rank-${solicitationId}`, async () => {
        try {
          return await evaluateQuotes({
            solicitationScope: sol.scopeText ?? "",
            quotes: quotes.map((q) => ({
              quoteId: q.id,
              vendorName: "vendor",
              totalPrice: String(q.totalPrice ?? ""),
              notes: q.notes ?? undefined, // fenced as untrusted inside evaluateQuotes
            })),
          });
        } catch (e) {
          if (e instanceof FailClosedError) return null;
          throw e;
        }
      });

      await step.run(`write-ranks-${solicitationId}`, async () => {
        for (const r of ranking?.rankings ?? []) {
          await db.update(vendorQuotes).set({ aiRank: r.rank, aiRationale: r.rationale, extractedAt: new Date() }).where(eq(vendorQuotes.id, r.quoteId));
        }
        await db.update(solicitations).set({ status: "pricing_pending" }).where(eq(solicitations.id, solicitationId));
        await audit({ orgId: sol.orgId, actor: "system:quote-detector", isAutonomous: true, action: ranking ? "quotes_ranked" : "ranking_failed_closed", entityTable: "solicitations", entityId: solicitationId, after: { injectionAttempts: ranking?.injectionAttemptsDetected ?? [] } });
      });
    }
  }
);

/* ================================================================== */
/* AUTONOMOUS monitors (concise).                                      */
/* ================================================================== */
export const deadlineMonitor = inngest.createFunction(
  { id: "deadline-monitor" },
  { cron: "TZ=America/New_York 30 7 * * *" },
  async ({ step }) => {
    const soon = new Date(Date.now() + 72 * 3600 * 1000);
    await step.run("flag-deadlines", async () => {
      const due = await db.query.solicitations.findMany({ where: lt(solicitations.responseDeadline, soon) });
      // surface in morning brief / admin alerts; no state change
      return due.length;
    });
  }
);

export const morningBrief = inngest.createFunction(
  { id: "morning-brief" },
  { cron: "TZ=America/New_York 30 8 * * *" },
  async ({ step }) => {
    await step.run("compose-brief", async () => {
      // Aggregate: new triage recommendations, items awaiting approval, new ranked quotes, deadlines, AR.
      // Email the admin a digest with links to /admin/approvals. No autonomous action taken.
      return true;
    });
  }
);

export const functions = [
  samScan,
  triage,
  onSourcingApproved,
  outreachGate,
  quoteDetector,
  deadlineMonitor,
  morningBrief,
];
