import { describe, expect, it } from "vitest";

import type { ChecklistContext, SubmissionGates } from "./compliance.js";
import type { IndirectRates, QuoteLine } from "./pricing.js";
import type { ProposalNarrative } from "./schemas.js";
import {
  assembleBidPackage,
  BID_DISCLAIMER,
  buildBidChecklist,
  checkAmendmentsAcknowledged,
  checkNoProhibitedExceptions,
  checkRepsAndCerts,
  checkSectionLConformance,
  checkSectionMCoverage,
  reconcilePricingMath,
  solicitationFormProfile,
  type BidChecklistContext,
} from "./bid.js";

const NARRATIVE: ProposalNarrative = {
  executiveSummary: "exec",
  technicalApproach: "tech",
  managementApproach: "mgmt",
  pastPerformanceNarrative: "past",
  assumptions: ["assumes GFE provided"],
};

const RATES: IndirectRates = {
  fringe: 0.31,
  overhead: 0.42,
  ga: 0.12,
  fee: 0.085,
  wrapSanityMin: 1.6,
  wrapSanityMax: 2.2,
};

const QUOTE_LINES: QuoteLine[] = [{ costType: "LABOR", quantity: 100, unitRate: 50 }];

const GATES_OPEN: SubmissionGates = {
  counselConfirmed: false,
  actualRatesLoaded: false,
  samRegistrationActive: false,
  cageAssigned: false,
  humanSignature: false,
  counselReviewed: false,
};

const COMPLIANCE_OK: ChecklistContext = {
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
};

/** A bid whose arithmetic reconciles and that trips no hard disqualifier. */
const CLEAN_BID: BidChecklistContext = {
  formType: "UCF_PART15",
  pricingMath: {
    lines: [
      { clin: "0001", unitRate: 50, quantity: 100, extendedAmount: 5000, group: "BASE" },
      { clin: "1001", unitRate: 25, quantity: 40, extendedAmount: 1000, group: "OPTION" },
    ],
    statedGrandTotal: 6000,
    statedBaseTotal: 5000,
    statedOptionsTotal: 1000,
  },
  amendments: [{ amendmentNumber: "0001", acknowledged: true }],
  exceptions: [{ term: "Delivery schedule", material: false }],
};

describe("bid §3.5 — pricing-math reconciliation (deterministic recompute; mismatch → BLOCK)", () => {
  it("reconciles when unit × qty = extended, Σ = grand total, and base + options = grand total", () => {
    const r = reconcilePricingMath(CLEAN_BID.pricingMath);
    expect(r.reconciled).toBe(true);
    expect(r.lineErrors).toHaveLength(0);
    expect(r.computedGrandTotal).toBe(6000);
    expect(r.grandTotalMismatch).toBe(false);
    expect(r.baseOptionsMismatch).toBe(false);
  });

  it("flags a line where unit × qty ≠ extended as a BLOCK", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: 50, quantity: 100, extendedAmount: 4999 }], // 5000 ≠ 4999
      statedGrandTotal: 4999,
    });
    expect(r.reconciled).toBe(false);
    expect(r.lineErrors).toEqual([{ clin: "0001", stated: 4999, computed: 5000 }]);
    expect(r.note).toMatch(/does NOT reconcile/);
  });

  it("flags when Σ extended ≠ stated grand total", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: 50, quantity: 100, extendedAmount: 5000 }],
      statedGrandTotal: 6000, // wrong total
    });
    expect(r.reconciled).toBe(false);
    expect(r.grandTotalMismatch).toBe(true);
  });

  it("flags when base + options ≠ grand total", () => {
    const r = reconcilePricingMath({
      lines: [
        { clin: "0001", unitRate: 50, quantity: 100, extendedAmount: 5000, group: "BASE" },
        { clin: "1001", unitRate: 25, quantity: 40, extendedAmount: 1000, group: "OPTION" },
      ],
      statedGrandTotal: 6000,
      statedBaseTotal: 4000, // wrong base split
      statedOptionsTotal: 1000,
    });
    expect(r.reconciled).toBe(false);
    expect(r.baseOptionsMismatch).toBe(true);
  });

  it("tolerates sub-cent floating error (within the $0.01 band)", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: 0.1, quantity: 3, extendedAmount: 0.3 }], // 0.30000000000000004
      statedGrandTotal: 0.3,
    });
    expect(r.reconciled).toBe(true);
  });
});

describe("bid §3.4 — amendments acknowledged (any unacknowledged SF30 → BLOCK)", () => {
  it("passes when every issued amendment is acknowledged", () => {
    const r = checkAmendmentsAcknowledged([
      { amendmentNumber: "0001", acknowledged: true },
      { amendmentNumber: "0002", acknowledged: true },
    ]);
    expect(r.allAcknowledged).toBe(true);
    expect(r.unacknowledged).toHaveLength(0);
  });

  it("lists every unacknowledged amendment (hard disqualifier)", () => {
    const r = checkAmendmentsAcknowledged([
      { amendmentNumber: "0001", acknowledged: true },
      { amendmentNumber: "0002", acknowledged: false },
    ]);
    expect(r.allAcknowledged).toBe(false);
    expect(r.unacknowledged).toEqual(["0002"]);
    expect(r.note).toMatch(/BLOCK/);
  });
});

describe("bid §3.1 — Section L format conformance (WARN, never blocks)", () => {
  it("warns on a page overrun and missing volumes/forms/dueDate/method", () => {
    const r = checkSectionLConformance({
      pageLimit: 20,
      actualPageCount: 25,
      requiredVolumes: ["Technical", "Price"],
      providedVolumes: ["Technical"],
      requiredForms: ["SF33"],
      providedForms: [],
      dueDate: null,
      submissionMethod: null,
    });
    expect(r.conformant).toBe(false);
    expect(r.warnings.length).toBe(5);
  });

  it("is conformant when limits are met", () => {
    const r = checkSectionLConformance({
      pageLimit: 20,
      actualPageCount: 18,
      requiredVolumes: ["Technical"],
      providedVolumes: ["Technical"],
      requiredForms: ["SF33"],
      providedForms: ["SF33"],
      dueDate: new Date("2026-07-01"),
      submissionMethod: "SAM.gov portal",
    });
    expect(r.conformant).toBe(true);
  });
});

describe("bid §3.2 — Section M factor coverage (WARN; builds the L-to-M crosswalk)", () => {
  it("flags an unaddressed factor and labels subfactors in the crosswalk", () => {
    const r = checkSectionMCoverage([
      { factor: "Technical", subfactor: "Approach", addressedInSection: "Vol I §2" },
      { factor: "Technical", subfactor: "Staffing", addressedInSection: null },
      { factor: "Price", addressedInSection: "Vol II" },
    ]);
    expect(r.allAddressed).toBe(false);
    expect(r.unaddressed).toEqual(["Technical › Staffing"]);
    expect(r.crosswalk).toContainEqual({ factor: "Price", section: "Vol II" });
  });

  it("passes when every factor/subfactor maps to a section", () => {
    const r = checkSectionMCoverage([{ factor: "Technical", addressedInSection: "Vol I" }]);
    expect(r.allAddressed).toBe(true);
  });
});

describe("bid §3.3 — reps & certs (SAM active + 12-month currency + solicitation-specific)", () => {
  it("surfaces each gap, including that 'SAM current' alone does not complete solicitation-specific reps", () => {
    const r = checkRepsAndCerts({
      samActive: true,
      repsCertsCurrentWithin12Months: true,
      solicitationSpecificRepsComplete: false,
    });
    expect(r.complete).toBe(false);
    expect(r.gaps.some((g) => g.includes("52.212-3"))).toBe(true);
  });

  it("is complete when SAM is active, current, and solicitation-specific reps are done", () => {
    const r = checkRepsAndCerts({
      samActive: true,
      repsCertsCurrentWithin12Months: true,
      solicitationSpecificRepsComplete: true,
    });
    expect(r.complete).toBe(true);
  });
});

describe("bid §3.7 — no exception to material terms (material exception → BLOCK)", () => {
  it("blocks on a material exception and ignores immaterial ones", () => {
    const r = checkNoProhibitedExceptions([
      { term: "Indemnification", material: true },
      { term: "Font choice", material: false },
    ]);
    expect(r.clean).toBe(false);
    expect(r.materialExceptions).toEqual(["Indemnification"]);
  });
});

describe("bid §6.6 — form profile (Part 12 commercial vs Part 15 UCF; correct disqualifier wording)", () => {
  it("commercial Part 12 → 52.212-1/2, SF1449, 'nonresponsive'; item labels are NOT 'Section L/M'", () => {
    const p = solicitationFormProfile("COMMERCIAL_PART12");
    expect(p.instructionsRef).toMatch(/52\.212-1/);
    expect(p.evaluationRef).toMatch(/52\.212-2/);
    expect(p.forms).toEqual(["SF1449"]);
    expect(p.disqualifierLabel).toBe("nonresponsive");
    // 52.212-1/2 REPLACE the UCF sections — never label a commercial clause "Section L/M" (FAR 12.303).
    expect(p.instructionsItemLabel).not.toMatch(/Section L/);
    expect(p.evaluationItemLabel).not.toMatch(/Section M/);
    expect(p.instructionsItemLabel).toMatch(/Instructions to offerors/);
    expect(p.evaluationItemLabel).toMatch(/Evaluation-factor/);
  });

  it("UCF Part 15 → Section L/M item labels, SF33, 'outside the competitive range' (never 'nonresponsive')", () => {
    const p = solicitationFormProfile("UCF_PART15");
    expect(p.instructionsRef).toMatch(/15\.204-5\(b\)/);
    expect(p.evaluationRef).toMatch(/15\.204-5\(c\)/);
    expect(p.instructionsItemLabel).toMatch(/Section L/);
    expect(p.evaluationItemLabel).toMatch(/Section M/);
    expect(p.forms).toEqual(["SF33"]);
    expect(p.disqualifierLabel).toMatch(/competitive range/);
    expect(p.disqualifierLabel).not.toMatch(/nonresponsive/);
  });

  it("RFO renumber selects the 15.109-4 cites", () => {
    const p = solicitationFormProfile("UCF_PART15", { rfoRenumber: true });
    expect(p.instructionsRef).toMatch(/15\.109-4\(b\)/);
    expect(p.evaluationRef).toMatch(/15\.109-4\(c\)/);
  });

  it("a commercial-form bid checklist labels conformance items without UCF section letters", () => {
    const r = buildBidChecklist({
      ...CLEAN_BID,
      formType: "COMMERCIAL_PART12",
      sectionL: { pageLimit: 20, actualPageCount: 10 },
      sectionM: [{ factor: "Technical", addressedInSection: "Vol I" }],
    });
    expect(r.checklist.some((c) => c.item.includes("Section L"))).toBe(false);
    expect(r.checklist.some((c) => c.item.includes("Instructions to offerors"))).toBe(true);
  });
});

describe("bid §3.5 — fail-closed hardening (non-finite, tolerance clamp, cross-cited totals)", () => {
  it("a NaN amount fails closed (reconciled=false), never a silent pass", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: Number.NaN, quantity: 100, extendedAmount: 5000 }],
      statedGrandTotal: 5000,
    });
    expect(r.reconciled).toBe(false);
    expect(r.nonFinite).toBe(true);
  });

  it("an Infinity amount fails closed (reconciled=false)", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: 50, quantity: 100, extendedAmount: Number.POSITIVE_INFINITY }],
      statedGrandTotal: Number.POSITIVE_INFINITY,
    });
    expect(r.reconciled).toBe(false);
    expect(r.nonFinite).toBe(true);
  });

  it("an absurdly loose tolerance cannot hide a real mismatch (clamped to the cent)", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: 50, quantity: 100, extendedAmount: 4000 }], // 5000 ≠ 4000
      statedGrandTotal: 4000,
      toleranceUsd: 1e9, // attempt to widen the gate — must be clamped to $0.01
    });
    expect(r.reconciled).toBe(false);
  });

  it("a negative tolerance cannot falsely flag a perfect bid (rejected to the default)", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: 50, quantity: 100, extendedAmount: 5000 }],
      statedGrandTotal: 5000,
      toleranceUsd: -1, // would make every abs() > -1 true; must be rejected
    });
    expect(r.reconciled).toBe(true);
  });

  it("an externally-cited total that disagrees with the grand total is a BLOCK (§3.5 cross-volume)", () => {
    const r = reconcilePricingMath({
      lines: [{ clin: "0001", unitRate: 50, quantity: 100, extendedAmount: 5000 }],
      statedGrandTotal: 5000,
      externallyCitedTotals: [5000, 5500], // the SF1449 face value disagrees
    });
    expect(r.reconciled).toBe(false);
    expect(r.crossTotalMismatch).toBe(true);
  });
});

describe("bid checklist — only hard disqualifiers block; advisories never do", () => {
  it("a clean bid does not block; the watermark marks it PROVISIONAL", () => {
    const r = buildBidChecklist(CLEAN_BID);
    expect(r.blocking).toBe(false);
    expect(r.provisional).toBe(true);
    expect(r.watermark).toMatch(/PROVISIONAL/);
    expect(r.disclaimer).toBe(BID_DISCLAIMER);
  });

  it("an unacknowledged amendment, a math mismatch, or a material exception each blocks", () => {
    expect(
      buildBidChecklist({
        ...CLEAN_BID,
        amendments: [{ amendmentNumber: "0002", acknowledged: false }],
      }).blocking,
    ).toBe(true);
    expect(
      buildBidChecklist({
        ...CLEAN_BID,
        pricingMath: {
          lines: [{ clin: "x", unitRate: 1, quantity: 1, extendedAmount: 2 }],
          statedGrandTotal: 2,
        },
      }).blocking,
    ).toBe(true);
    expect(
      buildBidChecklist({ ...CLEAN_BID, exceptions: [{ term: "Indemnification", material: true }] })
        .blocking,
    ).toBe(true);
  });

  it("Section L overrun and unaddressed Section M factors are surfaced but DO NOT block", () => {
    const r = buildBidChecklist({
      ...CLEAN_BID,
      sectionL: { pageLimit: 10, actualPageCount: 50 },
      sectionM: [{ factor: "Technical", addressedInSection: null }],
      repsAndCerts: {
        samActive: false,
        repsCertsCurrentWithin12Months: false,
        solicitationSpecificRepsComplete: false,
      },
    });
    expect(r.blocking).toBe(false); // advisories never block the draft (CLAUDE.md §6)
    expect(r.checklist.some((c) => c.item.includes("Section L") && !c.passed)).toBe(true);
    expect(r.checklist.some((c) => c.item.includes("Section M") && !c.passed)).toBe(true);
  });
});

describe("assembleBidPackage — combines narrative + pricing + compliance + §3 checklist; honest blocking", () => {
  it("assembles a non-blocking package, exposes the live-submission gate, and shapes export sections", () => {
    const pkg = assembleBidPackage({
      narrative: NARRATIVE,
      pricing: {
        contractType: "FFP",
        lines: QUOTE_LINES,
        rates: RATES,
        benchmarkAwardAmounts: [10000, 12000, 14000],
      },
      compliance: COMPLIANCE_OK,
      bid: CLEAN_BID,
      submissionGates: GATES_OPEN,
      provisionalRatesMode: true,
    });

    expect(pkg.blocking).toBe(false);
    expect(pkg.pricing.scenarios.length).toBeGreaterThan(1); // scenarios, never one number
    expect(pkg.provisional).toBe(true);
    expect(pkg.watermark).toMatch(/PROVISIONAL/);

    // A real bid is hard-gated by the six live gates (all open here).
    expect(pkg.liveSubmission.ready).toBe(false);
    expect(pkg.liveSubmission.blockers.length).toBe(6);

    // Export sections are shaped for the DOCX/PDF render (narrative + pricing + both checklists).
    const headings = pkg.exportSections.map((s) => s.heading);
    expect(headings).toContain("Executive Summary");
    expect(headings.some((h) => h.includes("Pricing Scenarios"))).toBe(true);
    expect(headings.some((h) => h.includes("Compliance Checklist"))).toBe(true);
    expect(headings.some((h) => h.includes("Bid-Drafting Checklist"))).toBe(true);
  });

  it("propagates a bid-checklist BLOCK into the package's blocking flag", () => {
    const pkg = assembleBidPackage({
      narrative: NARRATIVE,
      pricing: { contractType: "FFP", lines: QUOTE_LINES, rates: RATES },
      compliance: COMPLIANCE_OK,
      bid: { ...CLEAN_BID, amendments: [{ amendmentNumber: "0003", acknowledged: false }] },
      submissionGates: GATES_OPEN,
    });
    expect(pkg.blocking).toBe(true);
  });

  it("non-provisional mode drops the watermark and still embeds the live-submission gate", () => {
    const pkg = assembleBidPackage({
      narrative: NARRATIVE,
      pricing: { contractType: "FFP", lines: QUOTE_LINES, rates: RATES },
      compliance: COMPLIANCE_OK,
      bid: CLEAN_BID,
      submissionGates: {
        counselConfirmed: true,
        actualRatesLoaded: true,
        samRegistrationActive: true,
        cageAssigned: true,
        humanSignature: true,
        counselReviewed: true,
      },
      provisionalRatesMode: false,
    });
    expect(pkg.provisional).toBe(false);
    expect(pkg.watermark).toBeUndefined();
    expect(pkg.liveSubmission.ready).toBe(true);
    // Export headings must not contradict the (now absent) watermark by still saying "provisional".
    expect(pkg.exportSections.every((s) => !s.heading.toLowerCase().includes("provisional"))).toBe(true);
  });
});

describe("bid module — anti-overclaim (CLAUDE.md §6: never asserts compliant / will win / legal conclusion)", () => {
  it("the standing disclaimer is a draft-for-counsel statement, not a verdict", () => {
    expect(BID_DISCLAIMER).toMatch(/DRAFT/);
    expect(BID_DISCLAIMER).toMatch(/external counsel/);
    // It DISAVOWS — rather than asserts — compliance / flag-free / a win.
    expect(BID_DISCLAIMER).toMatch(/does NOT assert the bid is compliant, will not be flagged, or will win/);
    expect(BID_DISCLAIMER).toMatch(/no legal conclusions/);
  });
});
