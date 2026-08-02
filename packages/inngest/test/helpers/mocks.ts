/**
 * Mock LogicDeps: canned, schema-valid AI outputs plus vi.fn() spies for the email senders and the
 * SSRF-guarded fetch. Tests assert on the spies (e.g. "sendOutreachEmail was never called during triage")
 * and override individual AI methods per case (e.g. to throw FailClosedError).
 */
import { vi, type Mock } from "vitest";

import { assembleBidPackage, assembleSubcontractPackage } from "@hermes/ai";
import type {
  CapabilityStatementDraft,
  ComplianceMatrix,
  ProposalNarrative,
  ProspectScore,
  SowBrief,
  SubcontractNarrative,
  TriageVerdict,
} from "@hermes/ai";

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

/** A canned (prose-only) subcontract narrative; the real engine assembles the deterministic FAR flow-down
 *  list + milestone schedule around it. */
const DEFAULT_SUBCONTRACT_NARRATIVE: SubcontractNarrative = {
  scopeOfWork: "Provide tiered IT support per the awarded solicitation scope.",
  periodOfPerformanceSummary: "Twelve months from award; paid on milestone completion.",
  paymentScheduleSummary: "Paid on completion of each milestone below.",
  protectiveTerms: [
    { term: "Indemnification", body: "Each party indemnifies the other for its own negligent acts." },
    { term: "Insurance Requirements", body: "Subcontractor carries commercial general liability." },
    { term: "Confidentiality", body: "Both parties keep non-public information confidential." },
    { term: "Intellectual Property / Work-Product Ownership", body: "Work product vests in the prime." },
    { term: "Termination for Convenience", body: "Either party may terminate on 30 days notice." },
    { term: "Termination for Cause", body: "Immediate termination on uncured material breach." },
    { term: "Warranty", body: "Services performed in a workmanlike manner." },
    { term: "Dispute Resolution and Governing Law", body: "Governed by the laws of the performance state." },
  ],
};

/** §3.8.1: a canned (prose-only) capability-statement draft — no pricing, no commitments. */
const DEFAULT_CAPABILITY_STATEMENT: CapabilityStatementDraft = {
  organizationOverview: "Small-business federal IT services provider.",
  relevantExperience: "Prior tiered IT support engagements.",
  technicalCapabilities: "Help desk, endpoint management, cloud migration.",
  differentiators: ["Founder-led", "Fast onboarding"],
};

/** §3.8.3: a canned Section L/M compliance matrix — informative extraction only. */
const DEFAULT_COMPLIANCE_MATRIX: ComplianceMatrix = {
  sectionLFound: true,
  sectionMFound: true,
  items: [
    {
      reference: "Section L.3.1",
      category: "INSTRUCTIONS_TO_OFFERORS",
      requirement: "Submit a technical volume not to exceed 20 pages.",
      proposalSectionMapping: "Volume I — Technical",
    },
    {
      reference: "Section M.1",
      category: "EVALUATION_CRITERIA",
      requirement: "Technical approach is more important than price.",
    },
  ],
  notes: "Two-volume submission required.",
};

export interface TestDeps {
  deps: LogicDeps;
  sendOutreachEmail: Mock;
  sendBriefEmail: Mock;
  fetchDoc: Mock;
  /** Spy for sendLossNotification (a separate, narrower deps shape — see logic.ts). */
  sendLossNotificationEmail: Mock;
}

export function makeDeps(ai: Partial<LogicDeps["ai"]> = {}): TestDeps {
  const sendOutreachEmail = vi.fn(async () => ({ id: "email_test" }));
  const sendBriefEmail = vi.fn(async () => ({ id: "brief_test" }));
  const fetchDoc = vi.fn(async () => ({ bytes: new Uint8Array(), contentType: "application/json" }));
  const sendLossNotificationEmail = vi.fn(async () => ({ id: "loss_email_test" }));

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
    // Default: assemble a real (deterministic) subcontract package around a canned narrative — no model
    // call, so tests exercise the genuine FAR flow-down assembly. Override per-case to throw FailClosedError.
    draftSubcontractAgreement:
      ai.draftSubcontractAgreement ??
      (async (input) =>
        assembleSubcontractPackage({
          narrative: DEFAULT_SUBCONTRACT_NARRATIVE,
          contractType: input.contractType,
          totalValueUsd: input.totalValueUsd,
          milestones: input.milestones,
          flowDown: input.flowDown,
          provisionalRatesMode: input.provisionalRatesMode,
        })),
    draftCapabilityStatement: ai.draftCapabilityStatement ?? (async () => DEFAULT_CAPABILITY_STATEMENT),
    extractComplianceMatrix: ai.extractComplianceMatrix ?? (async () => DEFAULT_COMPLIANCE_MATRIX),
  };

  return {
    deps: { ai: fullAi, sendOutreachEmail, sendBriefEmail, fetchDoc },
    sendOutreachEmail,
    sendBriefEmail,
    fetchDoc,
    sendLossNotificationEmail,
  };
}
