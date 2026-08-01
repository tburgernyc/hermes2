/**
 * packages/ai/src/subcontract.ts — the DETERMINISTIC subcontract-agreement assembler (CLAUDE.md §3.1 item
 * 4 / counsel brief pattern). A DB row in `contracts` is not a contract: this module drafts the actual
 * legal document text that will be reviewed by the admin, then (only after that explicit review) sent to
 * the vendor for e-signature. The language model (engine.draftSubcontractAgreement) writes PROSE only —
 * the scope-of-work narrative and the protective-terms body text; every other fact here (which FAR
 * flow-down clauses apply, the payment-milestone schedule, the dollar amounts) is computed
 * deterministically from the awarded contract data the caller supplies. The model never decides
 * compliance or clause applicability (Prime Directive §2). DB-free: all inputs arrive as parameters.
 *
 * FAR flow-down source (verified 2026-08-01, cited per clause below):
 *   - Acquisition.gov, FAR 52.244-6(c)(1) — "Subcontracts for Commercial Products and Commercial
 *     Services" — the clause that identifies which FAR provisions a prime must flow down to a commercial-
 *     services subcontract, and each clause's own applicability condition. https://www.acquisition.gov/far/52.244-6
 *   - FAR 19.702(a) subcontracting-plan dollar threshold ($900,000 general / $2,000,000 construction,
 *     2026 inflation adjustment) — Federal Register, "Federal Acquisition Regulation: Inflation Adjustment
 *     of Acquisition-Related Thresholds" (2025-08-27), applied 2026.
 *   - FAR 3.1004(a) / 52.203-13 business-ethics-program dollar threshold (~$6,000,000, 120+ day PoP) —
 *     Acquisition.gov FAR 52.203-13 + FAR Subpart 3.10.
 * This is a candidate/starting set derived from the GENERAL commercial-services flow-down rule, NOT a
 * clause-by-clause read of the actual awarded prime contract (Hermes does not ingest the prime contract's
 * full clause schedule). It is watermarked PROVISIONAL/pendingCounsel and MUST be confirmed by the human
 * operator / external counsel against the actual awarded contract before the agreement is finalized —
 * exactly the same posture as every other compliance output in this codebase (CLAUDE.md §6).
 */
import type { SubcontractNarrative } from "./schemas.js";
import type { ContractType } from "./compliance.js";

/* ---------- FAR flow-down clause list (FAR 52.244-6(c)(1), commercial services) ---------- */

export interface FarFlowDownClause {
  clause: string; // e.g. "FAR 52.222-50"
  title: string;
  /** The clause's own applicability condition, as stated in FAR 52.244-6(c)(1) / the clause itself. */
  condition: string;
  /** Best-effort deterministic evaluation from the known contract facts. Always confirm against the
   *  actual awarded prime contract's clause schedule (counsel/admin) before relying on this. */
  applies: boolean;
}

export interface FlowDownInput {
  /** The subcontract's total value (drives the two dollar-threshold clauses below). */
  valueUsd: number;
  /** Period of performance in days, if known. Unknown (null) is treated CONSERVATIVELY (include). */
  popDays: number | null;
  /** Whether the subcontractor is itself a small business (drives FAR 52.232-40). Unknown (undefined) is
   *  treated conservatively (include — the firm's subs are typically small, per contracts.accelerated_payments
   *  defaulting true). */
  vendorIsSmallBusiness?: boolean;
}

const SUBCONTRACTING_PLAN_THRESHOLD_USD = 900_000; // FAR 19.702(a), 2026 inflation adjustment
const BUSINESS_ETHICS_THRESHOLD_USD = 6_000_000; // FAR 3.1004(a) / 52.203-13
const BUSINESS_ETHICS_MIN_POP_DAYS = 120;

/**
 * Derive the candidate FAR flow-down clause list for a commercial-IT-services subcontract (FAR
 * 52.244-6(c)(1)). Returns EVERY clause considered, each carrying its own applicability condition and a
 * best-effort `applies` evaluation — never silently omits a clause the caller should review. Deterministic:
 * no model input reaches this function.
 */
export function deriveFarFlowDownClauses(input: FlowDownInput): FarFlowDownClause[] {
  const popOver120 = input.popDays === null ? true : input.popDays > BUSINESS_ETHICS_MIN_POP_DAYS;
  const smallBusiness = input.vendorIsSmallBusiness !== false; // undefined/true => conservatively include

  return [
    {
      clause: "FAR 52.203-13",
      title: "Contractor Code of Business Ethics and Conduct",
      condition: `Subcontract value exceeds the FAR 3.1004(a) threshold (~$${BUSINESS_ETHICS_THRESHOLD_USD.toLocaleString()}) AND period of performance exceeds ${BUSINESS_ETHICS_MIN_POP_DAYS} days.`,
      applies: input.valueUsd > BUSINESS_ETHICS_THRESHOLD_USD && popOver120,
    },
    {
      clause: "FAR 52.203-15",
      title: "Whistleblower Protections Under the American Recovery and Reinvestment Act of 2009",
      condition: "Only if the subcontract is funded under the Recovery Act.",
      applies: false, // Hermes never sources ARRA-funded work
    },
    {
      clause: "FAR 52.203-17",
      title: "Contractor Employee Whistleblower Rights",
      condition:
        "Applies unless the prime contract is with DoD, NASA, the Coast Guard, or an intelligence-community agency — confirm against the awarded agency.",
      applies: true,
    },
    {
      clause: "FAR 52.203-19",
      title: "Prohibition on Requiring Certain Internal Confidentiality Agreements",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.204-21",
      title: "Basic Safeguarding of Covered Contractor Information Systems",
      condition: "Applies unless the subcontract is exclusively for commercially available off-the-shelf items.",
      applies: true,
    },
    {
      clause: "FAR 52.204-23",
      title:
        "Prohibition on Contracting for Hardware, Software, and Services Developed or Provided by Kaspersky Lab",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.204-25",
      title: "Prohibition on Certain Telecommunications and Video Surveillance Services or Equipment",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.204-27",
      title: "Prohibition on ByteDance Covered Applications",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.204-30",
      title: "Federal Acquisition Supply Chain Security Act Orders—Prohibition",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.219-8",
      title: "Utilization of Small Business Concerns",
      condition: `Only if this subcontract itself offers further subcontracting opportunities AND its value exceeds the FAR 19.702(a) threshold (currently $${SUBCONTRACTING_PLAN_THRESHOLD_USD.toLocaleString()}, 2026 inflation adjustment).`,
      applies: input.valueUsd > SUBCONTRACTING_PLAN_THRESHOLD_USD,
    },
    {
      clause: "FAR 52.222-21",
      title: "Prohibition of Segregated Facilities",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    { clause: "FAR 52.222-26", title: "Equal Opportunity", condition: "Applies to all subcontracts.", applies: true },
    {
      clause: "FAR 52.222-35",
      title: "Equal Opportunity for Veterans",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.222-36",
      title: "Equal Opportunity for Workers with Disabilities",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.222-37",
      title: "Employment Reports on Veterans",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.222-40",
      title: "Notification of Employee Rights Under the National Labor Relations Act",
      condition: "Flows down per FAR 52.222-40(f) to non-exempt subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.222-50",
      title: "Combating Trafficking in Persons",
      condition: "Applies to every subcontract, at every tier and every dollar value.",
      applies: true,
    },
    {
      clause: "FAR 52.222-55",
      title: "Minimum Wages Under Executive Order 14026",
      condition: "Flows down per FAR 52.222-55(k) to subcontracts covered by the EO (most services contracts).",
      applies: true,
    },
    {
      clause: "FAR 52.222-62",
      title: "Paid Sick Leave Under Executive Order 13706",
      condition: "Flows down per FAR 52.222-62(m) to subcontracts covered by the EO.",
      applies: true,
    },
    {
      clause: "FAR 52.224-3",
      title: "Privacy Training",
      condition:
        "Flows down per FAR 52.224-3(f) when subcontract employees will access a Privacy Act system of records or handle PII.",
      applies: true,
    },
    {
      clause: "FAR 52.225-26",
      title: "Contractors Performing Private Security Functions Outside the United States",
      condition: "Only if performance occurs outside the United States.",
      applies: false, // Hermes targets domestic federal IT services
    },
    {
      clause: "FAR 52.232-40",
      title: "Providing Accelerated Payments to Small Business Subcontractors",
      condition: "Flows down per FAR 52.232-40(c) when the subcontractor is itself a small business concern.",
      applies: smallBusiness,
    },
    {
      clause: "FAR 52.240-1",
      title:
        "Prohibition on Unmanned Aircraft Systems Manufactured by American Security Drone Act-Covered Foreign Entities",
      condition: "Applies to all subcontracts.",
      applies: true,
    },
    {
      clause: "FAR 52.247-64",
      title: "Preference for Privately Owned U.S.-Flag Commercial Vessels",
      condition: "Flows down per FAR 52.247-64(d) only when the subcontract involves ocean transportation of supplies.",
      applies: false, // IT services — no ocean transportation
    },
  ];
}

/** The clauses that actually apply, given the input facts (still pendingCounsel — see the module header). */
export function applicableFlowDownClauses(input: FlowDownInput): FarFlowDownClause[] {
  return deriveFarFlowDownClauses(input).filter((c) => c.applies);
}

/* ---------- Standard protective terms every subcontract agreement must address ---------- */

export const STANDARD_PROTECTIVE_TERMS = [
  "Indemnification",
  "Insurance Requirements",
  "Confidentiality",
  "Intellectual Property / Work-Product Ownership",
  "Termination for Convenience",
  "Termination for Cause",
  "Warranty",
  "Dispute Resolution and Governing Law",
] as const;

/* ---------- Payment/milestone schedule (from the contracts/contract_milestones rows) ---------- */

export interface SubcontractMilestoneInput {
  sequence: number;
  description: string;
  amount: number | null;
  dueDate: Date | null;
}

/* ---------- The assembled subcontract package ---------- */

export const SUBCONTRACT_DISCLAIMER =
  "DRAFT subcontract agreement for admin + external-counsel review. This is NOT a binding document and " +
  "must NOT be sent to the vendor until an admin explicitly reviews/edits it (CLAUDE.md §2/§6 — the same " +
  "care as the counsel-review gate on the government-facing proposal). The FAR flow-down clause list is a " +
  "deterministic CANDIDATE set derived from the general FAR 52.244-6(c)(1) commercial-services flow-down " +
  "rule, not a clause-by-clause read of the actual awarded prime contract, and MUST be confirmed against " +
  "that contract by the human operator / counsel before execution. No e-signature flow starts automatically.";

export interface SubcontractExportSection {
  heading: string;
  body: string;
}

export interface SubcontractPackage {
  narrative: SubcontractNarrative;
  flowDownClauses: FarFlowDownClause[]; // every clause considered, applies flag included
  applicableFlowDownClauses: FarFlowDownClause[];
  milestones: SubcontractMilestoneInput[];
  totalValueUsd: number;
  contractType: ContractType;
  provisional: boolean;
  watermark?: string;
  disclaimer: string;
  requiresAdminReview: true;
  exportSections: SubcontractExportSection[];
}

export interface AssembleSubcontractInput {
  narrative: SubcontractNarrative;
  contractType: ContractType;
  totalValueUsd: number;
  milestones: SubcontractMilestoneInput[];
  flowDown: FlowDownInput;
  provisionalRatesMode?: boolean;
}

/**
 * Deterministically assemble the full subcontract package from an already-drafted narrative (the model
 * wrote the prose) plus the FAR flow-down inputs and the milestone schedule. No model value decides clause
 * applicability or any dollar figure. Watermarked under provisional mode, exactly like the pricing/bid
 * packages, and ALWAYS carries requiresAdminReview: true — the admin review gate is enforced structurally
 * by the `contracts_esign_requires_review` DB CHECK (Phase A), not by this flag alone.
 */
export function assembleSubcontractPackage(input: AssembleSubcontractInput): SubcontractPackage {
  const provisional = input.provisionalRatesMode ?? true;
  const flowDownClauses = deriveFarFlowDownClauses(input.flowDown);
  const applicable = flowDownClauses.filter((c) => c.applies);

  return {
    narrative: input.narrative,
    flowDownClauses,
    applicableFlowDownClauses: applicable,
    milestones: input.milestones,
    totalValueUsd: input.totalValueUsd,
    contractType: input.contractType,
    provisional,
    watermark: provisional
      ? "PROVISIONAL — illustrative pendingCounsel FAR flow-down candidate set, NOT for execution"
      : undefined,
    disclaimer: SUBCONTRACT_DISCLAIMER,
    requiresAdminReview: true,
    exportSections: buildExportSections(input.narrative, applicable, input.milestones, input.totalValueUsd, provisional),
  };
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function buildExportSections(
  narrative: SubcontractNarrative,
  applicableClauses: FarFlowDownClause[],
  milestones: SubcontractMilestoneInput[],
  totalValueUsd: number,
  provisional: boolean,
): SubcontractExportSection[] {
  const milestoneBody = milestones.length
    ? milestones
        .map(
          (m) =>
            `${m.sequence}. ${m.description} — ${m.amount != null ? money(m.amount) : "amount TBD"}` +
            `${m.dueDate ? ` (due ${m.dueDate.toISOString().slice(0, 10)})` : ""}`,
        )
        .join("\n")
    : "No milestones defined.";

  const clauseBody = applicableClauses.length
    ? applicableClauses.map((c) => `${c.clause} — ${c.title}. ${c.condition}`).join("\n")
    : "No flow-down clauses determined applicable — review manually.";

  return [
    { heading: "Scope of Work", body: narrative.scopeOfWork },
    { heading: "Period of Performance", body: narrative.periodOfPerformanceSummary },
    {
      heading: "Payment Schedule",
      body: `${narrative.paymentScheduleSummary}\n\nTotal subcontract value: ${money(totalValueUsd)}\n\nMilestones:\n${milestoneBody}`,
    },
    ...narrative.protectiveTerms.map((t) => ({ heading: t.term, body: t.body })),
    {
      heading: provisional
        ? "FAR Flow-Down Clauses (candidate — pending counsel)"
        : "FAR Flow-Down Clauses",
      body: clauseBody,
    },
  ];
}

/**
 * Render the assembled package to a plain-text document for storage as the SUBCONTRACT_DRAFT `documents`
 * row. Deterministic, no model/network call — the actual DOCX/PDF polish (mirroring exportProposalDoc /
 * exportBidDoc) is a later on-demand step; the review surface needs real bytes to store NOW, at draft
 * time, and a plain-text rendering keeps the drafting workflow testable without the code-execution tool.
 */
export function renderSubcontractDraftText(
  pkg: SubcontractPackage,
  meta: { orgName: string; vendorName: string; solicitationTitle: string },
): string {
  const lines: string[] = [];
  lines.push(`SUBCONTRACT AGREEMENT (DRAFT — ${pkg.provisional ? "PROVISIONAL, PENDING COUNSEL" : "FINAL"})`);
  lines.push(`Prime: ${meta.orgName}`);
  lines.push(`Subcontractor: ${meta.vendorName}`);
  lines.push(`Solicitation: ${meta.solicitationTitle}`);
  lines.push(`Contract type: ${pkg.contractType}`);
  lines.push(`Total subcontract value: ${money(pkg.totalValueUsd)}`);
  if (pkg.watermark) lines.push(`\n[WATERMARK] ${pkg.watermark}`);
  lines.push("");
  for (const section of pkg.exportSections) {
    lines.push(`## ${section.heading}`);
    lines.push(section.body);
    lines.push("");
  }
  lines.push("---");
  lines.push(pkg.disclaimer);
  return lines.join("\n");
}
