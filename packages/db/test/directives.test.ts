/**
 * Org directives validation at the boundary (pure unit — no DB; always runs). The socio-economic
 * set-aside booleans are structurally locked to false (CLAUDE.md §6.7) and the subcontracting cap is
 * stricter-only (≤ 50). Untrusted input is rejected by parseDirectives.
 */
import { describe, expect, it } from "vitest";
import {
  assertNoSocioEconomicCerts,
  defaultDirectives,
  hasUnconfirmedCounselThresholds,
  parseDirectives,
  type OrgDirectives,
} from "../src/directives.js";

const validInput = {
  naicsCodes: ["541511", "541512"],
  setAsideEligibility: {
    totalSmallBusiness: true,
    eightA: false,
    hubzone: false,
    sdvosb: false,
    wosb: false,
  },
  zeroFloat: { minFeasibilityScore: 6, maxResponseDays: 14 },
  thresholds: {
    priceRealismMinMarginPct: { value: 5, pendingCounsel: true },
    passThroughMaxPct: { value: 70, pendingCounsel: true },
    tinaThresholdUsd: { value: 2_500_000, pendingCounsel: true },
    limitationsOnSubcontractingMaxNonSimilarPct: { value: 50, pendingCounsel: true },
  },
};

describe("orgDirectives boundary validation", () => {
  it("accepts a valid directives object", () => {
    expect(() => parseDirectives(validInput)).not.toThrow();
  });

  it("rejects enabling 8(a) eligibility (z.literal(false) lock)", () => {
    const bad = structuredClone(validInput);
    bad.setAsideEligibility.eightA = true as unknown as false;
    expect(() => parseDirectives(bad)).toThrow();
  });

  it.each(["hubzone", "sdvosb", "wosb"])("rejects enabling %s eligibility", (cert) => {
    const bad = structuredClone(validInput);
    (bad.setAsideEligibility as Record<string, unknown>)[cert] = true;
    expect(() => parseDirectives(bad)).toThrow();
  });

  it("clamps the limitations-on-subcontracting cap to ≤ 50 (stricter-only)", () => {
    const bad = structuredClone(validInput);
    bad.thresholds.limitationsOnSubcontractingMaxNonSimilarPct.value = 60;
    expect(() => parseDirectives(bad)).toThrow();
  });

  it("rejects a percentage threshold above 100", () => {
    const bad = structuredClone(validInput);
    bad.thresholds.passThroughMaxPct.value = 150;
    expect(() => parseDirectives(bad)).toThrow();
  });

  it("requires at least one NAICS code", () => {
    const bad = structuredClone(validInput);
    bad.naicsCodes = [];
    expect(() => parseDirectives(bad)).toThrow();
  });

  it("rejects a malformed NAICS code", () => {
    const bad = structuredClone(validInput);
    bad.naicsCodes = ["54151"]; // 5 digits, not 6
    expect(() => parseDirectives(bad)).toThrow();
  });

  it("assertNoSocioEconomicCerts throws if a cert is somehow true (defense in depth)", () => {
    const sneaky = {
      ...validInput,
      setAsideEligibility: { ...validInput.setAsideEligibility, sdvosb: true },
    } as unknown as OrgDirectives;
    expect(() => assertNoSocioEconomicCerts(sneaky)).toThrow(/socio-economic/i);
  });
});

describe("orgDirectives provisional baseline + compliance config (PR D)", () => {
  it("parseDirectives({}) yields the full provisional baseline", () => {
    const d = defaultDirectives();
    expect(d.naicsCodes).toContain("541511");
    expect(d.setAsideEligibility.totalSmallBusiness).toBe(true);
    expect(d.provisionalRatesMode).toBe(true);
    expect(d.receiptsAveragingYears).toBe(5);
    expect(d.thresholds.subcontractingTriggerUsd.value).toBe(350_000);
    expect(d.thresholds.smallBusinessSizeStandardUsd.value).toBe(34_000_000);
    expect(d.registration.samRegistrationActive).toBe(false);
    expect(d.registration.cageAssigned).toBe(false);
  });

  it("T&M 0% markup cost types include ODC and TRAVEL (far-04)", () => {
    expect(defaultDirectives().tmZeroMarkupCostTypes).toEqual(
      expect.arrayContaining(["MATERIAL", "SUBCONTRACT", "ODC", "TRAVEL"]),
    );
  });

  it("receiptsAveragingYears is locked to 5 (cannot be 3)", () => {
    expect(() => parseDirectives({ ...validInput, receiptsAveragingYears: 3 })).toThrow();
  });

  it("hasUnconfirmedCounselThresholds is true on the provisional baseline", () => {
    expect(hasUnconfirmedCounselThresholds(defaultDirectives())).toBe(true);
  });

  it("hasUnconfirmedCounselThresholds is false once every threshold is confirmed", () => {
    const d = defaultDirectives();
    const confirmed = {
      ...d,
      thresholds: Object.fromEntries(
        Object.entries(d.thresholds).map(([k, v]) => [k, { ...v, pendingCounsel: false }]),
      ),
    } as OrgDirectives;
    expect(hasUnconfirmedCounselThresholds(confirmed)).toBe(false);
  });
});
