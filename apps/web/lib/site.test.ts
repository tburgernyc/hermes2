import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  CREDENTIALS,
  NAICS,
  PRINCIPAL,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "@/lib/site";

/**
 * Brand-config smoke + truthfulness invariants. Plain-TS import (no JSX) so it runs under node Vitest.
 * Replaces the old page smoke test; these guard the literal-truth contract (CLAUDE.md): no fabricated
 * CAGE value, the public brand replaces the internal "Hermes 2.0" name, and the firm is founder-led.
 */
describe("site brand config", () => {
  it("uses the public BurgerGov brand, not the internal Hermes 2.0 name", () => {
    expect(SITE_TITLE).toContain("BurgerGov");
    expect(SITE_TITLE).not.toContain("Hermes");
    expect(SITE_DESCRIPTION.length).toBeGreaterThan(0);
  });

  it("names the accountable principal", () => {
    expect(PRINCIPAL.name).toBe("Timothy Burger");
    expect(PRINCIPAL.title).toMatch(/CEO/);
  });

  it("lists exactly the four offerings the firm actually provides", () => {
    expect(CAPABILITIES).toHaveLength(4);
    for (const c of CAPABILITIES) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.summary.length).toBeGreaterThan(0);
    }
  });

  it("maps to the primary NAICS codes", () => {
    const codes = NAICS.map((n) => n.code);
    expect(codes).toEqual(["541511", "541512", "541519"]);
  });

  it("shows the CAGE code as a visible placeholder, never a fabricated value", () => {
    const cage = CREDENTIALS.find((c) => c.label.includes("CAGE"));
    expect(cage?.state).toBe("pending");
    // A fabricated CAGE would be a 5-char alphanumeric; the placeholder must not look like one.
    expect(cage?.value).not.toMatch(/^[A-Z0-9]{5}$/);
  });

  it("marks SAM registration as confirmed Active", () => {
    const sam = CREDENTIALS.find((c) => c.label.includes("SAM"));
    expect(sam?.state).toBe("confirmed");
    expect(sam?.value).toBe("Active");
  });
});
