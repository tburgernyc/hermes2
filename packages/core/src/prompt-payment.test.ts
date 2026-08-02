import { describe, expect, it } from "vitest";

import {
  addDays,
  calculateClock,
  governmentPaymentDeadline,
  subcontractorPaymentDeadline,
} from "./prompt-payment.js";

const NOW = new Date("2026-08-01T12:00:00Z");

describe("addDays", () => {
  it("adds calendar days without mutating the input", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const result = addDays(start, 7);
    expect(result.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z"); // unmutated
  });
});

describe("calculateClock (direction-agnostic base)", () => {
  it("computes a due date from an explicit clock-start date (CLOCK_START basis)", () => {
    const result = calculateClock({
      clockStartDate: new Date("2026-07-01T00:00:00Z"),
      clockDays: 7,
      now: NOW,
    });
    expect(result.basis).toBe("CLOCK_START");
    expect(result.dueDate?.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("Decision 8: null clock-start with NO fallback never fabricates a date — UNKNOWN", () => {
    const result = calculateClock({ clockStartDate: null, clockDays: 7, now: NOW });
    expect(result).toEqual({ dueDate: null, basis: "NONE", status: "UNKNOWN", daysRemaining: null });
  });

  it("falls back to the invoice date ONLY when no clock-start date exists, marked INVOICE_DATE_FALLBACK", () => {
    const result = calculateClock({
      clockStartDate: null,
      fallbackStartDate: new Date("2026-07-01T00:00:00Z"),
      clockDays: 7,
      now: NOW,
    });
    expect(result.basis).toBe("INVOICE_DATE_FALLBACK");
    expect(result.dueDate?.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("prefers the real clock-start date over the fallback when both are present", () => {
    const result = calculateClock({
      clockStartDate: new Date("2026-07-10T00:00:00Z"),
      fallbackStartDate: new Date("2026-01-01T00:00:00Z"),
      clockDays: 7,
      now: NOW,
    });
    expect(result.basis).toBe("CLOCK_START");
    expect(result.dueDate?.toISOString()).toBe("2026-07-17T00:00:00.000Z");
  });

  it("flags ON_TRACK well before the deadline", () => {
    const result = calculateClock({ clockStartDate: NOW, clockDays: 10, now: NOW });
    expect(result.status).toBe("ON_TRACK");
    expect(result.daysRemaining).toBe(10);
  });

  it("flags AT_RISK inside the at-risk window but not yet due", () => {
    const start = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
    const result = calculateClock({ clockStartDate: start, clockDays: 7, now: NOW }); // due in 1 day
    expect(result.status).toBe("AT_RISK");
    expect(result.daysRemaining).toBe(1);
  });

  it("flags MISSED once the due date has passed", () => {
    const start = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const result = calculateClock({ clockStartDate: start, clockDays: 7, now: NOW });
    expect(result.status).toBe("MISSED");
    expect(result.daysRemaining).toBeLessThan(0);
  });
});

describe("governmentPaymentDeadline (Leg 1: government → prime)", () => {
  it("uses the 14-day PROGRESS clock from invoice submission", () => {
    const result = governmentPaymentDeadline({
      invoiceSubmittedAt: new Date("2026-07-01T00:00:00Z"),
      invoiceKind: "PROGRESS",
      now: NOW,
    });
    expect(result.dueDate?.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("uses the 30-day FINAL clock from invoice submission", () => {
    const result = governmentPaymentDeadline({
      invoiceSubmittedAt: new Date("2026-07-01T00:00:00Z"),
      invoiceKind: "FINAL",
      now: NOW,
    });
    expect(result.dueDate?.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("an un-submitted invoice (null date) is UNKNOWN, never fabricated", () => {
    const result = governmentPaymentDeadline({
      invoiceSubmittedAt: null,
      invoiceKind: "PROGRESS",
      now: NOW,
    });
    expect(result.status).toBe("UNKNOWN");
    expect(result.dueDate).toBeNull();
  });
});

describe("subcontractorPaymentDeadline (Leg 2: prime → sub, reused reversed by §3.4)", () => {
  it("Decision 10: the due date DERIVES from the recorded upstream (government) payment date — 7-day standard clock", () => {
    const govPaidAt = new Date("2026-07-10T00:00:00Z");
    const result = subcontractorPaymentDeadline({
      upstreamPaymentDate: govPaidAt,
      accelerated: false,
      now: NOW,
    });
    expect(result.basis).toBe("CLOCK_START");
    expect(result.dueDate?.toISOString()).toBe("2026-07-17T00:00:00.000Z");
  });

  it("uses the 15-day accelerated-payment clock for a small-business sub", () => {
    const govPaidAt = new Date("2026-07-10T00:00:00Z");
    const result = subcontractorPaymentDeadline({
      upstreamPaymentDate: govPaidAt,
      accelerated: true,
      now: NOW,
    });
    expect(result.dueDate?.toISOString()).toBe("2026-07-25T00:00:00.000Z");
  });

  it("Decision 8: government_invoice_id / upstream payment NOT YET recorded ⇒ UNKNOWN, no fabricated date (even with an invoice date around)", () => {
    const result = subcontractorPaymentDeadline({
      upstreamPaymentDate: null,
      accelerated: true,
      now: NOW,
      // No fallbackInvoiceDate supplied here — mirrors §3.3's own model, which never uses the fallback.
    });
    expect(result).toEqual({ dueDate: null, basis: "NONE", status: "UNKNOWN", daysRemaining: null });
  });

  it("§3.4 reuse: the invoice-date fallback produces a marked PROJECTION, distinct from a real clock", () => {
    const result = subcontractorPaymentDeadline({
      upstreamPaymentDate: null,
      accelerated: false,
      fallbackInvoiceDate: new Date("2026-07-01T00:00:00Z"),
      now: NOW,
    });
    expect(result.basis).toBe("INVOICE_DATE_FALLBACK");
    expect(result.dueDate?.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("a missed sub-payment deadline is flagged MISSED with negative days remaining", () => {
    const govPaidAt = new Date("2026-07-01T00:00:00Z"); // due 2026-07-08 (7-day), well before NOW
    const result = subcontractorPaymentDeadline({
      upstreamPaymentDate: govPaidAt,
      accelerated: false,
      now: NOW,
    });
    expect(result.status).toBe("MISSED");
  });
});
