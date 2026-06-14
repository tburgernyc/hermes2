/**
 * SSRF guard unit (no network, no DB). The URL-validation half of safeFetchDocument is pure, so it runs
 * in every environment — including a DSN-less local run. Proves: https-only, host allowlist, private/
 * link-local rejection, and that a disallowed host is refused BEFORE any fetch is issued.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { assertSafeUrl, safeFetchDocument } from "../src/safety.js";

describe("assertSafeUrl", () => {
  it("rejects non-https", () => {
    expect(() => assertSafeUrl("http://api.sam.gov/x")).toThrow(/https only/);
  });

  it("rejects a non-allowlisted host", () => {
    expect(() => assertSafeUrl("https://evil.example.com/x")).toThrow(/not allowlisted/);
  });

  it("rejects private / link-local addresses", () => {
    expect(() => assertSafeUrl("https://127.0.0.1/x")).toThrow();
    expect(() => assertSafeUrl("https://169.254.169.254/latest/meta-data")).toThrow();
    expect(() => assertSafeUrl("https://10.0.0.5/x")).toThrow();
  });

  it("accepts allowlisted https hosts", () => {
    expect(assertSafeUrl("https://api.sam.gov/opportunities").hostname).toBe("api.sam.gov");
    expect(assertSafeUrl("https://api.usaspending.gov/api/v2").hostname).toBe("api.usaspending.gov");
  });
});

describe("safeFetchDocument", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches an allowlisted host with redirect:error", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { contentType } = await safeFetchDocument("https://api.sam.gov/x", {
      allowedTypes: ["application/json"],
    });
    expect(contentType).toContain("application/json");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.sam.gov/x",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("refuses a disallowed host before issuing any fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(safeFetchDocument("https://evil.example.com/x")).rejects.toThrow(/not allowlisted/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a disallowed content-type", async () => {
    const fetchSpy = vi.fn(
      async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      safeFetchDocument("https://api.sam.gov/x", { allowedTypes: ["application/json"] }),
    ).rejects.toThrow(/content-type/);
  });
});
