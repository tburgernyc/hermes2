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
  // `subcontractors.requested` is operator-initiated (an admin clicks "Find subcontractors"), but it is
  // ADVISORY, not a gate: the handler only discovers + pre-vets + scores candidate prospects — it sends
  // nothing and advances no state, so an admin-emitted trigger is safe (it cannot pull any trigger). The
  // existing outreach approval gate is unchanged.
  "hermes/subcontractors.requested": {
    data: { orgId: string; solicitationId: string; requestedBy: string };
  };

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
};

export const inngest = new Inngest({
  id: "hermes",
  schemas: new EventSchemas().fromRecord<HermesEvents>(),
});
