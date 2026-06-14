import { beforeAll, describe, expect, it } from "vitest";

import { assertSameOrigin } from "./csrf.js";
import { AuthError } from "./rbac.js";

beforeAll(() => {
  process.env.AUTH_URL = "https://app.burgergov.com";
});

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://app.burgergov.com/api/portal/ping", { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("allows a same-origin POST (matching Origin host)", () => {
    expect(() => assertSameOrigin(reqWith({ origin: "https://app.burgergov.com" }))).not.toThrow();
  });

  it("rejects a cross-origin POST", () => {
    expect(() => assertSameOrigin(reqWith({ origin: "https://evil.example" }))).toThrow(AuthError);
  });

  it("rejects a request with no Origin or Referer", () => {
    expect(() => assertSameOrigin(reqWith({}))).toThrow(AuthError);
  });

  it("falls back to the Referer host when Origin is absent", () => {
    expect(() =>
      assertSameOrigin(reqWith({ referer: "https://app.burgergov.com/login" })),
    ).not.toThrow();
  });
});
