/**
 * packages/ai/src/pricing.ts — the DETERMINISTIC pricing decision-brief (CLAUDE.md §6). A bottoms-up cost
 * model from a selected sub's quote + the firm's indirect costs, then fee/margin SCENARIOS benchmarked
 * against historical award prices (USASpending) and a labeled margin-vs-win view. It outputs SCENARIOS for
 * the human to choose — NEVER a single authoritative "winning number". The language model writes prose
 * (draftProposal); pricing is computed here. DB-free: indirect rates come in as parameters (the firm's
 * validated OrgDirectives.illustrativeIndirectRates); under provisionalRatesMode the output is watermarked.
 */
import type { ChecklistContext, ContractType, CostType } from "./compliance.js";
import { buildComplianceChecklist } from "./compliance.js";

export interface IndirectRates {
  fringe: number; // applied to direct labor
  overhead: number; // applied to labor + fringe
  ga: number; // applied to Total Cost Input (TCI)
  fee: number; // the firm's target fee fraction
  wrapSanityMin?: number;
  wrapSanityMax?: number;
}

export interface QuoteLine {
  costType: CostType;
  quantity: number;
  unitRate: number;
}

/** Direct costs that do NOT take the prime's fringe/overhead (only G&A via TCI). */
const NON_LABOR: CostType[] = ["MATERIAL", "ODC", "SUBCONTRACT", "TRAVEL"];

/**
 * The firm's loaded labor-rate multiplier (fee excluded): (1+fringe)(1+OH)(1+G&A). This validates the
 * RATE STRUCTURE — is the fringe/OH/G&A combination in the typical 1.6–2.2 band? — independent of any
 * single quote's labor/ODC mix. (`wrapWithinSanityBand` on the cost model is therefore a check on the
 * rates, NOT a quote-specific total-cost-per-labor-dollar ratio, which legitimately exceeds the band on a
 * subcontract-heavy quote.)
 */
export function wrapMultiplier(r: IndirectRates): number {
  return (1 + r.fringe) * (1 + r.overhead) * (1 + r.ga);
}

export interface CostModel {
  directLabor: number;
  fringe: number;
  overhead: number;
  directOdc: number; // materials + subcontracts + ODC + travel
  ga: number;
  totalCost: number;
  wrapMultiplier: number;
  wrapWithinSanityBand: boolean;
}

/**
 * Bottoms-up cost from a quote's line items + the firm's indirect rates (DCAA-style build-up): direct
 * labor → fringe → overhead (on labor+fringe) → +direct ODC/subs → G&A (on TCI). Fee is applied per
 * scenario, not here. Prime LABOR takes fringe/OH; subcontracts/materials/ODC/travel take only G&A.
 */
export function buildCostModel(lines: QuoteLine[], r: IndirectRates): CostModel {
  const directLabor = lines
    .filter((l) => l.costType === "LABOR")
    .reduce((s, l) => s + l.quantity * l.unitRate, 0);
  const directOdc = lines
    .filter((l) => NON_LABOR.includes(l.costType))
    .reduce((s, l) => s + l.quantity * l.unitRate, 0);
  const fringe = directLabor * r.fringe;
  const overhead = (directLabor + fringe) * r.overhead;
  const tci = directLabor + fringe + overhead + directOdc;
  const ga = tci * r.ga;
  const totalCost = tci + ga;
  const wm = wrapMultiplier(r);
  const min = r.wrapSanityMin ?? 1.6;
  const max = r.wrapSanityMax ?? 2.2;
  return {
    directLabor,
    fringe,
    overhead,
    directOdc,
    ga,
    totalCost,
    wrapMultiplier: wm,
    wrapWithinSanityBand: wm >= min && wm <= max,
  };
}

export interface FeeScenario {
  label: string;
  feePct: number;
  price: number; // totalCost * (1 + feePct)
  marginPct: number; // feePct / (1 + feePct) — margin as a share of price
  vsBenchmarkMedianPct?: number; // (price − median) / median, if a benchmark is supplied
}

/**
 * Fee/margin SCENARIOS — ALWAYS returns more than one (CLAUDE.md §6: scenarios, never a single number).
 * FFP has no statutory cap; the bands are a product default (conservative/target/aggressive).
 */
export function feeScenarios(
  totalCost: number,
  opts?: { bands?: { label: string; feePct: number }[]; benchmarkMedian?: number },
): FeeScenario[] {
  const bands = opts?.bands ?? [
    { label: "conservative", feePct: 0.05 },
    { label: "target", feePct: 0.085 },
    { label: "aggressive", feePct: 0.1 },
  ];
  // The brief outputs SCENARIOS, never a single number (CLAUDE.md §6) — fail closed on a degenerate set.
  if (bands.length < 2) {
    throw new Error(
      "feeScenarios requires at least two bands — the pricing brief outputs scenarios, never a single authoritative number (CLAUDE.md §6).",
    );
  }
  return bands.map((b) => {
    const price = totalCost * (1 + b.feePct);
    const marginPct = b.feePct / (1 + b.feePct);
    const vs =
      opts?.benchmarkMedian && opts.benchmarkMedian > 0
        ? (price - opts.benchmarkMedian) / opts.benchmarkMedian
        : undefined;
    return { label: b.label, feePct: b.feePct, price, marginPct, vsBenchmarkMedianPct: vs };
  });
}

export interface BenchmarkStats {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/**
 * Distribution stats over comparable historical award amounts (USASpending) — never a single number.
 * Excludes zero-obligation records (deobligations / net-zero mods) that would distort min/p25. Returns
 * `null` when no valid comparable awards remain (don't fabricate a zero-filled distribution).
 */
export function benchmarkStats(awardAmounts: number[]): BenchmarkStats | null {
  const s = [...awardAmounts]
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (s.length === 0) return null;
  return {
    count: s.length,
    min: s[0]!,
    p25: percentile(s, 0.25),
    median: percentile(s, 0.5),
    p75: percentile(s, 0.75),
    max: s[s.length - 1]!,
  };
}

/* ---------- USASpending benchmark query builder (verified §6.2 constants) ---------- */
export const PRICING_TYPE = { FFP: "J", TM: "Y", LABOR_HOURS: "Z" } as const;
export const SET_ASIDE_CODE = {
  TOTAL_SMALL_BUSINESS: "SBA",
  PARTIAL_SMALL_BUSINESS: "SBP",
  NONE: "NONE",
} as const;
/** Contract award types (NOT IDV_* — those carry ceilings, not unit prices; can't be mixed in one query). */
export const CONTRACT_AWARD_TYPE_CODES = ["A", "B", "C", "D"] as const;

/**
 * Builds ONE USASpending `spending_by_award` filter. The set-aside set and the unrestricted set are
 * separate calls (`award_type_codes` cannot mix contract + IDV groups) — call this twice with different
 * `setAside`. Pure: constructs the filter object; the SSRF-guarded fetch happens in @hermes/inngest.
 */
export function usaspendingBenchmarkFilter(input: {
  naicsCodes: string[];
  pscCodes?: string[];
  setAside: keyof typeof SET_ASIDE_CODE;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  pricingTypes?: (typeof PRICING_TYPE)[keyof typeof PRICING_TYPE][];
  /** Optional — OMITTED by default. A TSB set-aside reports various extent codes; `set_aside_type_codes`
   * already scopes the set-aside, so constraining extent would drop valid comparable awards. */
  extentCompetedTypeCodes?: string[];
}): Record<string, unknown> {
  return {
    award_type_codes: [...CONTRACT_AWARD_TYPE_CODES],
    naics_codes: { require: input.naicsCodes.map((c) => [c]) },
    ...(input.pscCodes?.length ? { psc_codes: { require: input.pscCodes.map((c) => [c]) } } : {}),
    set_aside_type_codes: [SET_ASIDE_CODE[input.setAside]],
    ...(input.extentCompetedTypeCodes?.length
      ? { extent_competed_type_codes: input.extentCompetedTypeCodes }
      : {}),
    contract_pricing_type_codes: input.pricingTypes ?? ["J", "Y", "Z"],
    time_period: [{ start_date: input.startDate, end_date: input.endDate }],
  };
}

/* ---------- Margin-vs-win (HEURISTIC, gated behind firm win/loss data) ---------- */
export interface WinPoint {
  feePct: number;
  /** Price position relative to the benchmark median; null when no benchmark was available. */
  relativeToMedianPct: number | null;
}
export function marginVsWin(
  scenarios: FeeScenario[],
  opts: { hasFirmWinLossData: boolean },
): { points: WinPoint[]; isHeuristic: boolean; note: string } {
  const points = scenarios.map((s) => ({
    feePct: s.feePct,
    relativeToMedianPct: s.vsBenchmarkMedianPct ?? null,
  }));
  return {
    points,
    isHeuristic: !opts.hasFirmWinLossData,
    note: opts.hasFirmWinLossData
      ? "Win-probability derived from the firm's bid/win history."
      : "Illustrative only — no firm win/loss history; price-vs-median position, NOT a probability.",
  };
}

/* ---------- The pricing decision-brief (assembles everything; scenarios only) ---------- */
export interface PricingBrief {
  contractType: ContractType;
  costModel: CostModel;
  benchmark?: BenchmarkStats;
  scenarios: FeeScenario[];
  marginVsWin: { points: WinPoint[]; isHeuristic: boolean; note: string };
  compliance?: ReturnType<typeof buildComplianceChecklist>;
  provisional: boolean;
  watermark?: string;
  disclaimer: string;
}

export function buildPricingBrief(input: {
  contractType: ContractType;
  lines: QuoteLine[];
  rates: IndirectRates;
  feeBands?: { label: string; feePct: number }[];
  benchmarkAwardAmounts?: number[];
  hasFirmWinLossData?: boolean;
  provisionalRatesMode?: boolean;
  compliance?: ChecklistContext;
}): PricingBrief {
  const provisional = input.provisionalRatesMode ?? true;
  const costModel = buildCostModel(input.lines, input.rates);
  const benchmark = input.benchmarkAwardAmounts
    ? (benchmarkStats(input.benchmarkAwardAmounts) ?? undefined)
    : undefined;
  const scenarios = feeScenarios(costModel.totalCost, {
    bands: input.feeBands,
    benchmarkMedian: benchmark?.median,
  });
  return {
    contractType: input.contractType,
    costModel,
    benchmark,
    scenarios,
    marginVsWin: marginVsWin(scenarios, { hasFirmWinLossData: input.hasFirmWinLossData ?? false }),
    // Keep the checklist's watermark in sync with the brief's provisional state.
    compliance: input.compliance
      ? buildComplianceChecklist({ ...input.compliance, provisionalRatesMode: provisional })
      : undefined,
    provisional,
    watermark: provisional ? "PROVISIONAL — illustrative indirect rates, NOT for submission" : undefined,
    disclaimer:
      "Decision-support scenarios for the human to choose — never a single authoritative price (CLAUDE.md §6).",
  };
}
