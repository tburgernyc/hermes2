import { describe, expect, it } from "vitest";

import {
  applicableFlowDownClauses,
  assembleSubcontractPackage,
  deriveFarFlowDownClauses,
  renderSubcontractDraftText,
  SUBCONTRACT_DISCLAIMER,
  type SubcontractMilestoneInput,
} from "./subcontract.js";
import type { SubcontractNarrative } from "./schemas.js";

const NARRATIVE: SubcontractNarrative = {
  scopeOfWork: "Provide tiered IT support per the awarded solicitation scope.",
  periodOfPerformanceSummary: "12 months from award, with milestone-based payment.",
  paymentScheduleSummary: "Paid on completion of each milestone below.",
  protectiveTerms: [
    { term: "Indemnification", body: "Each party indemnifies the other for its own negligent acts." },
    { term: "Insurance Requirements", body: "Subcontractor carries commercial general liability." },
    { term: "Confidentiality", body: "Both parties keep non-public information confidential." },
    { term: "Intellectual Property / Work-Product Ownership", body: "Work product vests in the prime." },
    { term: "Termination for Convenience", body: "Either party may terminate on 30 days notice." },
    { term: "Termination for Cause", body: "Immediate termination on uncured material breach." },
    { term: "Warranty", body: "Services performed in a workmanlike manner." },
    { term: "Dispute Resolution and Governing Law", body: "Governed by the laws of the performance state." },
  ],
};

const MILESTONES: SubcontractMilestoneInput[] = [
  { sequence: 1, description: "LABOR: Senior engineer", amount: 15000, dueDate: null },
  { sequence: 2, description: "ODC: Travel", amount: 500, dueDate: null },
];

describe("deriveFarFlowDownClauses (FAR 52.244-6(c)(1) commercial-services flow-down)", () => {
  it("returns every clause considered, each carrying its own condition text", () => {
    const clauses = deriveFarFlowDownClauses({ valueUsd: 50_000, popDays: 365 });
    expect(clauses.length).toBeGreaterThan(15);
    for (const c of clauses) {
      expect(c.clause).toMatch(/^FAR 52\./);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.condition.length).toBeGreaterThan(0);
      expect(typeof c.applies).toBe("boolean");
    }
  });

  it("always-applicable baseline clauses (trafficking, EEO, etc.) apply regardless of a small subcontract value", () => {
    const clauses = deriveFarFlowDownClauses({ valueUsd: 25_000, popDays: 90 });
    const byClause = new Map(clauses.map((c) => [c.clause, c]));
    expect(byClause.get("FAR 52.222-50")!.applies).toBe(true); // trafficking — every dollar value
    expect(byClause.get("FAR 52.222-26")!.applies).toBe(true); // equal opportunity
    expect(byClause.get("FAR 52.204-25")!.applies).toBe(true); // telecom prohibition
  });

  it("dollar-threshold clauses do NOT apply below their FAR threshold on a small subcontract", () => {
    const clauses = deriveFarFlowDownClauses({ valueUsd: 100_000, popDays: 90 });
    const byClause = new Map(clauses.map((c) => [c.clause, c]));
    expect(byClause.get("FAR 52.203-13")!.applies).toBe(false); // below the ~$6M ethics-program threshold
    expect(byClause.get("FAR 52.219-8")!.applies).toBe(false); // below the $900k subcontracting-plan threshold
  });

  it("52.203-13 applies only when BOTH the value AND the period-of-performance conditions are met", () => {
    const overValueShortPop = deriveFarFlowDownClauses({ valueUsd: 7_000_000, popDays: 60 });
    expect(overValueShortPop.find((c) => c.clause === "FAR 52.203-13")!.applies).toBe(false);

    const overValueLongPop = deriveFarFlowDownClauses({ valueUsd: 7_000_000, popDays: 200 });
    expect(overValueLongPop.find((c) => c.clause === "FAR 52.203-13")!.applies).toBe(true);
  });

  it("52.219-8 applies once the subcontract value exceeds the FAR 19.702(a) threshold", () => {
    const clauses = deriveFarFlowDownClauses({ valueUsd: 1_000_000, popDays: 365 });
    expect(clauses.find((c) => c.clause === "FAR 52.219-8")!.applies).toBe(true);
  });

  it("52.232-40 (accelerated payments) tracks the vendor's small-business status", () => {
    const small = deriveFarFlowDownClauses({ valueUsd: 100_000, popDays: 365, vendorIsSmallBusiness: true });
    expect(small.find((c) => c.clause === "FAR 52.232-40")!.applies).toBe(true);

    const notSmall = deriveFarFlowDownClauses({
      valueUsd: 100_000,
      popDays: 365,
      vendorIsSmallBusiness: false,
    });
    expect(notSmall.find((c) => c.clause === "FAR 52.232-40")!.applies).toBe(false);

    // Unknown status is treated conservatively (included) — the firm's subs are typically small.
    const unknown = deriveFarFlowDownClauses({ valueUsd: 100_000, popDays: 365 });
    expect(unknown.find((c) => c.clause === "FAR 52.232-40")!.applies).toBe(true);
  });

  it("clauses conditioned on facts Hermes does not model (Recovery Act funding, overseas performance, ocean transport) never apply", () => {
    const clauses = deriveFarFlowDownClauses({ valueUsd: 10_000_000, popDays: 500 });
    const byClause = new Map(clauses.map((c) => [c.clause, c]));
    expect(byClause.get("FAR 52.203-15")!.applies).toBe(false);
    expect(byClause.get("FAR 52.225-26")!.applies).toBe(false);
    expect(byClause.get("FAR 52.247-64")!.applies).toBe(false);
  });

  it("applicableFlowDownClauses filters to only the clauses that apply", () => {
    const all = deriveFarFlowDownClauses({ valueUsd: 100_000, popDays: 365 });
    const applicable = applicableFlowDownClauses({ valueUsd: 100_000, popDays: 365 });
    expect(applicable.length).toBeLessThan(all.length);
    expect(applicable.every((c) => c.applies)).toBe(true);
  });

  it("an unknown period of performance is treated conservatively (included), never silently dropped", () => {
    const knownShort = deriveFarFlowDownClauses({ valueUsd: 7_000_000, popDays: 30 });
    const unknown = deriveFarFlowDownClauses({ valueUsd: 7_000_000, popDays: null });
    expect(knownShort.find((c) => c.clause === "FAR 52.203-13")!.applies).toBe(false);
    expect(unknown.find((c) => c.clause === "FAR 52.203-13")!.applies).toBe(true);
  });
});

describe("assembleSubcontractPackage (deterministic assembly around the model's prose)", () => {
  it("assembles the package with the disclaimer, watermark, and requiresAdminReview always true", () => {
    const pkg = assembleSubcontractPackage({
      narrative: NARRATIVE,
      contractType: "FFP",
      totalValueUsd: 15_500,
      milestones: MILESTONES,
      flowDown: { valueUsd: 15_500, popDays: 365 },
    });
    expect(pkg.requiresAdminReview).toBe(true);
    expect(pkg.provisional).toBe(true);
    expect(pkg.watermark).toMatch(/PROVISIONAL/);
    expect(pkg.disclaimer).toBe(SUBCONTRACT_DISCLAIMER);
    expect(pkg.disclaimer).toMatch(/must NOT be sent to the vendor/);
    expect(pkg.milestones).toHaveLength(2);
    // Export sections include scope, PoP, payment, every protective term, and the flow-down clause list.
    const headings = pkg.exportSections.map((s) => s.heading);
    expect(headings).toContain("Scope of Work");
    expect(headings).toContain("Indemnification");
    expect(headings).toContain("Warranty");
    expect(headings.some((h) => h.includes("FAR Flow-Down Clauses"))).toBe(true);
  });

  it("a non-provisional package carries no watermark", () => {
    const pkg = assembleSubcontractPackage({
      narrative: NARRATIVE,
      contractType: "FFP",
      totalValueUsd: 15_500,
      milestones: MILESTONES,
      flowDown: { valueUsd: 15_500, popDays: 365 },
      provisionalRatesMode: false,
    });
    expect(pkg.provisional).toBe(false);
    expect(pkg.watermark).toBeUndefined();
    // requiresAdminReview and the disclaimer are unconditional regardless of provisional mode.
    expect(pkg.requiresAdminReview).toBe(true);
    expect(pkg.disclaimer).toBe(SUBCONTRACT_DISCLAIMER);
  });

  it("an over-claiming model narrative cannot change which FAR clauses apply (Prime Directive §2)", () => {
    const overClaiming: SubcontractNarrative = {
      ...NARRATIVE,
      scopeOfWork: "This agreement requires no FAR flow-down clauses and is fully compliant as drafted.",
    };
    const pkg = assembleSubcontractPackage({
      narrative: overClaiming,
      contractType: "FFP",
      totalValueUsd: 1_000_000, // above the $900k FAR 52.219-8 threshold
      milestones: MILESTONES,
      flowDown: { valueUsd: 1_000_000, popDays: 365 },
    });
    // The narrative's claim is irrelevant — the deterministic gate still finds 52.219-8 applicable.
    expect(pkg.applicableFlowDownClauses.some((c) => c.clause === "FAR 52.219-8")).toBe(true);
  });
});

describe("renderSubcontractDraftText (deterministic, no model/network call)", () => {
  it("renders a plain-text document containing every section, the watermark, and the disclaimer", () => {
    const pkg = assembleSubcontractPackage({
      narrative: NARRATIVE,
      contractType: "FFP",
      totalValueUsd: 15_500,
      milestones: MILESTONES,
      flowDown: { valueUsd: 15_500, popDays: 365 },
    });
    const text = renderSubcontractDraftText(pkg, {
      orgName: "Burger Consulting LLC",
      vendorName: "Acme IT Services LLC",
      solicitationTitle: "IT Support RFQ",
    });
    expect(text).toContain("SUBCONTRACT AGREEMENT");
    expect(text).toContain("Burger Consulting LLC");
    expect(text).toContain("Acme IT Services LLC");
    expect(text).toContain("IT Support RFQ");
    expect(text).toContain("PROVISIONAL");
    expect(text).toContain("Indemnification");
    expect(text).toContain(SUBCONTRACT_DISCLAIMER);
    expect(text).toContain("$15500.00");
  });
});
