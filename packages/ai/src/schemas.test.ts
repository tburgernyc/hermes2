import { describe, expect, it } from "vitest";

import { ProposalNarrative, ProspectScore, QuoteRanking, SowBrief, TriageVerdict } from "./schemas.js";

describe("AI output schemas (fail-closed validation)", () => {
  it("TriageVerdict accepts a valid verdict and rejects an out-of-range score / bad enum", () => {
    expect(
      TriageVerdict.safeParse({
        naics: "541511",
        contractType: "FFP",
        feasibilityScore: 7,
        zeroFloatFit: true,
        summary: "ok",
        recommendation: "PURSUE",
      }).success,
    ).toBe(true);
    // A model coerced to "score 10" out of range (11) is rejected.
    expect(
      TriageVerdict.safeParse({
        naics: "x",
        contractType: "FFP",
        feasibilityScore: 11,
        zeroFloatFit: true,
        summary: "s",
        recommendation: "PURSUE",
      }).success,
    ).toBe(false);
    expect(
      TriageVerdict.safeParse({
        naics: "x",
        contractType: "BOGUS",
        feasibilityScore: 5,
        zeroFloatFit: true,
        summary: "s",
        recommendation: "PURSUE",
      }).success,
    ).toBe(false);
  });

  it("ProspectScore rejects a score above 100", () => {
    expect(
      ProspectScore.safeParse({ score: 200, capabilityMatch: 0.5, recommendation: "PURSUE" }).success,
    ).toBe(false);
  });

  it("QuoteRanking requires at least one ranking", () => {
    expect(QuoteRanking.safeParse({ rankings: [] }).success).toBe(false);
    expect(
      QuoteRanking.safeParse({
        rankings: [{ quoteId: "q", rank: 1, score: 50, rationale: "r" }],
      }).success,
    ).toBe(true);
  });

  it("SowBrief requires at least one key requirement", () => {
    expect(SowBrief.safeParse({ title: "t", summary: "s", keyRequirements: [] }).success).toBe(false);
    expect(
      SowBrief.safeParse({ title: "t", summary: "s", keyRequirements: ["a"] }).success,
    ).toBe(true);
  });

  it("ProposalNarrative requires the prose sections", () => {
    expect(
      ProposalNarrative.safeParse({
        executiveSummary: "e",
        technicalApproach: "t",
        managementApproach: "m",
        pastPerformanceNarrative: "p",
      }).success,
    ).toBe(true);
    expect(ProposalNarrative.safeParse({ executiveSummary: "e" }).success).toBe(false);
  });
});
