import { describe, expect, it } from "vitest";

import { quoteDocumentKey, vendorQuoteDocumentKey } from "./storage.js";

describe("object-key builders", () => {
  it("prospect-scoped tokenized quote key (quoteDocumentKey)", () => {
    expect(quoteDocumentKey("org1", "prospect1", "quote1", "pdf")).toBe(
      "orgs/org1/prospects/prospect1/quotes/quote1.pdf",
    );
  });

  it("vendor-scoped logged-in quote key (vendorQuoteDocumentKey)", () => {
    expect(vendorQuoteDocumentKey("org1", "vendor1", "quote1", "docx")).toBe(
      "orgs/org1/vendors/vendor1/quotes/quote1.docx",
    );
  });

  it("the two key shapes never collide (prospect prefix vs vendor prefix)", () => {
    // Same ids, different owner kind ⇒ different object paths — a prospect quote and a vendor quote
    // for the same quoteId can coexist in storage without overwriting each other.
    const prospect = quoteDocumentKey("o", "x", "q", "pdf");
    const vendor = vendorQuoteDocumentKey("o", "x", "q", "pdf");
    expect(prospect).not.toBe(vendor);
    expect(vendor).toContain("/vendors/");
    expect(prospect).toContain("/prospects/");
  });
});
