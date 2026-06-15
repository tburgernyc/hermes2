import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BYTES, UploadError, contentTypeFor, sha256Hex, validateUpload } from "./upload.js";

/** Build bytes with the given magic prefix padded to `len`. */
function withMagic(magic: number[], len = 16): Uint8Array {
  const buf = new Uint8Array(len);
  buf.set(magic, 0);
  return buf;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
const DOCX_MAGIC = [0x50, 0x4b, 0x03, 0x04];

describe("validateUpload — content-based file intake", () => {
  it("accepts a PDF by magic bytes and reports its canonical content-type", () => {
    const result = validateUpload(withMagic(PDF_MAGIC));
    expect(result.detectedType).toBe("pdf");
    expect(result.contentType).toBe("application/pdf");
    expect(result.byteSize).toBe(16);
  });

  it("accepts a DOCX (ZIP container) by magic bytes", () => {
    const result = validateUpload(withMagic(DOCX_MAGIC));
    expect(result.detectedType).toBe("docx");
    expect(result.contentType).toContain("wordprocessingml");
  });

  it("rejects an empty file (fail closed)", () => {
    expect(() => validateUpload(new Uint8Array(0))).toThrow(UploadError);
  });

  it("rejects a file over the 25MB cap without reading its type", () => {
    // One byte past the cap; the size check must fire before signature detection.
    const tooBig = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    tooBig.set(PDF_MAGIC, 0); // even a valid PDF prefix must be rejected for size
    expect(() => validateUpload(tooBig)).toThrow(/25MB/);
  });

  it("rejects an unrecognized type — a renamed text/exe cannot pass as PDF", () => {
    const notADoc = new TextEncoder().encode("GIF89a totally not a pdf");
    expect(() => validateUpload(notADoc)).toThrow(/Unsupported file type/);
  });

  it("rejects a file whose extension lies but whose bytes are wrong", () => {
    // Bytes decide, not the (here absent) name: an HTML payload must not pass.
    const html = new TextEncoder().encode("<!DOCTYPE html><script>alert(1)</script>");
    expect(() => validateUpload(html)).toThrow(UploadError);
  });

  it("computes a stable sha256 hex matching node:crypto", () => {
    const bytes = withMagic(PDF_MAGIC);
    const expected = createHash("sha256").update(bytes).digest("hex");
    expect(validateUpload(bytes).sha256).toBe(expected);
    expect(sha256Hex(bytes)).toBe(expected);
    expect(expected).toMatch(/^[a-f0-9]{64}$/);
  });

  it("contentTypeFor returns the canonical MIME per detected type", () => {
    expect(contentTypeFor("pdf")).toBe("application/pdf");
    expect(contentTypeFor("docx")).toContain("officedocument");
  });
});
