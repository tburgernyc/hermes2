/**
 * Mock LogicDeps: canned, schema-valid AI outputs plus vi.fn() spies for the email senders and the
 * SSRF-guarded fetch. Tests assert on the spies (e.g. "sendOutreachEmail was never called during triage")
 * and override individual AI methods per case (e.g. to throw FailClosedError).
 */
import { vi, type Mock } from "vitest";

import type { ProspectScore, SowBrief, TriageVerdict } from "@hermes/ai";

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

export interface TestDeps {
  deps: LogicDeps;
  sendOutreachEmail: Mock;
  sendBriefEmail: Mock;
  fetchDoc: Mock;
}

export function makeDeps(ai: Partial<LogicDeps["ai"]> = {}): TestDeps {
  const sendOutreachEmail = vi.fn(async () => ({ id: "email_test" }));
  const sendBriefEmail = vi.fn(async () => ({ id: "brief_test" }));
  const fetchDoc = vi.fn(async () => ({ bytes: new Uint8Array(), contentType: "application/json" }));

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
  };

  return {
    deps: { ai: fullAi, sendOutreachEmail, sendBriefEmail, fetchDoc },
    sendOutreachEmail,
    sendBriefEmail,
    fetchDoc,
  };
}
