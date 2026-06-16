import { describe, expect, it } from "vitest";

import {
  buildComplianceChecklist,
  checkLimitationsOnSubcontracting,
  checkPassThrough,
  checkRealism,
  checkSizeEligibility,
  checkTina,
  checkUnbalancedPricing,
  isMarkupLocked,
  isSimilarlySituated,
  maxSubMarkupRatio,
  readyForLiveSubmission,
  type ChecklistContext,
  type SubmissionGates,
} from "./compliance.js";

describe("compliance (deterministic FAR rules — never model-decided)", () => {
  it("T&M locks material/subcontract markup to 0; FFP has no statutory cap", () => {
    expect(maxSubMarkupRatio("TM")).toBe(0);
    expect(maxSubMarkupRatio("FFP")).toBeNull();
    expect(maxSubMarkupRatio("FFP_MILESTONE")).toBeNull();
  });

  it("LOS: >50% to non-similarly-situated subs on a services set-aside is non-compliant", () => {
    const r = checkLimitationsOnSubcontracting({
      setAside: "TOTAL_SMALL_BUSINESS",
      isServices: true,
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 60,
    });
    expect(r.applicable).toBe(true);
    expect(r.compliant).toBe(false);
  });

  it("LOS: not applicable on an unrestricted (NONE) solicitation", () => {
    expect(
      checkLimitationsOnSubcontracting({
        setAside: "NONE",
        isServices: true,
        totalGovtPayment: 100,
        paymentsToNonSimilarlySituatedSubs: 90,
      }).applicable,
    ).toBe(false);
  });

  it("similarly-situated keys on the SUBCONTRACT NAICS (not the solicitation NAICS) + shared status", () => {
    // Small under the prime-assigned subcontract NAICS → qualifies even if it differs from the solicitation.
    expect(
      isSimilarlySituated({
        subSmallUnderNaics: ["541519"],
        subcontractNaics: "541519",
        sharesPrimeQualifyingStatus: true,
      }),
    ).toBe(true);
    // Not small under the subcontract NAICS → not similarly situated.
    expect(
      isSimilarlySituated({
        subSmallUnderNaics: ["541512"],
        subcontractNaics: "541511",
        sharesPrimeQualifyingStatus: true,
      }),
    ).toBe(false);
    // Shares no qualifying status → not similarly situated regardless of size.
    expect(
      isSimilarlySituated({
        subSmallUnderNaics: ["541511"],
        subcontractNaics: "541511",
        sharesPrimeQualifyingStatus: false,
      }),
    ).toBe(false);
  });

  it("pass-through above 70% of work requires justification", () => {
    expect(checkPassThrough({ subcontractCost: 80, totalCostOfWork: 100 }).requiresJustification).toBe(
      true,
    );
    expect(checkPassThrough({ subcontractCost: 50, totalCostOfWork: 100 }).requiresJustification).toBe(
      false,
    );
  });

  it("realism flags margin below the 5% default heuristic", () => {
    expect(checkRealism({ price: 100, cost: 98 }).warning).toBe(true);
    expect(checkRealism({ price: 100, cost: 80 }).warning).toBe(false);
  });

  it("TINA is suppressed by adequate price competition", () => {
    const base = { price: 5_000_000, awardDate: new Date("2026-06-14"), isDefense: false };
    expect(checkTina({ ...base, hasAdequatePriceCompetition: true }).flag).toBe(false);
    expect(checkTina({ ...base, hasAdequatePriceCompetition: false }).flag).toBe(true);
  });

  it("checklist blocks an LOS breach and clears when within the cap", () => {
    const ctx: ChecklistContext = {
      setAside: "TOTAL_SMALL_BUSINESS",
      isServices: true,
      contractType: "FFP",
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 60,
      subcontractCost: 10,
      totalCostOfWork: 100,
      price: 100,
      cost: 80,
      awardDate: new Date("2026-06-14"),
      isDefense: false,
      hasAdequatePriceCompetition: true,
      orgSocioEconomicCerts: [],
    };
    expect(buildComplianceChecklist(ctx).blocking).toBe(true);
    expect(buildComplianceChecklist({ ...ctx, paymentsToNonSimilarlySituatedSubs: 10 }).blocking).toBe(
      false,
    );
  });
});

describe("compliance — PR D additions", () => {
  it("T&M 0% markup lock covers ODC and TRAVEL (far-04 resolved), not LABOR/FFP", () => {
    for (const ct of ["MATERIAL", "SUBCONTRACT", "ODC", "TRAVEL"] as const) {
      expect(isMarkupLocked("TM", ct)).toBe(true);
    }
    expect(isMarkupLocked("TM", "LABOR")).toBe(false); // profit lives in burdened labor
    expect(isMarkupLocked("FFP", "ODC")).toBe(false); // no lock on FFP
  });

  it("LOS does NOT apply below the SAT ($350k)", () => {
    expect(
      checkLimitationsOnSubcontracting({
        setAside: "TOTAL_SMALL_BUSINESS",
        isServices: true,
        totalGovtPayment: 100,
        paymentsToNonSimilarlySituatedSubs: 90,
        valueUsd: 300_000,
      }).applicable,
    ).toBe(false);
  });

  it("LOS warns when approaching the cap (>45%, ≤50%)", () => {
    const r = checkLimitationsOnSubcontracting({
      setAside: "TOTAL_SMALL_BUSINESS",
      isServices: true,
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 48,
    });
    expect(r.compliant).toBe(true);
    expect(r.warning).toBe(true);
  });

  it("size eligibility: small at/under $34M, not small above", () => {
    expect(checkSizeEligibility({ avgAnnualReceiptsUsd: 5_000_000 }).eligible).toBe(true);
    expect(checkSizeEligibility({ avgAnnualReceiptsUsd: 40_000_000 }).eligible).toBe(false);
  });

  it("unbalanced pricing requires BOTH an overstated AND understated item (GAO)", () => {
    expect(
      checkUnbalancedPricing([
        { id: "a", price: 50, benchmark: 100 }, // understated only
        { id: "b", price: 100, benchmark: 100 },
      ]).flagged,
    ).toBe(false);
    expect(
      checkUnbalancedPricing([
        { id: "a", price: 50, benchmark: 100 }, // under
        { id: "b", price: 200, benchmark: 100 }, // over
      ]).flagged,
    ).toBe(true);
  });

  it("readyForLiveSubmission requires all six gates; otherwise lists blockers", () => {
    const allClear: SubmissionGates = {
      counselConfirmed: true,
      actualRatesLoaded: true,
      samRegistrationActive: true,
      cageAssigned: true,
      humanSignature: true,
      counselReviewed: true,
    };
    expect(readyForLiveSubmission(allClear).ready).toBe(true);
    const blocked = readyForLiveSubmission({
      ...allClear,
      samRegistrationActive: false,
      counselConfirmed: false,
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers).toHaveLength(2);
  });

  it("checklist watermarks provisional output and never lets a heuristic block", () => {
    const ctx: ChecklistContext = {
      setAside: "TOTAL_SMALL_BUSINESS",
      isServices: true,
      contractType: "TM",
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 10,
      subcontractCost: 90, // >70% pass-through (heuristic — must NOT block)
      totalCostOfWork: 100,
      price: 100,
      cost: 98, // <5% realism (heuristic — must NOT block)
      awardDate: new Date("2026-06-14"),
      isDefense: false,
      hasAdequatePriceCompetition: true,
      orgSocioEconomicCerts: [],
      provisionalRatesMode: true,
    };
    const r = buildComplianceChecklist(ctx);
    expect(r.provisional).toBe(true);
    expect(r.watermark).toMatch(/PROVISIONAL/);
    expect(r.blocking).toBe(false); // pass-through + realism are advisory only
  });

  it("checklist BLOCKS a T&M markup violation on ODC", () => {
    const ctx: ChecklistContext = {
      setAside: "NONE",
      isServices: true,
      contractType: "TM",
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 0,
      subcontractCost: 10,
      totalCostOfWork: 100,
      price: 100,
      cost: 80,
      awardDate: new Date("2026-06-14"),
      isDefense: false,
      hasAdequatePriceCompetition: true,
      orgSocioEconomicCerts: [],
      lineItems: [{ costType: "ODC", markupPct: 5 }], // non-zero markup on ODC under T&M
    };
    expect(buildComplianceChecklist(ctx).blocking).toBe(true);
  });

  it("LOS counts a similarly-situated sub's further-subcontracting back toward the cap (13 CFR 125.6(c))", () => {
    // $40 direct to non-SS (compliant alone) + an SS sub further-subs $20 to non-SS = $60/$100 → over cap.
    const r = checkLimitationsOnSubcontracting({
      setAside: "TOTAL_SMALL_BUSINESS",
      isServices: true,
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 40,
      furtherSubcontractedBySimilarlySituated: 20,
    });
    expect(r.share).toBeCloseTo(0.6);
    expect(r.compliant).toBe(false);
  });

  it("defense TINA threshold is $10M for contracts entered after 2026-06-30 (else $2.5M)", () => {
    const before = checkTina({
      price: 3_000_000,
      awardDate: new Date("2026-06-14"),
      isDefense: true,
      hasAdequatePriceCompetition: false,
    });
    expect(before.threshold).toBe(2_500_000);
    const after = checkTina({
      price: 3_000_000,
      awardDate: new Date("2026-07-01"),
      isDefense: true,
      hasAdequatePriceCompetition: false,
    });
    expect(after.threshold).toBe(10_000_000);
    expect(after.flag).toBe(false); // $3M < $10M defense threshold
  });

  it("a fired TINA flag never propagates to checklist blocking (advisory only)", () => {
    const r = buildComplianceChecklist({
      setAside: "NONE",
      isServices: true,
      contractType: "FFP",
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 0,
      subcontractCost: 0,
      totalCostOfWork: 100,
      price: 5_000_000,
      cost: 4_000_000,
      awardDate: new Date("2026-06-14"),
      isDefense: false,
      hasAdequatePriceCompetition: false, // TINA fires ($5M > $2.5M, no competition)
      orgSocioEconomicCerts: [],
    });
    expect(r.checklist.find((i) => i.item.includes("TINA"))?.passed).toBe(false);
    expect(r.blocking).toBe(false);
  });

  it("checklist surfaces the live-submission gate when submissionGates are supplied", () => {
    const r = buildComplianceChecklist({
      setAside: "TOTAL_SMALL_BUSINESS",
      isServices: true,
      contractType: "FFP",
      totalGovtPayment: 100,
      paymentsToNonSimilarlySituatedSubs: 10,
      subcontractCost: 10,
      totalCostOfWork: 100,
      price: 100,
      cost: 80,
      awardDate: new Date("2026-06-14"),
      isDefense: false,
      hasAdequatePriceCompetition: true,
      orgSocioEconomicCerts: [],
      submissionGates: {
        counselConfirmed: false,
        actualRatesLoaded: false,
        samRegistrationActive: false,
        cageAssigned: false,
        humanSignature: false,
        counselReviewed: false,
      },
    });
    expect(r.blocking).toBe(false); // compliant
    expect(r.liveSubmission?.ready).toBe(false); // but NOT ready for a real bid
    expect(r.liveSubmission?.blockers).toHaveLength(6);
  });
});
