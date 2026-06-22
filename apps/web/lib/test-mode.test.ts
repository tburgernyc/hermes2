import { afterEach, describe, expect, it, vi } from "vitest";

import { isCounselAutofill, isSubmitTestMode } from "./test-mode";

// These read process.env directly; restore it after each case so the suite stays isolated.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSubmitTestMode", () => {
  it("is false by default (production posture)", () => {
    vi.stubEnv("HERMES_TEST_MODE", "");
    expect(isSubmitTestMode()).toBe(false);
  });

  it("is true only for the exact string 'true'", () => {
    vi.stubEnv("HERMES_TEST_MODE", "true");
    expect(isSubmitTestMode()).toBe(true);
  });

  it("is false for any other truthy-looking value", () => {
    vi.stubEnv("HERMES_TEST_MODE", "1");
    expect(isSubmitTestMode()).toBe(false);
    vi.stubEnv("HERMES_TEST_MODE", "TRUE");
    expect(isSubmitTestMode()).toBe(false);
  });
});

describe("isCounselAutofill", () => {
  it("is false by default", () => {
    vi.stubEnv("HERMES_TEST_MODE", "");
    vi.stubEnv("COUNSEL_AUTOFILL", "");
    expect(isCounselAutofill()).toBe(false);
  });

  it("REQUIRES the master test flag — COUNSEL_AUTOFILL alone never lifts the counsel gate", () => {
    vi.stubEnv("HERMES_TEST_MODE", "");
    vi.stubEnv("COUNSEL_AUTOFILL", "true");
    expect(isCounselAutofill()).toBe(false);
  });

  it("is true only when BOTH flags are set to 'true'", () => {
    vi.stubEnv("HERMES_TEST_MODE", "true");
    vi.stubEnv("COUNSEL_AUTOFILL", "true");
    expect(isCounselAutofill()).toBe(true);
  });

  it("is false when the master flag is on but autofill is off", () => {
    vi.stubEnv("HERMES_TEST_MODE", "true");
    vi.stubEnv("COUNSEL_AUTOFILL", "");
    expect(isCounselAutofill()).toBe(false);
  });
});
