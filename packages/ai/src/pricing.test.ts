import { describe, expect, it } from "vitest";

import {
  benchmarkStats,
  buildCostModel,
  buildPricingBrief,
  feeScenarios,
  marginVsWin,
  usaspendingBenchmarkFilter,
  wrapMultiplier,
  type IndirectRates,
  type QuoteLine,
} from "./pricing.js";

const RATES: IndirectRates = {
  fringe: 0.31,
  overhead: 0.42,
  ga: 0.12,
  fee: 0.085,
  wrapSanityMin: 1.6,
  wrapSanityMax: 2.2,
};

const LINES: QuoteLine[] = [
  { costType: "LABOR", quantity: 100, unitRate: 50 }, // $5,000 direct labor
  { costType: "SUBCONTRACT", quantity: 1, unitRate: 2000 }, // $2,000 sub (G&A only, no fringe/OH)
];

describe("pricing decision-brief (deterministic — scenarios, never a single number)", () => {
  it("wrap multiplier compounds fringe → OH → G&A and lands in the sanity band", () => {
    expect(wrapMultiplier(RATES)).toBeCloseTo(1.31 * 1.42 * 1.12, 6); // ≈ 2.0834
  });

  it("bottoms-up cost: labor takes fringe/OH/G&A; subs take G&A only (DCAA build-up)", () => {
    const m = buildCostModel(LINES, RATES);
    expect(m.directLabor).toBe(5000);
    expect(m.directOdc).toBe(2000);
    expect(m.fringe).toBeCloseTo(1550, 6); // 5000 * 0.31
    expect(m.overhead).toBeCloseTo(2751, 6); // (5000+1550) * 0.42
    expect(m.ga).toBeCloseTo(1356.12, 2); // (5000+1550+2751+2000) * 0.12
    expect(m.totalCost).toBeCloseTo(12657.12, 2);
    expect(m.wrapWithinSanityBand).toBe(true);
  });

  it("fee scenarios always return MORE THAN ONE (never a single authoritative number)", () => {
    const s = feeScenarios(10000, { benchmarkMedian: 11000 });
    expect(s.length).toBeGreaterThan(1);
    const target = s.find((x) => x.label === "target")!;
    expect(target.price).toBeCloseTo(10850, 6); // 10000 * 1.085
    expect(target.marginPct).toBeCloseTo(0.085 / 1.085, 6);
    expect(target.vsBenchmarkMedianPct).toBeCloseTo((10850 - 11000) / 11000, 6); // below median
  });

  it("benchmark stats compute a distribution (min/p25/median/p75/max), not one number", () => {
    const b = benchmarkStats([300, 100, 500, 200, 400]);
    expect(b).toMatchObject({ count: 5, min: 100, p25: 200, median: 300, p75: 400, max: 500 });
  });

  it("USASpending filter uses the verified codes and contract-only award types", () => {
    const f = usaspendingBenchmarkFilter({
      naicsCodes: ["541511", "541512"],
      pscCodes: ["DA01"],
      setAside: "TOTAL_SMALL_BUSINESS",
      startDate: "2023-01-01",
      endDate: "2026-01-01",
    });
    expect(f.set_aside_type_codes).toEqual(["SBA"]);
    expect(f.award_type_codes).toEqual(["A", "B", "C", "D"]);
    expect(f.contract_pricing_type_codes).toEqual(["J", "Y", "Z"]);
    expect(f.naics_codes).toEqual({ require: [["541511"], ["541512"]] });
  });

  it("margin-vs-win is labeled a heuristic (not a probability) without firm win/loss data", () => {
    const s = feeScenarios(10000);
    const mvw = marginVsWin(s, { hasFirmWinLossData: false });
    expect(mvw.isHeuristic).toBe(true);
    expect(mvw.note).toMatch(/NOT a probability/i);
  });

  it("buildPricingBrief assembles scenarios + benchmark + watermark + the compliance checklist", () => {
    const brief = buildPricingBrief({
      contractType: "FFP",
      lines: LINES,
      rates: RATES,
      benchmarkAwardAmounts: [10000, 12000, 14000, 16000, 18000],
      provisionalRatesMode: true,
      compliance: {
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
      },
    });
    expect(brief.scenarios.length).toBeGreaterThan(1); // never one number
    expect(brief.benchmark?.median).toBe(14000);
    expect(brief.provisional).toBe(true);
    expect(brief.watermark).toMatch(/PROVISIONAL/);
    expect(brief.disclaimer).toMatch(/never a single authoritative price/i);
    expect(brief.compliance?.blocking).toBe(false); // compliant under the gates
  });

  it("feeScenarios fails closed on fewer than two bands (never a single number — §6)", () => {
    expect(() => feeScenarios(10000, { bands: [{ label: "only", feePct: 0.085 }] })).toThrow(
      /scenarios/i,
    );
    expect(() => feeScenarios(10000, { bands: [] })).toThrow();
  });

  it("benchmarkStats excludes zero-dollar awards and returns null when no valid data remains", () => {
    const b = benchmarkStats([0, 100, 0, 300, 200]);
    expect(b?.count).toBe(3); // the two zeros excluded
    expect(b?.min).toBe(100);
    expect(benchmarkStats([])).toBeNull();
    expect(benchmarkStats([0, -5, Number.NaN])).toBeNull();
  });

  it("buildPricingBrief with provisionalRatesMode=false has no watermark and still ≥2 scenarios", () => {
    const brief = buildPricingBrief({
      contractType: "FFP",
      lines: LINES,
      rates: RATES,
      provisionalRatesMode: false,
    });
    expect(brief.provisional).toBe(false);
    expect(brief.watermark).toBeUndefined();
    expect(brief.scenarios.length).toBeGreaterThan(1);
  });
});
