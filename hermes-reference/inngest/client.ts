/**
 * inngest/client.ts
 * Inngest client + typed event registry. Events are the only way work advances across the human gate.
 */
import { Inngest, EventSchemas } from "inngest";

type Events = {
  // Autonomous pipeline
  "hermes/solicitation.ingested": { data: { orgId: string; solicitationId: string } };
  "hermes/quote.submitted": { data: { orgId: string; solicitationId: string; quoteId: string } };

  // HUMAN GATES — these events are emitted only by an authenticated admin action in the app.
  // No cron, no model, no autonomous job may emit them.
  "hermes/sourcing.approved": { data: { orgId: string; solicitationId: string; approvedBy: string } };
  "hermes/outreach.queued": { data: { orgId: string; outreachId: string; approvalId: string } };
  "hermes/outreach.approved": { data: { orgId: string; outreachId: string; approvedBy: string } };
  "hermes/outreach.rejected": { data: { orgId: string; outreachId: string; rejectedBy: string } };
};

export const inngest = new Inngest({
  id: "hermes",
  schemas: new EventSchemas().fromRecord<Events>(),
});
