import { describe, expect, it } from "vitest";

import { computeApprovedHours, daysLate, todayIsoDate, weekPeriodBounds } from "./timekeeping.js";
import type { ApprovedHoursEntry } from "./timekeeping.js";

describe("weekPeriodBounds", () => {
  it("resolves a mid-week date to its Monday–Sunday bounds", () => {
    // 2026-07-15 is a Wednesday.
    expect(weekPeriodBounds("2026-07-15")).toEqual({ periodStart: "2026-07-13", periodEnd: "2026-07-19" });
  });

  it("a Monday maps to itself as periodStart", () => {
    expect(weekPeriodBounds("2026-07-13")).toEqual({ periodStart: "2026-07-13", periodEnd: "2026-07-19" });
  });

  it("a Sunday maps to the PRECEDING Monday (still same week)", () => {
    expect(weekPeriodBounds("2026-07-19")).toEqual({ periodStart: "2026-07-13", periodEnd: "2026-07-19" });
  });

  it("handles a month boundary correctly", () => {
    // 2026-08-01 is a Saturday; that week starts Monday 2026-07-27.
    expect(weekPeriodBounds("2026-08-01")).toEqual({ periodStart: "2026-07-27", periodEnd: "2026-08-02" });
  });

  it("rejects a malformed date", () => {
    expect(() => weekPeriodBounds("not-a-date")).toThrow();
  });
});

describe("daysLate", () => {
  it("is 0 for same-day entry (the DCAA-expected case)", () => {
    expect(daysLate("2026-07-15", "2026-07-15")).toBe(0);
  });

  it("is positive for retroactive/catch-up entry", () => {
    expect(daysLate("2026-07-10", "2026-07-15")).toBe(5);
  });

  it("is negative for a future-dated work date (measurement only — callers reject separately)", () => {
    expect(daysLate("2026-07-20", "2026-07-15")).toBe(-5);
  });

  it("defaults `loggedOn` to today", () => {
    expect(daysLate(todayIsoDate())).toBe(0);
  });
});

describe("computeApprovedHours", () => {
  const CONTRACT_A = "11111111-1111-1111-1111-111111111111";
  const CONTRACT_B = "22222222-2222-2222-2222-222222222222";
  const MILESTONE_1 = "33333333-3333-3333-3333-333333333333";
  const MILESTONE_2 = "44444444-4444-4444-4444-444444444444";

  function entry(overrides: Partial<ApprovedHoursEntry>): ApprovedHoursEntry {
    return {
      contractId: CONTRACT_A,
      milestoneId: null,
      workDate: "2026-07-15",
      hours: "8.00",
      chargeClass: "DIRECT",
      periodStatus: "APPROVED",
      ...overrides,
    };
  }

  it("sums DIRECT hours from APPROVED entries on the queried contract", () => {
    const entries = [entry({ hours: "8.00" }), entry({ hours: "6.50" })];
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A })).toBe(14.5);
  });

  it("excludes entries whose period is not APPROVED (OPEN or SUBMITTED)", () => {
    const entries = [
      entry({ hours: "8.00", periodStatus: "APPROVED" }),
      entry({ hours: "8.00", periodStatus: "SUBMITTED" }),
      entry({ hours: "8.00", periodStatus: "OPEN" }),
    ];
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A })).toBe(8);
  });

  it("excludes INDIRECT hours even when APPROVED (never billable to a specific contract)", () => {
    const entries = [
      entry({ hours: "8.00", chargeClass: "DIRECT" }),
      entry({ hours: "3.00", chargeClass: "INDIRECT" }),
    ];
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A })).toBe(8);
  });

  it("scopes to the requested contract only", () => {
    const entries = [entry({ contractId: CONTRACT_A, hours: "5.00" }), entry({ contractId: CONTRACT_B, hours: "9.00" })];
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A })).toBe(5);
    expect(computeApprovedHours(entries, { contractId: CONTRACT_B })).toBe(9);
  });

  it("scopes to a milestone when one is requested", () => {
    const entries = [
      entry({ milestoneId: MILESTONE_1, hours: "4.00" }),
      entry({ milestoneId: MILESTONE_2, hours: "7.00" }),
      entry({ milestoneId: null, hours: "1.00" }),
    ];
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A, milestoneId: MILESTONE_1 })).toBe(4);
    // No milestone filter ⇒ all contract-matching entries count regardless of milestone.
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A })).toBe(12);
  });

  it("applies an inclusive date window", () => {
    const entries = [
      entry({ workDate: "2026-07-01", hours: "1.00" }),
      entry({ workDate: "2026-07-15", hours: "2.00" }),
      entry({ workDate: "2026-07-31", hours: "4.00" }),
    ];
    expect(
      computeApprovedHours(entries, { contractId: CONTRACT_A, from: "2026-07-01", to: "2026-07-15" }),
    ).toBe(3);
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A, from: "2026-07-15" })).toBe(6);
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A, to: "2026-07-15" })).toBe(3);
  });

  it("accepts numeric hours (not just numeric-string) and rounds to 2 decimals", () => {
    const entries = [entry({ hours: 1.005 }), entry({ hours: 1.005 })];
    expect(computeApprovedHours(entries, { contractId: CONTRACT_A })).toBe(2.01);
  });

  it("returns 0 for no matching entries", () => {
    expect(computeApprovedHours([], { contractId: CONTRACT_A })).toBe(0);
  });
});
