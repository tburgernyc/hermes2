/**
 * packages/ai/src/schemas.ts — Zod schemas for every structured AI output. Validate ALL model output
 * against these; on failure, callers fail closed to a human-review state (see client.callStructured).
 * Enum values use the codebase's UPPERCASE convention so they map cleanly to the DB enums downstream.
 */
import { z } from "zod";

/** Maps to the DB `contract_type` enum, plus UNKNOWN when the model can't determine it. */
export const ContractTypeZ = z.enum(["FFP", "TM", "FFP_MILESTONE", "UNKNOWN"]);
export const RecommendationZ = z.enum(["PURSUE", "REJECT", "HUMAN_REVIEW"]);

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
      }),
    )
    .min(1),
  // Defensive field: the model reports any quote text that attempted to manipulate the evaluation.
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

/** draftProposal narrative — prose only. Pricing + compliance are computed deterministically. */
export const ProposalNarrative = z.object({
  executiveSummary: z.string(),
  technicalApproach: z.string(),
  managementApproach: z.string(),
  pastPerformanceNarrative: z.string(),
  assumptions: z.array(z.string()).default([]),
});
export type ProposalNarrative = z.infer<typeof ProposalNarrative>;

/**
 * draftSubcontractAgreement narrative (§3.1.4) — prose only. The FAR flow-down clause list, the period of
 * performance / payment-milestone summary structure, and every dollar amount are computed deterministically
 * (subcontract.ts); the model drafts the scope-of-work prose and the protective-terms body text for each
 * standard section. It must not invent facts, dollar amounts, or legal conclusions.
 */
export const SubcontractNarrative = z.object({
  scopeOfWork: z.string(),
  periodOfPerformanceSummary: z.string(),
  paymentScheduleSummary: z.string(),
  protectiveTerms: z
    .array(z.object({ term: z.string(), body: z.string() }))
    .min(1)
    .describe(
      "One entry per standard protective term: indemnification, insurance requirements, confidentiality, " +
        "IP/work-product ownership, termination for convenience, termination for cause, warranty, and " +
        "dispute resolution/governing law.",
    ),
});
export type SubcontractNarrative = z.infer<typeof SubcontractNarrative>;

/**
 * draftCapabilityStatement output (§3.8.1 sources-sought/RFI track) — prose only, no pricing, no
 * commitments. Responds to a sources-sought/RFI notice with WHO the firm is and WHY it is capable,
 * never a priced bid. This is a DRAFT for human review; RESPONSE_SUBMITTED is recorded by a human, never
 * automatic (CLAUDE.md §2).
 */
export const CapabilityStatementDraft = z.object({
  organizationOverview: z.string().max(2000),
  relevantExperience: z.string().max(2000),
  technicalCapabilities: z.string().max(2000),
  differentiators: z.array(z.string()).default([]),
});
export type CapabilityStatementDraft = z.infer<typeof CapabilityStatementDraft>;

/**
 * extractComplianceMatrix output (§3.8.3) — Section L (instructions to offerors) / Section M (evaluation
 * criteria) requirements parsed out of the raw solicitation `scopeText` into a structured checklist. This
 * is INFORMATIVE/STRUCTURING output only: it does not gate or block anything by itself. It exists so the
 * existing human compliance-review gate (§3.2) has something concrete to check the drafted proposal
 * against, instead of a human re-reading the entire solicitation from scratch.
 */
export const ComplianceMatrixCategory = z.enum(["INSTRUCTIONS_TO_OFFERORS", "EVALUATION_CRITERIA", "OTHER"]);

export const ComplianceMatrixItem = z.object({
  reference: z.string().max(120).describe("e.g. 'Section L.3.2' or 'Section M.1' or 'Not sectioned'"),
  category: ComplianceMatrixCategory,
  requirement: z.string().max(600),
  proposalSectionMapping: z
    .string()
    .max(200)
    .optional()
    .describe("Which proposal volume/section this requirement maps to, if the solicitation states one"),
});
export type ComplianceMatrixItem = z.infer<typeof ComplianceMatrixItem>;

export const ComplianceMatrix = z.object({
  sectionLFound: z.boolean().describe("Whether a Section L (instructions to offerors) was identified"),
  sectionMFound: z.boolean().describe("Whether a Section M (evaluation criteria) was identified"),
  items: z.array(ComplianceMatrixItem).default([]),
  notes: z.string().max(1000).optional(),
});
export type ComplianceMatrix = z.infer<typeof ComplianceMatrix>;
