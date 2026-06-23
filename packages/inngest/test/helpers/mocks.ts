/**
 * Mock LogicDeps: canned, schema-valid AI outputs plus vi.fn() spies for the email senders and the
 * SSRF-guarded fetch. Tests assert on the spies (e.g. "sendOutreachEmail was never called during triage")
 * and override individual AI methods per case (e.g. to throw FailClosedError).
 */
import { vi, type Mock } from "vitest";

import { assembleBidPackage, EMBED_DIM } from "@hermes/ai";
import type { ProposalNarrative, ProspectScore, SowBrief, TriageVerdict } from "@hermes/ai";

import type { LogicDeps } from "../../src/logic.js";

const DEFAULT_TRIAGE: TriageVerdict = {
  naics: "541511",
  contractType: "FFP",
  feasibilityScore: 8,
  zeroFloatFit: true,
  rejectionReasons: [],
  summary: "Strong Zero-Float fit.",
  recommendation: "PURSUE",
};

const DEFAULT_SCORE: ProspectScore = {
  score: 85,
  capabilityMatch: 0.85,
  strengths: ["scope match"],
  gaps: [],
  recommendation: "PURSUE",
};

const DEFAULT_SOW: SowBrief = {
  title: "IT Support SOW",
  summary: "Provide tiered IT support.",
  keyRequirements: ["Tier 1 support", "Onsite within 4h"],
  suggestedCapabilities: [],
};

/** A canned (prose-only) narrative; the real engine assembles the deterministic brief around it. */
const DEFAULT_NARRATIVE: ProposalNarrative = {
  executiveSummary: "We propose a responsive, low-risk solution.",
  technicalApproach: "Phased delivery with the selected subcontractor.",
  managementApproach: "Single accountable PM; weekly status.",
  pastPerformanceNarrative: "Relevant prior IT support engagements.",
  assumptions: [],
};

export interface TestDeps {
  deps: LogicDeps;
  sendOutreachEmail: Mock;
  sendBriefEmail: Mock;
  fetchDoc: Mock;
  embed: Mock;
}

/** Per-case overrides for the non-AI collaborators (the sourcing tests inject a SAM/USASpending fetch). */
export interface DepsOverrides {
  fetchDoc?: LogicDeps["fetchDoc"];
  embed?: LogicDeps["embed"];
}

export function makeDeps(ai: Partial<LogicDeps["ai"]> = {}, overrides: DepsOverrides = {}): TestDeps {
  const sendOutreachEmail = vi.fn(async () => ({ id: "email_test" }));
  const sendBriefEmail = vi.fn(async () => ({ id: "brief_test" }));
  const fetchDoc = vi.fn(
    overrides.fetchDoc ?? (async () => ({ bytes: new Uint8Array(), contentType: "application/json" })),
  );
  // Default embedding: a fixed EMBED_DIM vector (valid for the pgvector column). Override per-case to vary
  // the cosine ranking. Tests never call the real Voyage API (no VOYAGE_API_KEY — CLAUDE.md §4).
  const embed = vi.fn(overrides.embed ?? (async () => new Array(EMBED_DIM).fill(0) as number[]));

  const fullAi: LogicDeps["ai"] = {
    triageSolicitation: ai.triageSolicitation ?? (async () => DEFAULT_TRIAGE),
    scoreProspect: ai.scoreProspect ?? (async () => DEFAULT_SCORE),
    draftSOW: ai.draftSOW ?? (async () => DEFAULT_SOW),
    // Default: rank every submitted quote in input order, no injection attempts.
    evaluateQuotes:
      ai.evaluateQuotes ??
      (async (input) => ({
        rankings: input.quotes.map((q, i) => ({
          quoteId: q.quoteId,
          rank: i + 1,
          score: 90 - i,
          rationale: "Solid",
          risks: [],
        })),
        injectionAttemptsDetected: [],
      })),
    // Default: assemble a real (deterministic) bid package around a canned narrative — no model call, so
    // tests exercise the genuine pricing/compliance/§3 assembly. Override per-case to throw FailClosedError.
    draftBid:
      ai.draftBid ??
      (async (input) =>
        assembleBidPackage({
          narrative: DEFAULT_NARRATIVE,
          pricing: input.pricing,
          compliance: input.compliance,
          bid: input.bid,
          submissionGates: input.submissionGates,
          provisionalRatesMode: input.provisionalRatesMode,
        })),
  };

  return {
    deps: { ai: fullAi, embed, sendOutreachEmail, sendBriefEmail, fetchDoc },
    sendOutreachEmail,
    sendBriefEmail,
    fetchDoc,
    embed,
  };
}
