import { describe, expect, it } from "vitest";

import {
  buildComplianceChecklist,
  checkLimitationsOnSubcontracting,
  checkPassThrough,
  checkRealism,
  checkTina,
  isSimilarlySituated,
  maxSubMarkupRatio,
  type ChecklistContext,
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

  it("similarly-situated requires shared status AND small-under-NAICS", () => {
    expect(
      isSimilarlySituated({
        subSmallUnderNaics: ["541511"],
        solicitationNaics: "541511",
        sharesPrimeQualifyingStatus: true,
      }),
    ).toBe(true);
    expect(
      isSimilarlySituated({
        subSmallUnderNaics: ["541512"],
        solicitationNaics: "541511",
        sharesPrimeQualifyingStatus: true,
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
