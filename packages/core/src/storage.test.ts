import { afterEach, describe, expect, it } from "vitest";

import {
  contractDocumentKey,
  getStorage,
  quoteDocumentKey,
  solicitationDocumentKey,
  vendorQuoteDocumentKey,
} from "./storage.js";

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

  it("system-generated contract document key (contractDocumentKey), keyed by documentId not a fixed name", () => {
    expect(contractDocumentKey("org1", "contract1", "doc1", "md")).toBe(
      "orgs/org1/contracts/contract1/documents/doc1.md",
    );
    // A second document against the same contract (e.g. a later signed copy) never collides.
    const draft = contractDocumentKey("org1", "contract1", "doc1", "md");
    const signed = contractDocumentKey("org1", "contract1", "doc2", "pdf");
    expect(draft).not.toBe(signed);
  });

  it("system-generated solicitation document key (solicitationDocumentKey — §3.8.1 capability statements)", () => {
    expect(solicitationDocumentKey("org1", "sol1", "doc1", "md")).toBe(
      "orgs/org1/solicitations/sol1/documents/doc1.md",
    );
    // A redraft against the same solicitation never overwrites the prior document.
    const first = solicitationDocumentKey("org1", "sol1", "doc1", "md");
    const second = solicitationDocumentKey("org1", "sol1", "doc2", "md");
    expect(first).not.toBe(second);
  });
});

describe("memory storage driver — put/get round-trip", () => {
  const original = process.env.STORAGE_DRIVER;
  afterEach(() => {
    process.env.STORAGE_DRIVER = original;
  });

  it("reads back exactly the bytes it stored (§3.1.4 review-surface read-back)", async () => {
    process.env.STORAGE_DRIVER = "memory";
    const storage = getStorage();
    expect(storage.name).toBe("memory");
    const key = contractDocumentKey("org1", "contract1", "doc1", "md");
    const bytes = new TextEncoder().encode("# Draft subcontract agreement");
    await storage.put(key, bytes, "text/markdown");
    const readBack = await storage.get(key);
    expect(new TextDecoder().decode(readBack)).toBe("# Draft subcontract agreement");
  });

  it("throws on an unknown key rather than returning empty bytes", async () => {
    process.env.STORAGE_DRIVER = "memory";
    const storage = getStorage();
    await expect(storage.get("orgs/nope/contracts/nope/documents/nope.md")).rejects.toThrow(
      /not found/,
    );
  });
});
