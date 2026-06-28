/**
 * Phase B sourcing connectors + deterministic pre-vet — PURE units (no network, no DB). Proves the
 * load-bearing safety property: an EXCLUDED entity (and an entity whose exclusion status is UNKNOWN) is a
 * HARD BLOCK, and malformed/empty responses fail CLOSED (empty list / null), never a fabricated success.
 */
import { describe, expect, it } from "vitest";

import {
  buildPastPerformanceBody,
  buildSamEntityUrl,
  deriveCapabilitiesText,
  parsePastPerformance,
  parseSamEntities,
  prevetEntity,
  SAM_ENTITY_ENDPOINT,
  type DiscoveredEntity,
} from "../src/sourcing.js";

/** A SAM Entity v3 record (synthetic). `excl` controls the exclusionStatusFlag, `status` the registration. */
function samRecord(opts: {
  uei: string;
  status?: string;
  excl?: string;
  naics?: { code: string; small?: string }[];
}): Record<string, unknown> {
  return {
    entityRegistration: {
      ueiSAM: opts.uei,
      cageCode: "1ABC2",
      legalBusinessName: `Entity ${opts.uei}`,
      registrationStatus: opts.status ?? "Active",
      exclusionStatusFlag: opts.excl ?? "N",
    },
    assertions: {
      goodsAndServices: {
        primaryNaics: opts.naics?.[0]?.code ?? "541511",
        naicsList: (opts.naics ?? [{ code: "541511", small: "Y" }]).map((n) => ({
          naicsCode: n.code,
          sbaSmallBusiness: n.small ?? "N",
        })),
      },
    },
    pointsOfContact: { governmentBusinessPOC: { email: `poc-${opts.uei}@example.test` } },
  };
}

function samResponse(records: Record<string, unknown>[]): string {
  return JSON.stringify({ totalRecords: records.length, entityData: records });
}

describe("buildSamEntityUrl", () => {
  it("targets the Entity v3 endpoint, filters active + the NAICS, and carries the api key", () => {
    const url = new URL(buildSamEntityUrl("541512", "KEY123", { size: 10 }));
    expect(`${url.origin}${url.pathname}`).toBe(SAM_ENTITY_ENDPOINT);
    expect(url.searchParams.get("naicsCode")).toBe("541512");
    expect(url.searchParams.get("registrationStatus")).toBe("A");
    expect(url.searchParams.get("api_key")).toBe("KEY123");
    expect(url.searchParams.get("size")).toBe("10");
    expect(url.searchParams.get("includeSections")).toContain("entityRegistration");
  });
});

describe("parseSamEntities", () => {
  it("parses UEI/CAGE/POC/NAICS/small-business + exclusion flag", () => {
    const out = parseSamEntities(
      samResponse([samRecord({ uei: "ABC123DEF456", naics: [{ code: "541511", small: "Y" }] })]),
    );
    expect(out).toHaveLength(1);
    const e = out[0]!;
    expect(e.uei).toBe("ABC123DEF456");
    expect(e.cageCode).toBe("1ABC2");
    expect(e.pocEmail).toBe("poc-ABC123DEF456@example.test");
    expect(e.naicsCodes).toContain("541511");
    expect(e.smallUnderNaics).toContain("541511");
    expect(e.registrationActive).toBe(true);
    expect(e.excluded).toBe(false);
  });

  it("maps an explicit exclusion flag to excluded:true and an absent flag to null (unknown)", () => {
    const [excluded] = parseSamEntities(samResponse([samRecord({ uei: "EXCL00000001", excl: "Y" })]));
    expect(excluded!.excluded).toBe(true);

    const noFlag = samRecord({ uei: "UNKN00000001" });
    delete (noFlag.entityRegistration as Record<string, unknown>).exclusionStatusFlag;
    const [unknown] = parseSamEntities(samResponse([noFlag]));
    expect(unknown!.excluded).toBeNull();
  });

  it("skips a record with no UEI and returns [] for malformed JSON (fail-closed, never throws)", () => {
    const noUei = samRecord({ uei: "X" });
    delete (noUei.entityRegistration as Record<string, unknown>).ueiSAM;
    expect(parseSamEntities(samResponse([noUei]))).toHaveLength(0);
    expect(parseSamEntities("}{ not json")).toEqual([]);
    expect(parseSamEntities(JSON.stringify({ unexpected: true }))).toEqual([]);
  });
});

describe("prevetEntity (deterministic — exclusion is a HARD BLOCK)", () => {
  const base: DiscoveredEntity = {
    uei: "ABC123DEF456",
    cageCode: "1ABC2",
    legalName: "Acme",
    pocEmail: "a@example.test",
    primaryNaics: "541511",
    naicsCodes: ["541511"],
    smallUnderNaics: ["541511"],
    registrationActive: true,
    excluded: false,
  };

  it("passes an active, not-excluded, NAICS-overlapping small entity", () => {
    const r = prevetEntity(base, { solicitationNaics: "541511" });
    expect(r.pass).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.flags.exclusionClear).toBe(true);
    expect(r.flags.smallUnderSubcontractNaics).toBe(true);
    expect(r.flags.naicsOverlap).toEqual(["541511"]);
  });

  it("HARD BLOCKS an excluded entity", () => {
    const r = prevetEntity({ ...base, excluded: true }, { solicitationNaics: "541511" });
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain("entity is excluded/debarred");
  });

  it("HARD BLOCKS an UNKNOWN exclusion status (fail-closed — never surface a maybe-debarred entity)", () => {
    const r = prevetEntity({ ...base, excluded: null }, { solicitationNaics: "541511" });
    expect(r.pass).toBe(false);
    expect(r.flags.exclusionClear).toBe(false);
    expect(r.reasons).toContain("exclusion status unknown");
  });

  it("HARD BLOCKS an inactive registration and a no-NAICS-overlap entity", () => {
    expect(
      prevetEntity({ ...base, registrationActive: false }, { solicitationNaics: "541511" }).pass,
    ).toBe(false);
    expect(prevetEntity({ ...base, naicsCodes: ["541330"] }, { solicitationNaics: "541511" }).pass).toBe(
      false,
    );
  });

  it("surfaces a non-small sub (size is an advisory flag, not a block)", () => {
    const r = prevetEntity({ ...base, smallUnderNaics: [] }, { solicitationNaics: "541511" });
    expect(r.pass).toBe(true); // still surfaced
    expect(r.flags.smallUnderSubcontractNaics).toBe(false); // ...but flagged for the 52.219-14 math
  });
});

describe("USASpending past-performance + capability text", () => {
  it("builds a recipient/NAICS award filter and summarizes results (null on none)", () => {
    const body = JSON.parse(buildPastPerformanceBody("Acme Corp", ["541511", "bad"])) as {
      filters: { recipient_search_text: string[]; naics_codes: string[] };
    };
    expect(body.filters.recipient_search_text).toEqual(["Acme Corp"]);
    expect(body.filters.naics_codes).toEqual(["541511"]); // the malformed NAICS is dropped

    const pp = parsePastPerformance(
      JSON.stringify({
        results: [
          { "Award Amount": 100, "Awarding Agency": "GSA" },
          { "Award Amount": 250, "Awarding Agency": "DHS" },
        ],
      }),
    );
    expect(pp).toEqual({ awardCount: 2, totalAwarded: 350, agencies: ["GSA", "DHS"] });
    expect(parsePastPerformance(JSON.stringify({ results: [] }))).toBeNull();
    expect(parsePastPerformance("not json")).toBeNull();
  });

  it("derives capability text from the entity NAICS (used as embedding/scoring input, never instructions)", () => {
    const text = deriveCapabilitiesText({
      uei: "ABC123DEF456",
      cageCode: null,
      legalName: "Acme",
      pocEmail: null,
      primaryNaics: "541511",
      naicsCodes: ["541511", "541512"],
      smallUnderNaics: ["541511"],
      registrationActive: true,
      excluded: false,
    });
    expect(text).toContain("Acme");
    expect(text).toContain("541512");
  });
});
