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

  // --- HUMAN GATES — emitted ONLY by an authenticated admin action (apps/web/app/admin/approvals).
  //     No cron, no model, no autonomous job may emit these. ---
  "hermes/sourcing.approved": { data: { orgId: string; solicitationId: string; approvedBy: string } };
  "hermes/outreach.queued": { data: { orgId: string; outreachId: string } };
  "hermes/outreach.approved": { data: { orgId: string; outreachId: string; approvedBy: string } };
  "hermes/outreach.rejected": { data: { orgId: string; outreachId: string; rejectedBy: string } };
};

export const inngest = new Inngest({
  id: "hermes",
  schemas: new EventSchemas().fromRecord<HermesEvents>(),
});
