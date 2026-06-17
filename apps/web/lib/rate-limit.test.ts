import { describe, expect, it } from "vitest";

import { clientKey, rateLimit } from "./rate-limit";

// Each test uses a UNIQUE key — the limiter's bucket Map is module-level state shared across the file.
describe("rateLimit", () => {
  it("allows up to maxHits then blocks within the window", () => {
    const key = "test:allow-then-block";
    const now = 1_000_000;
    for (let i = 0; i < 10; i += 1) {
      expect(rateLimit(key, { now })).toBe(true); // default maxHits = 10
    }
    expect(rateLimit(key, { now })).toBe(false); // 11th in the same window is blocked
  });

  it("resets after the window elapses", () => {
    const key = "test:reset";
    const now = 5_000_000;
    expect(rateLimit(key, { maxHits: 1, now })).toBe(true);
    expect(rateLimit(key, { maxHits: 1, now })).toBe(false);
    // Past the window (default 60s) the bucket resets.
    expect(rateLimit(key, { maxHits: 1, now: now + 60_001 })).toBe(true);
  });

  it("honors a custom maxHits", () => {
    const key = "test:custom-max";
    const now = 9_000_000;
    expect(rateLimit(key, { maxHits: 3, now })).toBe(true);
    expect(rateLimit(key, { maxHits: 3, now })).toBe(true);
    expect(rateLimit(key, { maxHits: 3, now })).toBe(true);
    expect(rateLimit(key, { maxHits: 3, now })).toBe(false);
  });

  it("honors a custom windowMs", () => {
    const key = "test:custom-window";
    const now = 11_000_000;
    expect(rateLimit(key, { maxHits: 1, windowMs: 300_000, now })).toBe(true);
    // Still inside the 5-minute window → blocked even though 60s has passed.
    expect(rateLimit(key, { maxHits: 1, windowMs: 300_000, now: now + 120_000 })).toBe(false);
    // After the custom window → allowed.
    expect(rateLimit(key, { maxHits: 1, windowMs: 300_000, now: now + 300_001 })).toBe(true);
  });

  it("isolates buckets by key", () => {
    const now = 13_000_000;
    expect(rateLimit("test:iso-a", { maxHits: 1, now })).toBe(true);
    expect(rateLimit("test:iso-a", { maxHits: 1, now })).toBe(false);
    // A different key is unaffected.
    expect(rateLimit("test:iso-b", { maxHits: 1, now })).toBe(true);
  });
});

describe("clientKey", () => {
  it("prefers Fly-Client-IP (edge-stamped, not client-forwardable)", () => {
    expect(clientKey("203.0.113.5", "1.2.3.4", "login")).toBe("login:203.0.113.5");
  });

  it("falls back to the RIGHTMOST X-Forwarded-For entry (not the spoofable leftmost)", () => {
    expect(clientKey(null, "1.1.1.1, 2.2.2.2, 9.9.9.9", "contact")).toBe("contact:9.9.9.9");
  });

  it("falls back to 'unknown' when no proxy header is present", () => {
    expect(clientKey(null, null, "totp")).toBe("totp:unknown");
  });
});
