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

describe("vendor-invite tokens", () => {
  it("mints and verifies a vendor-scoped invite (vendor present, NO prospect)", () => {
    const token = mintToken({ purpose: "VENDOR_INVITE", orgId: "org-1", vendorId: "vendor-9" });
    const payload = verifyToken(token, "VENDOR_INVITE");
    expect(payload.org).toBe("org-1");
    expect(payload.vendor).toBe("vendor-9");
    expect(payload.prospect).toBeUndefined();
  });

  it("rejects an invite token used to submit a quote, and a quote token on the invite route", () => {
    const invite = mintToken({ purpose: "VENDOR_INVITE", orgId: "org-1", vendorId: "vendor-9" });
    expect(() => verifyToken(invite, "QUOTE_SUBMISSION")).toThrow(TokenError);
    const quote = mintToken({ purpose: "QUOTE_SUBMISSION", orgId: "org-1", prospectId: "prospect-1" });
    expect(() => verifyToken(quote, "VENDOR_INVITE")).toThrow(TokenError);
  });

  it("refuses to mint an invite without a vendor, or carrying a prospect", () => {
    expect(() => mintToken({ purpose: "VENDOR_INVITE", orgId: "org-1" })).toThrow(/requires vendorId/);
    expect(() =>
      mintToken({ purpose: "VENDOR_INVITE", orgId: "org-1", vendorId: "v", prospectId: "p" }),
    ).toThrow(/must not carry a prospect/);
  });

  it("refuses to mint a prospect-scoped token that carries a vendor", () => {
    expect(() =>
      mintToken({ purpose: "QUOTE_SUBMISSION", orgId: "org-1", prospectId: "p", vendorId: "v" }),
    ).toThrow(/must not carry a vendor/);
  });
});
