/**
 * packages/ai/src/capability-statement.ts — §3.8.1 sources-sought/RFI capture track. A sources-sought or
 * RFI notice is informational capture-development activity (no bid, no award) — it deliberately does NOT
 * flow through the bid/award state machine (see packages/db/src/schema/enums.ts `rfiTrackStatus`). This
 * module renders the model-drafted CapabilityStatementDraft (engine.draftCapabilityStatement — prose only)
 * into a plain-text document for storage as a CAPABILITY_STATEMENT `documents` row, mirroring
 * subcontract.ts's renderSubcontractDraftText. DB-free: all inputs arrive as parameters. The draft is
 * ALWAYS a reviewable artifact — RESPONSE_SUBMITTED is recorded by a human, never automatic (CLAUDE.md §2).
 */
import type { CapabilityStatementDraft } from "./schemas.js";

export const CAPABILITY_STATEMENT_DISCLAIMER =
  "DRAFT capability statement for admin review. This is an AI-DRAFTED response to a sources-sought/RFI " +
  "notice — informational capture-development activity, not a priced bid or a commitment. It must be " +
  "reviewed (and edited as needed) by a human before RESPONSE_SUBMITTED is recorded; nothing here is sent " +
  "to the agency automatically (CLAUDE.md §2).";

export interface CapabilityStatementDocument {
  draft: CapabilityStatementDraft;
  disclaimer: string;
  requiresAdminReview: true;
}

/** Deterministically wrap the model's prose with the standing review disclaimer. No model input here. */
export function assembleCapabilityStatement(draft: CapabilityStatementDraft): CapabilityStatementDocument {
  return { draft, disclaimer: CAPABILITY_STATEMENT_DISCLAIMER, requiresAdminReview: true };
}

/** Render the assembled capability statement to a plain-text document for storage (documents.storageKey). */
export function renderCapabilityStatementText(
  doc: CapabilityStatementDocument,
  meta: { orgName: string; solicitationTitle: string },
): string {
  const lines: string[] = [];
  lines.push(`CAPABILITY STATEMENT (DRAFT — response to sources-sought/RFI)`);
  lines.push(`From: ${meta.orgName}`);
  lines.push(`Re: ${meta.solicitationTitle}`);
  lines.push("");
  lines.push("## Organization Overview");
  lines.push(doc.draft.organizationOverview);
  lines.push("");
  lines.push("## Relevant Experience");
  lines.push(doc.draft.relevantExperience);
  lines.push("");
  lines.push("## Technical Capabilities");
  lines.push(doc.draft.technicalCapabilities);
  if (doc.draft.differentiators.length > 0) {
    lines.push("");
    lines.push("## Differentiators");
    for (const d of doc.draft.differentiators) lines.push(`- ${d}`);
  }
  lines.push("");
  lines.push("---");
  lines.push(doc.disclaimer);
  return lines.join("\n");
}
