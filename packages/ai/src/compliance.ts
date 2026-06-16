/**
 * packages/ai/src/compliance.ts — the VERIFIED compliance ruleset (CLAUDE.md §6) as DETERMINISTIC code.
 * Compliance is NEVER decided by the language model — the model drafts prose; this module computes the
 * rules. This package is DB-free, so every threshold is an optional parameter (defaulting to the
 * provisional baseline in docs/compliance/counsel-compliance-brief.md); callers pass the firm's validated
 * OrgDirectives values in. All defaults are PENDING COUNSEL CONFIRMATION. Enum values use the UPPERCASE
 * convention that maps to the DB enums.
 */

export const COMPLIANCE_PENDING_COUNSEL = true;

export type ContractType = "FFP" | "TM" | "FFP_MILESTONE" | "UNKNOWN";
export type SetAside = "NONE" | "TOTAL_SMALL_BUSINESS" | "OTHER_RESTRICTED";
export type CostType = "LABOR" | "MATERIAL" | "ODC" | "SUBCONTRACT" | "TRAVEL";

/** Provisional-baseline defaults (overridable per-call from OrgDirectives). */
const DEFAULTS = {
  satUsd: 350_000, // FAR 52.219-14 trigger (SAT, raised 2025-10-01)
  losCapPct: 0.5,
  losWarnPct: 0.45,
  passThroughMaxPct: 0.7,
  tinaUsd: 2_500_000,
  tinaDefenseUsd: 10_000_000,
  realismMinMargin: 0.05,
  sizeStandardUsd: 34_000_000,
  unbalancedDeviationPct: 0.25,
  tmZeroMarkupCostTypes: ["MATERIAL", "SUBCONTRACT", "ODC", "TRAVEL"] as CostType[],
} as const;

/* ---------- FAR 52.219-14: Limitations on Subcontracting (the load-bearing rule) ---------- */
/**
 * On a small-business set-aside for SERVICES above the SAT, the prime may not pay more than 50% of the
 * amount paid by the Government to subcontractors that are NOT similarly situated entities. Payments to
 * similarly-situated subs (small under the subcontract's NAICS, sharing the prime's qualifying status —
 * incl. 1099s) do NOT count against the cap. This is NOT the old "W-2 employees perform 50%" rule.
 */
export function checkLimitationsOnSubcontracting(input: {
  setAside: SetAside;
  isServices: boolean;
  totalGovtPayment: number;
  paymentsToNonSimilarlySituatedSubs: number;
  /**
   * Amounts a SIMILARLY-situated sub further subcontracts to NON-similarly-situated firms — these "count
   * back" toward the prime's cap (13 CFR 125.6(c)). A SS sub's payments are excluded only to the extent it
   * self-performs with its own employees. Defaults to 0 (the conservative self-performs assumption).
   */
  furtherSubcontractedBySimilarlySituated?: number;
  /** Estimated contract value — the clause only attaches above the SAT. Omit to assume it applies. */
  valueUsd?: number;
  satUsd?: number;
  capPct?: number;
  warnPct?: number;
}): { applicable: boolean; share: number; compliant: boolean; warning: boolean; note: string } {
  const sat = input.satUsd ?? DEFAULTS.satUsd;
  const cap = input.capPct ?? DEFAULTS.losCapPct;
  // Warn band tracks the cap (cap − 5pts) unless overridden, so tightening the cap never hides the band.
  const warnAt = input.warnPct ?? Math.max(0, cap - 0.05);
  const aboveSat = input.valueUsd === undefined || input.valueUsd > sat;
  const applicable = input.setAside !== "NONE" && input.isServices && aboveSat;
  if (!applicable) {
    return {
      applicable: false,
      share: 0,
      compliant: true,
      warning: false,
      note: "LOS not applicable (not a services set-aside above the SAT).",
    };
  }
  // Numerator = direct non-SS payments PLUS what SS subs further subcontract to non-SS firms.
  const nonSimilarPayments =
    input.paymentsToNonSimilarlySituatedSubs +
    (input.furtherSubcontractedBySimilarlySituated ?? 0);
  const share = input.totalGovtPayment > 0 ? nonSimilarPayments / input.totalGovtPayment : 0;
  const compliant = share <= cap;
  const warning = compliant && share > warnAt;
  return {
    applicable: true,
    share,
    compliant,
    warning,
    note: !compliant
      ? `EXCEEDS the ${(cap * 100).toFixed(0)}% cap to non-similarly-situated subs. Reduce, or use similarly-situated entities.`
      : warning
        ? `Approaching the ${(cap * 100).toFixed(0)}% cap (${(share * 100).toFixed(1)}%) — review.`
        : `Within the ${(cap * 100).toFixed(0)}% limit on payments to non-similarly-situated subcontractors.`,
  };
}

/**
 * Similarly-situated test for one subcontractor (FAR 52.219-14(b) / 13 CFR 125.6). The sub must be small
 * under the NAICS the prime ASSIGNS TO THIS SUBCONTRACT — which need NOT be the solicitation NAICS — AND
 * share the prime's qualifying small-business status. 1099 independent contractors CAN qualify.
 */
export function isSimilarlySituated(input: {
  subSmallUnderNaics: string[];
  /** The NAICS the prime assigns to THIS subcontract (not necessarily the solicitation NAICS). */
  subcontractNaics: string;
  sharesPrimeQualifyingStatus: boolean;
}): boolean {
  return (
    input.sharesPrimeQualifyingStatus && input.subSmallUnderNaics.includes(input.subcontractNaics)
  );
}

/* ---------- FAR 52.215-23: Limitations on Pass-Through Charges (70% disclosure tripwire) ---------- */
export function checkPassThrough(input: {
  subcontractCost: number;
  totalCostOfWork: number;
  maxPct?: number;
}): { share: number; requiresJustification: boolean; note: string } {
  const max = input.maxPct ?? DEFAULTS.passThroughMaxPct;
  const share = input.totalCostOfWork > 0 ? input.subcontractCost / input.totalCostOfWork : 0;
  const requiresJustification = share > max;
  return {
    share,
    requiresJustification,
    note: requiresJustification
      ? `Subcontracting >${(max * 100).toFixed(0)}% of work — document value added (PM/QA/integration) to avoid excessive pass-through.`
      : "Within typical pass-through expectations.",
  };
}

/* ---------- TINA / Truthful Cost or Pricing Data threshold ---------- */
/** $2.5M civilian; $10M for DEFENSE contracts entered AFTER 2026-06-30. Adequate price competition suppresses it. */
export function checkTina(input: {
  price: number;
  awardDate: Date;
  isDefense: boolean;
  hasAdequatePriceCompetition: boolean;
  civilianUsd?: number;
  defenseUsd?: number;
  satUsd?: number;
}): { threshold: number; flag: boolean; note: string } {
  const cutover = new Date("2026-06-30T23:59:59Z");
  const civilian = input.civilianUsd ?? DEFAULTS.tinaUsd;
  const defense = input.defenseUsd ?? DEFAULTS.tinaDefenseUsd;
  const threshold = input.isDefense && input.awardDate > cutover ? defense : civilian;
  // SAT floor: certified cost or pricing data is never required at or below the SAT (FAR 15.403-1(a)).
  if (input.price <= (input.satUsd ?? DEFAULTS.satUsd)) {
    return { threshold, flag: false, note: "At or below the SAT — certified cost/pricing data not required." };
  }
  if (input.hasAdequatePriceCompetition) {
    return {
      threshold,
      flag: false,
      note: "Adequate price competition — certified cost/pricing data generally not required.",
    };
  }
  const flag = input.price > threshold;
  return {
    threshold,
    flag,
    note: flag
      ? `Over the $${threshold.toLocaleString()} threshold and not competitively priced — flag for TINA certification (human).`
      : "Under the applicable threshold.",
  };
}

/* ---------- Price realism (PRODUCT HEURISTIC, not a legal rule) ---------- */
export function checkRealism(input: {
  price: number;
  cost: number;
  minMargin?: number;
  thinMargin?: number;
}): { margin: number; warning: boolean; tier: "OK" | "THIN" | "WARN"; note: string } {
  const min = input.minMargin ?? DEFAULTS.realismMinMargin;
  const thin = input.thinMargin ?? 0.08;
  const margin = input.price > 0 ? (input.price - input.cost) / input.price : 0;
  const warning = margin < min;
  const tier = warning ? "WARN" : margin < thin ? "THIN" : "OK";
  return {
    margin,
    warning,
    tier,
    note: warning
      ? `Margin ${(margin * 100).toFixed(1)}% below ${(min * 100).toFixed(0)}% heuristic — human review (not a legal rule).`
      : tier === "THIN"
        ? `Margin ${(margin * 100).toFixed(1)}% is thin but plausible (heuristic).`
        : "Margin within heuristic band.",
  };
}

/* ---------- Fee / markup rules by contract type ---------- */
/** FFP: no statutory profit cap. T&M: profit only in labor rates; materials/subs at cost (0% markup). */
export function maxSubMarkupRatio(contractType: ContractType): number | null {
  if (contractType === "TM") return 0; // lock to 0% on materials/subcontracts
  return null; // null = no hard cap (FFP / FFP_MILESTONE)
}

/**
 * Under T&M, the listed cost types must carry 0% markup (profit lives only in burdened labor) — the set
 * includes ODC and TRAVEL, which FAR 16.601 defines as "materials" (resolves far-04). FFP: no lock.
 */
export function isMarkupLocked(
  contractType: ContractType,
  costType: CostType,
  lockedCostTypes: CostType[] = DEFAULTS.tmZeroMarkupCostTypes,
): boolean {
  return contractType === "TM" && lockedCostTypes.includes(costType);
}

/* ---------- SBA size eligibility (13 CFR 121.201; 5-year average receipts) ---------- */
export function checkSizeEligibility(input: {
  avgAnnualReceiptsUsd: number;
  sizeStandardUsd?: number;
}): { eligible: boolean; note: string } {
  const std = input.sizeStandardUsd ?? DEFAULTS.sizeStandardUsd;
  const eligible = input.avgAnnualReceiptsUsd <= std;
  return {
    eligible,
    note: eligible
      ? `Small under the $${std.toLocaleString()} standard (5-yr average receipts).`
      : `Exceeds the $${std.toLocaleString()} size standard — NOT small for this NAICS.`,
  };
}

/* ---------- Unbalanced pricing (PRODUCT HEURISTIC — FAR 15.404-1(g) has no number) ---------- */
export interface UnbalancedLineItem {
  id: string;
  price: number;
  benchmark: number;
}
/**
 * Flags materially unbalanced pricing. GAO: an understated item ALONE is not unbalanced — a paired
 * overstated item is required (requireBothOverAndUnder). Never auto-rejects; a flag → human review.
 */
export function checkUnbalancedPricing(
  items: UnbalancedLineItem[],
  cfg?: { deviationPct?: number; requireBothOverAndUnder?: boolean },
): { flagged: boolean; overstated: string[]; understated: string[]; note: string } {
  const dev = cfg?.deviationPct ?? DEFAULTS.unbalancedDeviationPct;
  const requireBoth = cfg?.requireBothOverAndUnder ?? true;
  const overstated = items
    .filter((i) => i.benchmark > 0 && (i.price - i.benchmark) / i.benchmark > dev)
    .map((i) => i.id);
  const understated = items
    .filter((i) => i.benchmark > 0 && (i.benchmark - i.price) / i.benchmark > dev)
    .map((i) => i.id);
  const flagged = requireBoth
    ? overstated.length > 0 && understated.length > 0
    : overstated.length > 0 || understated.length > 0;
  return {
    flagged,
    overstated,
    understated,
    note: flagged
      ? "Materially unbalanced (overstated + understated line items) — human review (heuristic; the CO decides)."
      : "No material imbalance detected (heuristic).",
  };
}

/* ---------- The ONLY gate on an ACTUAL bid to the government ---------- */
export interface SubmissionGates {
  /** Every compliance threshold confirmed by counsel (no pendingCounsel remaining). */
  counselConfirmed: boolean;
  /** Actual indirect rates loaded (provisionalRatesMode off). */
  actualRatesLoaded: boolean;
  /** Active SAM registration (FAR 52.204-7). */
  samRegistrationActive: boolean;
  cageAssigned: boolean;
  humanSignature: boolean;
  counselReviewed: boolean;
}
/**
 * The whole pipeline runs end-to-end on provisional data for testing; this is the single precondition
 * that must hold before a real bid leaves the building. All six gates must be true (CLAUDE.md §2/§6).
 */
export function readyForLiveSubmission(g: SubmissionGates): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!g.counselConfirmed) blockers.push("Compliance thresholds not counsel-confirmed (pendingCounsel).");
  if (!g.actualRatesLoaded) blockers.push("Provisional rates in use — load actual indirect rates.");
  if (!g.samRegistrationActive) blockers.push("SAM registration not active (FAR 52.204-7).");
  if (!g.cageAssigned) blockers.push("CAGE code not assigned.");
  if (!g.humanSignature) blockers.push("Human signature required (no auto-sign).");
  if (!g.counselReviewed) blockers.push("External counsel review required.");
  return { ready: blockers.length === 0, blockers };
}

/* ---------- Aggregate: build the proposal compliance checklist ---------- */
export type ChecklistItem = { item: string; passed: boolean; note?: string };

export interface ChecklistLineItem {
  costType: CostType;
  markupPct: number;
  price?: number;
  benchmark?: number;
}

export interface ChecklistContext {
  setAside: SetAside;
  isServices: boolean;
  contractType: ContractType;
  totalGovtPayment: number;
  paymentsToNonSimilarlySituatedSubs: number;
  subcontractCost: number;
  totalCostOfWork: number;
  price: number;
  cost: number;
  awardDate: Date;
  isDefense: boolean;
  hasAdequatePriceCompetition: boolean;
  orgSocioEconomicCerts: string[];
  // --- optional, added in PR D (older callers omit them) ---
  valueUsd?: number;
  avgAnnualReceiptsUsd?: number;
  sizeStandardUsd?: number;
  lineItems?: ChecklistLineItem[];
  tmZeroMarkupCostTypes?: CostType[];
  provisionalRatesMode?: boolean;
  submissionGates?: SubmissionGates;
}

export function buildComplianceChecklist(ctx: ChecklistContext): {
  checklist: ChecklistItem[];
  blocking: boolean;
  provisional: boolean;
  watermark?: string;
  liveSubmission?: { ready: boolean; blockers: string[] };
} {
  const los = checkLimitationsOnSubcontracting(ctx);
  const pt = checkPassThrough(ctx);
  const tina = checkTina(ctx);
  const realism = checkRealism(ctx);

  // Set-aside eligibility: org holds no socio-economic certs → only TSB + unrestricted (CLAUDE.md §6.7).
  const eligibleSetAside =
    ctx.setAside === "NONE" ||
    ctx.setAside === "TOTAL_SMALL_BUSINESS" ||
    ctx.orgSocioEconomicCerts.length > 0;

  const checklist: ChecklistItem[] = [
    {
      item: "Set-aside eligibility",
      passed: eligibleSetAside,
      note: eligibleSetAside ? undefined : "No matching socio-economic certification held.",
    },
    { item: "Limitations on Subcontracting (50%)", passed: los.compliant, note: los.note },
    { item: "Pass-through charges (FAR 52.215-23)", passed: !pt.requiresJustification, note: pt.note },
    { item: "TINA certified cost/pricing data", passed: !tina.flag, note: tina.note },
    { item: "Price realism (heuristic)", passed: !realism.warning, note: realism.note },
  ];

  // Size eligibility (only when receipts are supplied).
  let sizeBlocking = false;
  if (ctx.avgAnnualReceiptsUsd !== undefined) {
    const size = checkSizeEligibility({
      avgAnnualReceiptsUsd: ctx.avgAnnualReceiptsUsd,
      sizeStandardUsd: ctx.sizeStandardUsd,
    });
    sizeBlocking = !size.eligible;
    checklist.push({ item: "Small-business size standard", passed: size.eligible, note: size.note });
  }

  // T&M markup lock (only when line items are supplied) — materials/subs/ODC/travel at 0% under T&M.
  let markupBlocking = false;
  if (ctx.lineItems?.length) {
    const violations = ctx.lineItems.filter(
      (li) => isMarkupLocked(ctx.contractType, li.costType, ctx.tmZeroMarkupCostTypes) && li.markupPct > 0,
    );
    markupBlocking = violations.length > 0;
    checklist.push({
      item: "T&M 0% markup on materials/subs/ODC/travel",
      passed: !markupBlocking,
      note: markupBlocking
        ? `Non-zero markup on ${violations.map((v) => v.costType).join(", ")} under T&M — must be billed at cost.`
        : "Markup rules satisfied.",
    });

    // Unbalanced pricing (heuristic) — only over line items carrying a benchmark.
    const benchItems: UnbalancedLineItem[] = ctx.lineItems
      .filter((li) => li.price !== undefined && li.benchmark !== undefined)
      .map((li, idx) => ({ id: String(idx), price: li.price!, benchmark: li.benchmark! }));
    if (benchItems.length) {
      const ub = checkUnbalancedPricing(benchItems);
      checklist.push({ item: "Unbalanced pricing (heuristic)", passed: !ub.flagged, note: ub.note });
    }
  }

  // Blocking = anything that would make the bid non-responsive/non-compliant if submitted as-is.
  // (Heuristics — pass-through, realism, unbalanced — are advisory and never block; CLAUDE.md §6.)
  const blocking = !eligibleSetAside || !los.compliant || sizeBlocking || markupBlocking;

  const provisional = ctx.provisionalRatesMode ?? true;
  return {
    checklist,
    blocking,
    provisional,
    watermark: provisional ? "PROVISIONAL — illustrative rates, NOT for submission" : undefined,
    liveSubmission: ctx.submissionGates ? readyForLiveSubmission(ctx.submissionGates) : undefined,
  };
}
