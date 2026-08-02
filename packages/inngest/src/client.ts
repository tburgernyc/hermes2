/**
 * packages/inngest/src/client.ts — the Inngest client + typed event registry. Events are the only way
 * work advances across a human gate (CLAUDE.md §2). The human-gate events are emitted ONLY by an
 * authenticated admin action in the app — never by a cron, a model, or any autonomous job.
 */
import { EventSchemas, Inngest } from "inngest";

export type HermesEvents = {
  // --- Autonomous pipeline (jobs/models may emit these) ---
  "hermes/solicitation.ingested": { data: { orgId: string; solicitationId: string } };
  "hermes/quote.submitted": { data: { orgId: string; solicitationId: string; quoteId: string } };
  // `outreach.queued` ARMS the approval gate (parks a function on waitForEvent); it does NOT authorize a
  // send. The autonomous draft step emits it. The send happens ONLY when the human-gate event below
  // (outreach.approved) arrives. So an autonomous emitter here is safe — it cannot pull the trigger.
  "hermes/outreach.queued": { data: { orgId: string; outreachId: string } };

  // --- HUMAN GATES — the ONLY events that authorize advancing state / sending. Emitted SOLELY by an
  //     authenticated admin action (apps/web/app/admin/approvals/actions.ts). No cron, model, or
  //     autonomous job may emit these (CLAUDE.md §2 Prime Directive). ---
  "hermes/sourcing.approved": { data: { orgId: string; solicitationId: string; approvedBy: string } };
  "hermes/outreach.approved": { data: { orgId: string; outreachId: string; approvedBy: string } };
  "hermes/outreach.rejected": { data: { orgId: string; outreachId: string; rejectedBy: string } };
  // Emitted SOLELY by selectQuote (apps/web/app/admin/solicitations/actions.ts) when an admin selects a
  // winning quote. It drafts a priced bid decision-brief into a proposals row (the workflow ANALYZES only —
  // it never submits; the human-submit gate stays in the proposal review surface). The human already gated
  // by selecting, so the drafting function is event-triggered (not a waitForEvent gate).
  "hermes/quote.selected": {
    data: { orgId: string; solicitationId: string; quoteId: string; selectedBy: string };
  };
  // Emitted SOLELY by recordOutcome (apps/web/app/admin/solicitations/[id]/subcontract/actions.ts — the
  // §3.1 award-recording action) when an admin records a government AWARD decision. It cascades the
  // subcontract record from the already-SELECTED winning quote and drafts the (unsigned) subcontract
  // agreement for admin review — it never sends anything to the vendor and never starts e-signature. The
  // human already gated by recording the award, so the drafting function is event-triggered.
  "hermes/solicitation.awarded": {
    data: { orgId: string; solicitationId: string; awardedBy: string };
  };
  // Emitted SOLELY by requestRfiCapabilityStatementDraft (apps/web/app/admin/(console)/rfi/actions.ts —
  // §3.8.1) when an admin clicks "Draft capability statement" on a RECEIVED sources-sought/RFI-track
  // solicitation. Drafts prose only (no pricing, no commitment) and stores it as a CAPABILITY_STATEMENT
  // document for admin review — it never submits/sends anything. The human already gated by clicking, so
  // the drafting function is event-triggered (not a waitForEvent gate), mirroring quote.selected.
  "hermes/rfi.capability-statement.requested": {
    data: { orgId: string; solicitationId: string; requestedBy: string };
  };
};

export const inngest = new Inngest({
  id: "hermes",
  schemas: new EventSchemas().fromRecord<HermesEvents>(),
});
