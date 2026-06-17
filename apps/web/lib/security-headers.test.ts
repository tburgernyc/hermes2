import { describe, expect, it } from "vitest";

import {
  buildCsp,
  generateNonce,
  HSTS_VALUE,
  isHttpsRequest,
  PERMISSIONS_POLICY,
  STATIC_SECURITY_HEADERS,
} from "./security-headers";

describe("buildCsp", () => {
  const csp = buildCsp("TESTNONCE", true);

  it("uses a strict, nonce'd script-src with strict-dynamic and no unsafe-inline", () => {
    expect(csp).toContain("script-src 'self' 'nonce-TESTNONCE' 'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-inline ONLY in style-src (inline style attrs on admin/portal pages)", () => {
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("locks down framing, objects, base, and forms", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("allowlists only browser-reachable hosts in connect-src/img-src (no server-only providers)", () => {
    expect(csp).toContain(
      "connect-src 'self' https://fly.storage.tigris.dev https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
    );
    expect(csp).toContain("img-src 'self' data: https://fly.storage.tigris.dev");
    expect(csp).not.toContain("anthropic");
    expect(csp).not.toContain("resend");
    expect(csp).not.toContain("voyage");
  });

  it("includes the report-uri", () => {
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("adds upgrade-insecure-requests ONLY over https", () => {
    expect(buildCsp("N", true)).toContain("upgrade-insecure-requests");
    expect(buildCsp("N", false)).not.toContain("upgrade-insecure-requests");
  });
});

describe("generateNonce", () => {
  it("returns distinct base64 values", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe("isHttpsRequest", () => {
  it("trusts x-forwarded-proto=https", () => {
    expect(isHttpsRequest("https", "http:")).toBe(true);
  });
  it("falls back to the URL protocol", () => {
    expect(isHttpsRequest(null, "https:")).toBe(true);
  });
  it("is false over plaintext", () => {
    expect(isHttpsRequest("http", "http:")).toBe(false);
    expect(isHttpsRequest(null, "http:")).toBe(false);
  });
});

describe("static header set", () => {
  it("includes the core protocol-independent headers", () => {
    const map = new Map(STATIC_SECURITY_HEADERS.map((h) => [h.key, h.value]));
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(map.get("Permissions-Policy")).toBe(PERMISSIONS_POLICY);
  });

  it("denies the dangerous Permissions-Policy features", () => {
    expect(PERMISSIONS_POLICY).toContain("camera=()");
    expect(PERMISSIONS_POLICY).toContain("microphone=()");
    expect(PERMISSIONS_POLICY).toContain("geolocation=()");
  });

  it("sets a 1-year HSTS without preload", () => {
    expect(HSTS_VALUE).toBe("max-age=31536000; includeSubDomains");
    expect(HSTS_VALUE).not.toContain("preload");
  });
});
