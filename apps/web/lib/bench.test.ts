import { describe, expect, it } from "vitest";

import { extractNaicsCodes, parseNaics, stripNaicsTag, tagNaicsIntoCapabilities } from "./bench";

describe("parseNaics", () => {
  it("keeps only well-formed 6-digit codes, comma/space separated", () => {
    expect(parseNaics("541511, 541512  541519")).toEqual(["541511", "541512", "541519"]);
  });

  it("drops malformed tokens (too short, too long, non-numeric)", () => {
    expect(parseNaics("54151, 5415199, ABCDEF, 541511")).toEqual(["541511"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseNaics("")).toEqual([]);
    expect(parseNaics("   ")).toEqual([]);
  });
});

describe("tagNaicsIntoCapabilities / extractNaicsCodes round-trip", () => {
  it("folds NAICS codes into a normalized leading line", () => {
    const tagged = tagNaicsIntoCapabilities(["541511", "541512"], "Cloud migration and help desk.");
    expect(tagged).toBe("NAICS: 541511, 541512\n\nCloud migration and help desk.");
  });

  it("round-trips: extractNaicsCodes recovers exactly the tagged codes", () => {
    const tagged = tagNaicsIntoCapabilities(["541511", "541519"], "Some capability text.");
    expect(extractNaicsCodes(tagged)).toEqual(["541511", "541519"]);
  });

  it("with no NAICS codes, returns the body untouched and extraction finds nothing", () => {
    const tagged = tagNaicsIntoCapabilities([], "Just a description, no NAICS given.");
    expect(tagged).toBe("Just a description, no NAICS given.");
    expect(extractNaicsCodes(tagged)).toEqual([]);
  });

  it("with NAICS codes but empty description, the tag line stands alone", () => {
    const tagged = tagNaicsIntoCapabilities(["541511"], null);
    expect(tagged).toBe("NAICS: 541511");
  });

  it("extractNaicsCodes on untagged free text returns empty (never guesses)", () => {
    expect(extractNaicsCodes("We do cloud work under NAICS-ish numbers somewhere.")).toEqual([]);
    expect(extractNaicsCodes(null)).toEqual([]);
  });
});

describe("stripNaicsTag", () => {
  it("removes the leading NAICS tag line, leaving the clean description", () => {
    const tagged = tagNaicsIntoCapabilities(["541511"], "Cloud migration and help desk.");
    expect(stripNaicsTag(tagged)).toBe("Cloud migration and help desk.");
  });

  it("is a no-op on text with no tag", () => {
    expect(stripNaicsTag("Plain description.")).toBe("Plain description.");
  });

  it("handles null", () => {
    expect(stripNaicsTag(null)).toBe("");
  });
});
