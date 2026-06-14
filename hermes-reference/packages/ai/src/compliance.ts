/**
 * packages/ai/src/compliance.ts
 *
 * The VERIFIED compliance ruleset (CLAUDE.md §6) as DETERMINISTIC code.
 * Compliance must never be "decided" by the language model — the model drafts prose; this module
 * computes the rules. All thresholds are PENDING COUNSEL CONFIRMATION; keep them in one place so a
 * lawyer's answers change one file, not scattered logic.
 */

export const COMPLIANCE_PENDING_COUNSEL = true;

export type ContractType = "ffp" | "tm" | "ffp_milestone" | "unknown";
export type SetAside = "none" | "total_small_business" | "other_restricted";

/* ---------- FAR 52.219-14: Limitations on Subcontracting (the load-bearing rule) ---------- */
/**
 * On a small-business set-aside for SERVICES, the prime may not pay more than 50% of the amount paid by
 * the Government to subcontractors that are NOT similarly situated entities. Payments to similarly-situated
 * subs (small under the solicitation's NAICS, sharing the prime's qualifying status — incl. 1099s) do NOT
 * count against the cap. This is NOT the old "W-2 employees perform 50%" rule.
 */
export function checkLimitationsOnSubcontracting(input: {
  setAside: SetAside;
  isServices: boolean;
  totalGovtPayment: number;
  paymentsToNonSimilarlySituatedSubs: number;
}): { applicable: boolean; share: number; compliant: boolean; note: string } {
  const applicable = input.setAside !== "none" && input.isServices;
  if (!applicable) {
    return { applicable: false, share: 0, compliant: true, note: "LOS not applicable (not a services set-aside)." };
  }
  const share =
    input.totalGovtPayment > 0
      ? input.paymentsToNonSimilarlySituatedSubs / input.totalGovtPayment
      : 0;
  const compliant = share <= 0.5;
  return {
    applicable: true,
    share,
    compliant,
    note: compliant
      ? "Within the 50% limit on payments to non-similarly-situated subcontractors."
      : "EXCEEDS 50% to non-similarly-situated subs. Reduce, or use similarly-situated entities.",
  };
}

/**
 * Similarly-situated test for a single subcontractor relative to a solicitation.
 * Independent contractors (1099) CAN qualify.
 */
export function isSimilarlySituated(input: {
  subSmallUnderNaics: string[];
  solicitationNaics: string;
  sharesPrimeQualifyingStatus: boolean; // e.g., both small for a small-business set-aside
}): boolean {
  return (
    input.sharesPrimeQualifyingStatus &&
    input.subSmallUnderNaics.includes(input.solicitationNaics)
  );
}

/* ---------- FAR 52.215-23: Limitations on Pass-Through Charges ---------- */
export function checkPassThrough(input: {
  subcontractCost: number;
  totalCostOfWork: number;
}): { share: number; requiresJustification: boolean; note: string } {
  const share =
    input.totalCostOfWork > 0 ? input.subcontractCost / input.totalCostOfWork : 0;
  const requiresJustification = share > 0.7;
  return {
    share,
    requiresJustification,
    note: requiresJustification
      ? "Subcontracting >70% of work — document value added (PM/QA/integration) to avoid excessive pass-through."
      : "Within typical pass-through expectations.",
  };
}

/* ---------- TINA / Truthful Cost or Pricing Data threshold ---------- */
/**
 * $2.5M now; $10M for (defense) contracts entered AFTER June 30, 2026. Generally does NOT apply where
 * there is adequate price competition (the norm for competitive set-asides) — pass that in to suppress.
 */
export function checkTina(input: {
  price: number;
  awardDate: Date;
  isDefense: boolean;
  hasAdequatePriceCompetition: boolean;
}): { threshold: number; flag: boolean; note: string } {
  const cutover = new Date("2026-06-30T23:59:59Z");
  const threshold = input.isDefense && input.awardDate > cutover ? 10_000_000 : 2_500_000;
  if (input.hasAdequatePriceCompetition) {
    return { threshold, flag: false, note: "Adequate price competition — certified cost/pricing data generally not required." };
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
  minMargin?: number; // default 5%
}): { margin: number; warning: boolean; note: string } {
  const min = input.minMargin ?? 0.05;
  const margin = input.price > 0 ? (input.price - input.cost) / input.price : 0;
  const warning = margin < min;
  return {
    margin,
    warning,
    note: warning
      ? `Margin ${(margin * 100).toFixed(1)}% below ${(min * 100).toFixed(0)}% heuristic — human review (not a legal rule).`
      : "Margin within heuristic band.",
  };
}

/* ---------- Fee / markup rules by contract type ---------- */
/** FFP: no statutory profit cap. T&M: profit only in labor rates; materials/subs at cost (0% markup). */
export function maxSubMarkupRatio(contractType: ContractType): number | null {
  if (contractType === "tm") return 0; // lock to 0% on materials/subcontracts
  return null; // null = no hard cap (FFP / ffp_milestone)
}

/* ---------- Aggregate: build the proposal compliance checklist ---------- */
export type ChecklistItem = { item: string; passed: boolean; note?: string };

export function buildComplianceChecklist(ctx: {
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
}): { checklist: ChecklistItem[]; blocking: boolean } {
  const los = checkLimitationsOnSubcontracting(ctx);
  const pt = checkPassThrough(ctx);
  const tina = checkTina(ctx);
  const realism = checkRealism(ctx);

  // Set-aside eligibility: org holds no socio-economic certs -> only TSB + unrestricted (CLAUDE.md §6.7)
  const eligibleSetAside =
    ctx.setAside === "none" ||
    ctx.setAside === "total_small_business" ||
    ctx.orgSocioEconomicCerts.length > 0;

  const checklist: ChecklistItem[] = [
    { item: "Set-aside eligibility", passed: eligibleSetAside, note: eligibleSetAside ? undefined : "No matching socio-economic certification held." },
    { item: "Limitations on Subcontracting (50%)", passed: los.compliant, note: los.note },
    { item: "Pass-through charges (FAR 52.215-23)", passed: !pt.requiresJustification, note: pt.note },
    { item: "TINA certified cost/pricing data", passed: !tina.flag, note: tina.note },
    { item: "Price realism (heuristic)", passed: !realism.warning, note: realism.note },
  ];

  // Blocking = anything that would make the bid non-responsive/non-compliant if submitted as-is.
  const blocking = !eligibleSetAside || !los.compliant;
  return { checklist, blocking };
}
