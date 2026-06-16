/**
 * packages/ai/src/bid.ts — the DETERMINISTIC bid-drafting compliance checklist + package assembler
 * (CLAUDE.md §6, counsel brief §3). The bid-drafting module's job is to ELIMINATE self-inflicted
 * disqualifiers; it produces a DRAFT checklist result + reviewer notes for the human operator AND external
 * counsel. It must NEVER assert the bid "is compliant", "won't be flagged", or "will win", and must NOT
 * assert legal conclusions (CLAUDE.md §6). The language model writes prose only (engine.draftBid →
 * ProposalNarrative); every gate here is computed deterministically — the model never decides compliance
 * (Prime Directive §2). DB-free: all inputs arrive as parameters (the firm's validated OrgDirectives values
 * + the parsed solicitation). Under provisionalRatesMode every output is watermarked and NOT for submission.
 */
import type { ProposalNarrative } from "./schemas.js";
import {
  buildComplianceChecklist,
  readyForLiveSubmission,
  type ChecklistContext,
  type ChecklistItem,
  type ContractType,
  type SubmissionGates,
} from "./compliance.js";
import { buildPricingBrief, type IndirectRates, type PricingBrief, type QuoteLine } from "./pricing.js";

/** Money compared to the cent — bid arithmetic must reconcile exactly, not approximately. */
const DEFAULT_TOLERANCE_USD = 0.01;

/** The standing anti-overclaim disclaimer (counsel brief §3): a draft for human + counsel, never a verdict. */
export const BID_DISCLAIMER =
  "DRAFT compliance checklist + reviewer notes for the human operator and external counsel. This module " +
  "eliminates self-inflicted disqualifiers; it does NOT assert the bid is compliant, will not be flagged, " +
  "or will win, and it asserts no legal conclusions (CLAUDE.md §6). All thresholds are PENDING COUNSEL " +
  "CONFIRMATION. No bid is submitted without human signature and external-counsel review.";

/* ---------- Form-type profile (counsel brief §6.6) — Part 12 commercial vs Part 15 UCF ---------- */
export type SolicitationFormType = "UCF_PART15" | "COMMERCIAL_PART12";

export interface FormProfile {
  formType: SolicitationFormType;
  instructionsRef: string; // bare cite: FAR 15.204-5(b) | FAR 52.212-1
  evaluationRef: string; // bare cite: FAR 15.204-5(c)/15.304(e) | FAR 52.212-2
  /**
   * Checklist item labels — form-aware. UCF (Part 15) buys use "Section L / Section M"; commercial (Part
   * 12) buys do NOT — FAR 52.212-1/2 REPLACE the UCF sections, so there is no Section L/M on an SF1449 buy
   * (counsel brief §6.6 / FAR 12.303). Labeling a commercial clause "Section L" would be a self-contradiction.
   */
  instructionsItemLabel: string;
  evaluationItemLabel: string;
  /**
   * Part 12 (commercial) failure mode is "nonresponsive"; a Part 15 negotiated buy's failure mode is
   * "technically unacceptable / outside the competitive range" — never legally label a Part 15 proposal
   * "nonresponsive" (counsel brief §3). Drives disqualifier wording, not any gate.
   */
  disqualifierLabel: string;
  forms: string[]; // SF1449 (commercial) | SF33 (UCF)
}

/**
 * Resolve the instruction/evaluation references, the form-aware checklist labels, and the correct
 * disqualifier wording for the solicitation's form. `rfoRenumber` selects the Request-for-Offer renumbered
 * cites (L→15.109-4(b), M→15.109-4(c)).
 */
export function solicitationFormProfile(
  formType: SolicitationFormType,
  opts?: { rfoRenumber?: boolean },
): FormProfile {
  if (formType === "COMMERCIAL_PART12") {
    const instructionsRef = "FAR 52.212-1 (commercial instructions)";
    const evaluationRef = "FAR 52.212-2 (commercial evaluation)";
    return {
      formType,
      instructionsRef,
      evaluationRef,
      instructionsItemLabel: `Instructions to offerors conformance (${instructionsRef})`,
      evaluationItemLabel: `Evaluation-factor coverage (${evaluationRef})`,
      disqualifierLabel: "nonresponsive",
      forms: ["SF1449"],
    };
  }
  const rfo = opts?.rfoRenumber ?? false;
  const instructionsRef = rfo ? "FAR 15.109-4(b)" : "FAR 15.204-5(b)";
  const evaluationRef = rfo ? "FAR 15.109-4(c)" : "FAR 15.204-5(c) / 15.304(e)";
  return {
    formType,
    instructionsRef,
    evaluationRef,
    instructionsItemLabel: `Section L format conformance (${instructionsRef})`,
    evaluationItemLabel: `Section M factor coverage (${evaluationRef})`,
    disqualifierLabel: "technically unacceptable / outside the competitive range",
    forms: ["SF33"],
  };
}

/* ---------- §3.5 Pricing-math reconciliation (deterministic recompute → BLOCK on mismatch) ---------- */
export interface BidLineItem {
  clin: string; // Contract Line Item Number (or SLIN)
  description?: string;
  unitRate: number;
  quantity: number;
  extendedAmount: number; // as STATED in the bid — recomputed and compared
  group?: "BASE" | "OPTION"; // for the base + options = grand total reconciliation
}

export interface PricingMathResult {
  reconciled: boolean; // false → BLOCK (a self-inflicted disqualifier)
  lineErrors: { clin: string; stated: number; computed: number }[];
  computedGrandTotal: number;
  statedGrandTotal: number;
  grandTotalMismatch: boolean;
  baseOptionsMismatch: boolean;
  crossTotalMismatch: boolean; // an externally-cited / cross-volume total disagrees with the grand total
  nonFinite: boolean; // any NaN/Infinity money value → fail closed (BLOCK), never a silent pass
  note: string;
}

const isFiniteNum = (n: number): boolean => Number.isFinite(n);

/**
 * The reconciliation tolerance is itself load-bearing — money must reconcile TO THE CENT (counsel brief
 * §3.5). A caller may only make the gate STRICTER (a smaller tolerance), never looser: a huge value would
 * hide a real mismatch (fail-open) and a negative value would flag a perfect bid. Clamp to [0, one cent];
 * reject negative/non-finite back to the cent default.
 */
function clampTolerance(toleranceUsd?: number): number {
  if (toleranceUsd === undefined || !isFiniteNum(toleranceUsd) || toleranceUsd < 0) {
    return DEFAULT_TOLERANCE_USD;
  }
  return Math.min(toleranceUsd, DEFAULT_TOLERANCE_USD);
}

/**
 * Deterministically recompute the bid arithmetic (counsel brief §3.5): per line `unit × qty = extended`
 * (a LABOR CLIN expresses this as hours × burdened rate = cost — the same check); `Σ extended = grand
 * total`; `base + options = grand total` when those subtotals are stated; and each `externallyCitedTotal`
 * (a cost-volume/SF1449/SF33 face value cited elsewhere) must equal the grand total. Any mismatch beyond
 * the cent tolerance is a BLOCK. Non-finite (NaN/Infinity) money — what an empty/non-numeric upstream parse
 * coerces to — FAILS CLOSED (BLOCK), never a silent pass.
 */
export function reconcilePricingMath(input: {
  lines: BidLineItem[];
  statedGrandTotal: number;
  statedBaseTotal?: number;
  statedOptionsTotal?: number;
  /** Totals cited elsewhere (cost-volume total, SF1449/SF33 face value) — each must equal the grand total. */
  externallyCitedTotals?: number[];
  toleranceUsd?: number;
}): PricingMathResult {
  const tol = clampTolerance(input.toleranceUsd);

  // A line is in error if any of its money values is non-finite OR unit × qty ≠ extended.
  const lineErrors = input.lines
    .filter(
      (l) =>
        !isFiniteNum(l.unitRate) ||
        !isFiniteNum(l.quantity) ||
        !isFiniteNum(l.extendedAmount) ||
        Math.abs(l.extendedAmount - l.unitRate * l.quantity) > tol,
    )
    .map((l) => ({ clin: l.clin, stated: l.extendedAmount, computed: l.unitRate * l.quantity }));

  const computedGrandTotal = input.lines.reduce((s, l) => s + l.extendedAmount, 0);
  const grandTotalMismatch =
    !isFiniteNum(computedGrandTotal) ||
    !isFiniteNum(input.statedGrandTotal) ||
    Math.abs(computedGrandTotal - input.statedGrandTotal) > tol;

  let baseOptionsMismatch = false;
  if (input.statedBaseTotal !== undefined || input.statedOptionsTotal !== undefined) {
    const base = input.lines
      .filter((l) => l.group !== "OPTION")
      .reduce((s, l) => s + l.extendedAmount, 0);
    const options = input.lines
      .filter((l) => l.group === "OPTION")
      .reduce((s, l) => s + l.extendedAmount, 0);
    const baseOk =
      input.statedBaseTotal === undefined ||
      (isFiniteNum(input.statedBaseTotal) && Math.abs(base - input.statedBaseTotal) <= tol);
    const optionsOk =
      input.statedOptionsTotal === undefined ||
      (isFiniteNum(input.statedOptionsTotal) && Math.abs(options - input.statedOptionsTotal) <= tol);
    const sumOk =
      isFiniteNum(base) && isFiniteNum(options) && Math.abs(base + options - input.statedGrandTotal) <= tol;
    baseOptionsMismatch = !(baseOk && optionsOk && sumOk);
  }

  const crossTotalMismatch = (input.externallyCitedTotals ?? []).some(
    (t) => !isFiniteNum(t) || Math.abs(t - input.statedGrandTotal) > tol,
  );

  const nonFinite =
    !isFiniteNum(input.statedGrandTotal) ||
    !isFiniteNum(computedGrandTotal) ||
    input.lines.some(
      (l) => !isFiniteNum(l.unitRate) || !isFiniteNum(l.quantity) || !isFiniteNum(l.extendedAmount),
    ) ||
    (input.statedBaseTotal !== undefined && !isFiniteNum(input.statedBaseTotal)) ||
    (input.statedOptionsTotal !== undefined && !isFiniteNum(input.statedOptionsTotal)) ||
    (input.externallyCitedTotals ?? []).some((t) => !isFiniteNum(t));

  const reconciled =
    lineErrors.length === 0 && !grandTotalMismatch && !baseOptionsMismatch && !crossTotalMismatch;

  const problems: string[] = [];
  if (nonFinite) problems.push("non-finite (NaN/Infinity) amount present");
  if (lineErrors.length) problems.push(`${lineErrors.length} line(s) where unit × qty ≠ extended`);
  if (grandTotalMismatch) problems.push("Σ extended ≠ stated grand total");
  if (baseOptionsMismatch) problems.push("base + options ≠ grand total");
  if (crossTotalMismatch) problems.push("an externally-cited total ≠ grand total");
  return {
    reconciled,
    lineErrors,
    computedGrandTotal,
    statedGrandTotal: input.statedGrandTotal,
    grandTotalMismatch,
    baseOptionsMismatch,
    crossTotalMismatch,
    nonFinite,
    note: reconciled
      ? "Pricing math reconciles (unit × qty = extended; Σ = grand total; base + options = grand total; cross-cited totals agree)."
      : `Pricing math does NOT reconcile — ${problems.join("; ")}. Fix before submission (BLOCK).`,
  };
}

/* ---------- §3.4 Amendments acknowledged (every SF30 → BLOCK if any unacknowledged) ---------- */
export interface AmendmentAck {
  amendmentNumber: string;
  acknowledged: boolean;
}

export function checkAmendmentsAcknowledged(amendments: AmendmentAck[]): {
  allAcknowledged: boolean;
  unacknowledged: string[];
  note: string;
} {
  const unacknowledged = amendments.filter((a) => !a.acknowledged).map((a) => a.amendmentNumber);
  const allAcknowledged = unacknowledged.length === 0;
  return {
    allAcknowledged,
    unacknowledged,
    note: allAcknowledged
      ? "All issued amendments (SF30) acknowledged."
      : `Unacknowledged amendment(s): ${unacknowledged.join(", ")} — acknowledge each SF30 (hard disqualifier, BLOCK).`,
  };
}

/* ---------- §3.1 Section L format conformance (WARN — excess pages may be discarded unread) ---------- */
export interface SectionLState {
  pageLimit?: number;
  actualPageCount?: number;
  requiredVolumes?: string[];
  providedVolumes?: string[];
  requiredForms?: string[]; // SF1449 / SF33 / SF18
  providedForms?: string[];
  dueDate?: Date | null;
  submissionMethod?: string | null;
}

export function checkSectionLConformance(s: SectionLState): {
  conformant: boolean;
  warnings: string[];
  note: string;
} {
  const warnings: string[] = [];
  if (s.pageLimit !== undefined && s.actualPageCount !== undefined && s.actualPageCount > s.pageLimit) {
    warnings.push(
      `Page count ${s.actualPageCount} exceeds the ${s.pageLimit}-page limit — excess pages may be discarded unread.`,
    );
  }
  const missingVolumes = (s.requiredVolumes ?? []).filter((v) => !(s.providedVolumes ?? []).includes(v));
  if (missingVolumes.length) warnings.push(`Missing required volume(s): ${missingVolumes.join(", ")}.`);
  const missingForms = (s.requiredForms ?? []).filter((f) => !(s.providedForms ?? []).includes(f));
  if (missingForms.length) warnings.push(`Missing required form(s): ${missingForms.join(", ")}.`);
  if (s.dueDate === null) warnings.push("Submission due date/time not captured.");
  if (s.submissionMethod === null) warnings.push("Submission method/portal not captured.");
  const conformant = warnings.length === 0;
  return {
    conformant,
    warnings,
    note: conformant ? "Section L format constraints satisfied." : warnings.join(" "),
  };
}

/* ---------- §3.2 Section M factor coverage (WARN on any unaddressed factor/subfactor) ---------- */
export interface EvalFactorMapping {
  factor: string;
  subfactor?: string;
  /** The proposal section that addresses this factor/subfactor; null/empty = unaddressed. */
  addressedInSection?: string | null;
}

export function checkSectionMCoverage(factors: EvalFactorMapping[]): {
  allAddressed: boolean;
  unaddressed: string[];
  crosswalk: { factor: string; section: string | null }[];
  note: string;
} {
  const label = (f: EvalFactorMapping): string => (f.subfactor ? `${f.factor} › ${f.subfactor}` : f.factor);
  const crosswalk = factors.map((f) => ({
    factor: label(f),
    section: f.addressedInSection && f.addressedInSection.length > 0 ? f.addressedInSection : null,
  }));
  const unaddressed = crosswalk.filter((c) => c.section === null).map((c) => c.factor);
  const allAddressed = unaddressed.length === 0;
  return {
    allAddressed,
    unaddressed,
    crosswalk,
    note: allAddressed
      ? "Every evaluation factor/subfactor is mapped to a proposal section."
      : `Unaddressed evaluation factor(s): ${unaddressed.join(", ")} — map each to a proposal section.`,
  };
}

/* ---------- §3.3 / §6.5 Reps & certs (SAM active + 12-month currency + solicitation-specific) ---------- */
export interface RepsAndCertsState {
  samActive: boolean; // FAR 52.204-7 (also a live-submission gate)
  repsCertsCurrentWithin12Months: boolean; // FAR 52.204-8(d)
  solicitationSpecificRepsComplete: boolean; // FAR 52.212-3 inserted reps — "SAM is current" ≠ done
}

export function checkRepsAndCerts(s: RepsAndCertsState): {
  complete: boolean;
  gaps: string[];
  note: string;
} {
  const gaps: string[] = [];
  if (!s.samActive) gaps.push("SAM registration not ACTIVE (FAR 52.204-7).");
  if (!s.repsCertsCurrentWithin12Months)
    gaps.push("Annual reps & certs not current within 12 months (FAR 52.204-8(d)).");
  if (!s.solicitationSpecificRepsComplete)
    gaps.push("Solicitation-specific / commercial-item reps (FAR 52.212-3) incomplete.");
  const complete = gaps.length === 0;
  return {
    complete,
    gaps,
    note: complete ? "Reps & certs complete (SAM active + current + solicitation-specific)." : gaps.join(" "),
  };
}

/* ---------- §3.7 No prohibited exceptions to material terms (BLOCK on a material exception) ---------- */
export interface ExceptionItem {
  term: string;
  material: boolean;
}

export function checkNoProhibitedExceptions(exceptions: ExceptionItem[]): {
  clean: boolean;
  materialExceptions: string[];
  note: string;
} {
  const materialExceptions = exceptions.filter((e) => e.material).map((e) => e.term);
  const clean = materialExceptions.length === 0;
  return {
    clean,
    materialExceptions,
    note: clean
      ? "No exception taken to material solicitation terms."
      : `Material exception(s) to: ${materialExceptions.join(", ")} — remove before submission (BLOCK).`,
  };
}

/* ---------- The §3 bid-drafting compliance checklist (pass/fail + reviewer notes) ---------- */
export interface BidChecklistContext {
  formType: SolicitationFormType;
  rfoRenumber?: boolean;
  pricingMath: {
    lines: BidLineItem[];
    statedGrandTotal: number;
    statedBaseTotal?: number;
    statedOptionsTotal?: number;
    externallyCitedTotals?: number[];
    toleranceUsd?: number;
  };
  amendments?: AmendmentAck[];
  sectionL?: SectionLState;
  sectionM?: EvalFactorMapping[];
  repsAndCerts?: RepsAndCertsState;
  exceptions?: ExceptionItem[];
  provisionalRatesMode?: boolean;
}

export interface BidChecklistResult {
  formProfile: FormProfile;
  checklist: ChecklistItem[];
  blocking: boolean;
  provisional: boolean;
  watermark?: string;
  pricingMath: PricingMathResult;
  disclaimer: string;
}

/**
 * Assemble the §3 bid checklist. BLOCKING items (would make the bid a self-inflicted disqualifier if
 * submitted as-is): amendments unacknowledged, pricing-math not reconciled, a material exception. Section
 * L/M and reps & certs are surfaced as WARN/advisory — SAM-active and counsel review block the ACTUAL bid
 * via readyForLiveSubmission, not the draft. Heuristics never block (CLAUDE.md §6). Output is for human +
 * counsel review; it never asserts the bid is compliant or will win.
 */
export function buildBidChecklist(ctx: BidChecklistContext): BidChecklistResult {
  const formProfile = solicitationFormProfile(ctx.formType, { rfoRenumber: ctx.rfoRenumber });
  const provisional = ctx.provisionalRatesMode ?? true;

  const pricingMath = reconcilePricingMath(ctx.pricingMath);
  const amendments = checkAmendmentsAcknowledged(ctx.amendments ?? []);
  const exceptions = checkNoProhibitedExceptions(ctx.exceptions ?? []);

  const checklist: ChecklistItem[] = [
    // BLOCK items first.
    { item: "Amendments acknowledged (SF30)", passed: amendments.allAcknowledged, note: amendments.note },
    { item: "Pricing-math reconciliation", passed: pricingMath.reconciled, note: pricingMath.note },
    { item: "No exception to material terms", passed: exceptions.clean, note: exceptions.note },
  ];

  // WARN/advisory items (do not block the draft).
  if (ctx.sectionL) {
    const l = checkSectionLConformance(ctx.sectionL);
    checklist.push({ item: formProfile.instructionsItemLabel, passed: l.conformant, note: l.note });
  }
  if (ctx.sectionM) {
    const m = checkSectionMCoverage(ctx.sectionM);
    checklist.push({ item: formProfile.evaluationItemLabel, passed: m.allAddressed, note: m.note });
  }
  if (ctx.repsAndCerts) {
    const rc = checkRepsAndCerts(ctx.repsAndCerts);
    checklist.push({ item: "Reps & certs (FAR 52.204-8 / 52.212-3)", passed: rc.complete, note: rc.note });
  }

  // Only the three hard disqualifiers block the draft (CLAUDE.md §6 — heuristics/advisories never block).
  const blocking = !amendments.allAcknowledged || !pricingMath.reconciled || !exceptions.clean;

  return {
    formProfile,
    checklist,
    blocking,
    provisional,
    watermark: provisional
      ? "PROVISIONAL — illustrative rates + pendingCounsel thresholds, NOT for submission"
      : undefined,
    pricingMath,
    disclaimer: BID_DISCLAIMER,
  };
}

/* ---------- The assembled bid package (narrative + pricing brief + compliance + bid checklist) ---------- */
/** Inputs to the deterministic pricing brief (mirrors buildPricingBrief, minus provisional which is set here). */
export interface BidPricingInput {
  contractType: ContractType;
  lines: QuoteLine[];
  rates: IndirectRates;
  feeBands?: { label: string; feePct: number }[];
  benchmarkAwardAmounts?: number[];
  hasFirmWinLossData?: boolean;
}

export interface BidExportSection {
  heading: string;
  body: string;
}

export interface BidPackage {
  formProfile: FormProfile;
  narrative: ProposalNarrative;
  pricing: PricingBrief;
  compliance: ReturnType<typeof buildComplianceChecklist>;
  bidChecklist: BidChecklistResult;
  blocking: boolean; // any draft-blocking item across compliance + bid checklist
  provisional: boolean;
  watermark?: string;
  liveSubmission: { ready: boolean; blockers: string[] };
  disclaimer: string;
  exportSections: BidExportSection[]; // ordered sections for the DOCX/PDF render
}

export interface AssembleBidInput {
  narrative: ProposalNarrative;
  pricing: BidPricingInput;
  compliance: ChecklistContext;
  bid: BidChecklistContext;
  submissionGates: SubmissionGates;
  provisionalRatesMode?: boolean;
}

/**
 * Deterministically assemble the full bid package from an already-drafted narrative (the model wrote the
 * prose) plus the pricing inputs, the compliance context, and the §3 bid-checklist context. No model value
 * enters any gate. `blocking` is the honest OR of the compliance and bid-checklist blockers; an ACTUAL bid
 * is additionally gated by readyForLiveSubmission (the six live gates). Output is watermarked under
 * provisional mode and carries the anti-overclaim disclaimer.
 */
export function assembleBidPackage(input: AssembleBidInput): BidPackage {
  const provisional = input.provisionalRatesMode ?? true;

  const pricing = buildPricingBrief({ ...input.pricing, provisionalRatesMode: provisional });
  const compliance = buildComplianceChecklist({
    ...input.compliance,
    provisionalRatesMode: provisional,
    submissionGates: input.submissionGates,
  });
  const bidChecklist = buildBidChecklist({ ...input.bid, provisionalRatesMode: provisional });
  const liveSubmission = readyForLiveSubmission(input.submissionGates);
  const blocking = compliance.blocking || bidChecklist.blocking;

  return {
    formProfile: bidChecklist.formProfile,
    narrative: input.narrative,
    pricing,
    compliance,
    bidChecklist,
    blocking,
    provisional,
    watermark: provisional
      ? "PROVISIONAL — illustrative rates + pendingCounsel thresholds, NOT for submission"
      : undefined,
    liveSubmission,
    disclaimer: BID_DISCLAIMER,
    exportSections: buildExportSections(input.narrative, pricing, compliance, bidChecklist, provisional),
  };
}

/** Shape the package into ordered, render-ready sections (consumed by engine.exportBidDoc). Deterministic. */
function buildExportSections(
  narrative: ProposalNarrative,
  pricing: PricingBrief,
  compliance: ReturnType<typeof buildComplianceChecklist>,
  bidChecklist: BidChecklistResult,
  provisional: boolean,
): BidExportSection[] {
  const checklistBody = (items: ChecklistItem[]): string =>
    items
      .map((c) => `${c.passed ? "[PASS]" : "[REVIEW]"} ${c.item}${c.note ? ` — ${c.note}` : ""}`)
      .join("\n");
  const scenarioBody = pricing.scenarios
    .map(
      (s) =>
        `${s.label}: price $${s.price.toFixed(2)} (fee ${(s.feePct * 100).toFixed(1)}%, margin ${(s.marginPct * 100).toFixed(1)}%` +
        `${s.vsBenchmarkMedianPct != null ? `, ${(s.vsBenchmarkMedianPct * 100).toFixed(1)}% vs benchmark median` : ""})`,
    )
    .join("\n");

  return [
    { heading: "Executive Summary", body: narrative.executiveSummary },
    { heading: "Technical Approach", body: narrative.technicalApproach },
    { heading: "Management Approach", body: narrative.managementApproach },
    { heading: "Past Performance", body: narrative.pastPerformanceNarrative },
    ...(narrative.assumptions.length
      ? [{ heading: "Assumptions", body: narrative.assumptions.map((a) => `• ${a}`).join("\n") }]
      : []),
    {
      heading: "Pricing Scenarios (decision-support — never a single number)",
      body: `${scenarioBody}\n\n${pricing.disclaimer}`,
    },
    {
      heading: provisional ? "Compliance Checklist (provisional — pending counsel)" : "Compliance Checklist",
      body: checklistBody(compliance.checklist),
    },
    {
      heading: provisional
        ? "Bid-Drafting Checklist (provisional — pending counsel)"
        : "Bid-Drafting Checklist",
      body: checklistBody(bidChecklist.checklist),
    },
  ];
}
