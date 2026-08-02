import { describe, expect, it } from "vitest";

import { daysUntil, expiryReminderLevel } from "./expiry-reminder.js";

const NOW = new Date("2026-08-01T00:00:00Z");

describe("daysUntil", () => {
  it("computes calendar days between two dates", () => {
    expect(daysUntil(new Date("2026-08-11T00:00:00Z"), NOW)).toBe(10);
    expect(daysUntil(new Date("2026-07-22T00:00:00Z"), NOW)).toBe(-10);
  });
});

describe("expiryReminderLevel", () => {
  it("null expiresAt ⇒ NONE, no fabricated countdown", () => {
    expect(expiryReminderLevel({ expiresAt: null, now: NOW })).toEqual({
      level: "NONE",
      daysRemaining: null,
    });
  });

  it("far in the future ⇒ NONE", () => {
    const expiresAt = new Date(NOW.getTime() + 90 * 86_400_000);
    expect(expiryReminderLevel({ expiresAt, now: NOW }).level).toBe("NONE");
  });

  it("exactly at the 60-day mark ⇒ DUE_60", () => {
    const expiresAt = new Date(NOW.getTime() + 60 * 86_400_000);
    const result = expiryReminderLevel({ expiresAt, now: NOW });
    expect(result.level).toBe("DUE_60");
    expect(result.daysRemaining).toBe(60);
  });

  it("45 days out ⇒ still DUE_60 (inside the 60-day window, outside the 30-day one)", () => {
    const expiresAt = new Date(NOW.getTime() + 45 * 86_400_000);
    expect(expiryReminderLevel({ expiresAt, now: NOW }).level).toBe("DUE_60");
  });

  it("exactly at the 30-day mark ⇒ DUE_30", () => {
    const expiresAt = new Date(NOW.getTime() + 30 * 86_400_000);
    const result = expiryReminderLevel({ expiresAt, now: NOW });
    expect(result.level).toBe("DUE_30");
    expect(result.daysRemaining).toBe(30);
  });

  it("past the expiry date ⇒ EXPIRED with negative daysRemaining", () => {
    const expiresAt = new Date(NOW.getTime() - 5 * 86_400_000);
    const result = expiryReminderLevel({ expiresAt, now: NOW });
    expect(result.level).toBe("EXPIRED");
    expect(result.daysRemaining).toBeLessThan(0);
  });
});
