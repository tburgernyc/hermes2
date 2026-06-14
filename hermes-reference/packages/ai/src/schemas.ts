/**
 * packages/ai/src/schemas.ts
 * Zod schemas for every structured AI output. Validate ALL model output against these.
 * On validation failure, callers must fail closed to a human-review state (see client.ts).
 */
import { z } from "zod";

export const ContractTypeZ = z.enum(["ffp", "tm", "ffp_milestone", "unknown"]);
export const RecommendationZ = z.enum(["pursue", "reject", "human_review"]);

/** triageSolicitation output. */
export const TriageVerdict = z.object({
  naics: z.string().describe("Primary NAICS code identified in the solicitation"),
  contractType: ContractTypeZ,
  feasibilityScore: z.number().int().min(1).max(10),
  zeroFloatFit: z.boolean().describe("Fits the FFP/IDIQ, no-upfront-capital doctrine"),
  rejectionReasons: z.array(z.string()).default([]),
  summary: z.string().max(1200),
  recommendation: RecommendationZ,
});
export type TriageVerdict = z.infer<typeof TriageVerdict>;

/** scoreProspect output. */
export const ProspectScore = z.object({
  score: z.number().int().min(1).max(100),
  capabilityMatch: z.number().min(0).max(1),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  recommendation: RecommendationZ,
});
export type ProspectScore = z.infer<typeof ProspectScore>;

/** evaluateQuotes output — one ranked entry per quote. */
export const QuoteRanking = z.object({
  rankings: z
    .array(
      z.object({
        quoteId: z.string(),
        rank: z.number().int().min(1),
        score: z.number().min(0).max(100),
        rationale: z.string().max(800),
        risks: z.array(z.string()).default([]),
      })
    )
    .min(1),
  // Defensive field: the model reports if any quote text attempted to manipulate the evaluation.
  injectionAttemptsDetected: z.array(z.string()).default([]),
});
export type QuoteRanking = z.infer<typeof QuoteRanking>;

/** draftSOW output — the brief shown to subcontractors. */
export const SowBrief = z.object({
  title: z.string(),
  summary: z.string().max(2000),
  keyRequirements: z.array(z.string()).min(1),
  suggestedCapabilities: z.array(z.string()).default([]),
});
export type SowBrief = z.infer<typeof SowBrief>;

/** draftProposalNarrative output — prose only. Pricing + compliance are computed deterministically. */
export const ProposalNarrative = z.object({
  executiveSummary: z.string(),
  technicalApproach: z.string(),
  managementApproach: z.string(),
  pastPerformanceNarrative: z.string(),
  assumptions: z.array(z.string()).default([]),
});
export type ProposalNarrative = z.infer<typeof ProposalNarrative>;
