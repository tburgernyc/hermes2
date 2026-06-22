/**
 * SAM.gov search-URL builder unit (no network, no DB). `buildSamSearchUrl` is pure + exported, so it runs
 * in every environment. Proves the query the live ingest issues against api.sam.gov is well-formed: the
 * REQUIRED postedFrom/postedTo window (MM/dd/yyyy, ≤ the configured days), the NAICS `ncode` list, the
 * fixed limit + api_key, and that a set-aside filter is included only when configured.
 */
import { describe, expect, it } from "vitest";

import { buildSamSearchUrl } from "../src/logic.js";

const KEY = "TEST_KEY_123";
const NOW = new Date("2026-06-22T12:00:00Z");

function paramsOf(urlStr: string): URLSearchParams {
  const url = new URL(urlStr);
  return url.searchParams;
}

describe("buildSamSearchUrl", () => {
  it("targets the SAM.gov Opportunities v2 search endpoint", () => {
    const url = new URL(buildSamSearchUrl(["541511"], KEY, { now: NOW, windowDays: 7 }));
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("api.sam.gov");
    expect(url.pathname).toBe("/opportunities/v2/search");
  });

  it("includes the NAICS list as a comma-joined ncode and the api_key + limit", () => {
    const p = paramsOf(buildSamSearchUrl(["541511", "541512"], KEY, { now: NOW, windowDays: 7 }));
    expect(p.get("ncode")).toBe("541511,541512");
    expect(p.get("api_key")).toBe(KEY);
    expect(p.get("limit")).toBe("100");
  });

  it("always sets the REQUIRED postedFrom/postedTo window in MM/dd/yyyy", () => {
    const p = paramsOf(buildSamSearchUrl(["541511"], KEY, { now: NOW, windowDays: 7 }));
    // NOW is 2026-06-22; a 7-day window starts 2026-06-15. Format is MM/dd/yyyy.
    expect(p.get("postedTo")).toBe("06/22/2026");
    expect(p.get("postedFrom")).toBe("06/15/2026");
  });

  it("derives postedFrom from the window size", () => {
    const p = paramsOf(buildSamSearchUrl(["541511"], KEY, { now: NOW, windowDays: 30 }));
    expect(p.get("postedTo")).toBe("06/22/2026");
    expect(p.get("postedFrom")).toBe("05/23/2026");
  });

  it("omits typeOfSetAside when no set-aside filter is configured", () => {
    const noOpt = paramsOf(buildSamSearchUrl(["541511"], KEY, { now: NOW, windowDays: 7 }));
    expect(noOpt.has("typeOfSetAside")).toBe(false);
    const emptyOpt = paramsOf(
      buildSamSearchUrl(["541511"], KEY, { now: NOW, windowDays: 7, setAside: [] }),
    );
    expect(emptyOpt.has("typeOfSetAside")).toBe(false);
  });

  it("includes typeOfSetAside (comma-joined) when a set-aside filter is configured", () => {
    const p = paramsOf(
      buildSamSearchUrl(["541511"], KEY, { now: NOW, windowDays: 7, setAside: ["SBA", "SBP"] }),
    );
    expect(p.get("typeOfSetAside")).toBe("SBA,SBP");
  });
});
