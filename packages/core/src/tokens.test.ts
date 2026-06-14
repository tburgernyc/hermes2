import { beforeAll, describe, expect, it } from "vitest";

import { mintToken, TokenError, verifyToken } from "./tokens.js";

beforeAll(() => {
  process.env.TOKEN_SIGNING_SECRET = "x".repeat(40);
});

describe("portal tokens", () => {
  const base = { orgId: "org-1", prospectId: "prospect-1", solicitationId: "sol-1" } as const;

  it("mints and verifies a quote token for the matching purpose", () => {
    const token = mintToken({ purpose: "QUOTE_SUBMISSION", ...base });
    const payload = verifyToken(token, "QUOTE_SUBMISSION");
    expect(payload.org).toBe("org-1");
    expect(payload.prospect).toBe("prospect-1");
    expect(payload.sol).toBe("sol-1");
  });

  it("rejects a token used for the WRONG purpose (opt-out can't submit a quote)", () => {
    const optout = mintToken({ purpose: "OPT_OUT", orgId: "org-1", prospectId: "prospect-1" });
    expect(() => verifyToken(optout, "QUOTE_SUBMISSION")).toThrow(TokenError);
  });

  it("rejects a tampered signature", () => {
    const token = mintToken({ purpose: "QUOTE_SUBMISSION", ...base });
    const [body] = token.split(".");
    expect(() => verifyToken(`${body}.deadbeefdeadbeef`, "QUOTE_SUBMISSION")).toThrow(/bad signature/);
  });

  it("rejects an expired token", () => {
    const expired = mintToken({ purpose: "QUOTE_SUBMISSION", ...base, ttlDays: -1 });
    expect(() => verifyToken(expired, "QUOTE_SUBMISSION")).toThrow(/expired/);
  });
});
