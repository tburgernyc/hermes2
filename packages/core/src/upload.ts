/**
 * File intake for vendor-submitted documents (proposal quotes). Two non-negotiable rules
 * (CLAUDE.md §5 — "untrusted text is data" — and §7):
 *   1. Validate by MAGIC BYTES, never by file extension or the client-declared MIME type.
 *   2. Enforce a hard size cap BEFORE the bytes ever reach storage.
 *
 * This module is intentionally pure (no AWS / DB / env): it is the security-critical gate and is
 * unit-tested offline. The side-effectful storage layer lives in ./storage.ts.
 */
import { createHash } from "node:crypto";

/** Hard upload ceiling. Matches the SSRF document cap in @hermes/inngest safety.ts. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export type DetectedType = "pdf" | "docx";

/** Leading magic bytes per accepted type. DOCX is an OOXML ZIP container → "PK\x03\x04". */
const SIGNATURES: ReadonlyArray<{ type: DetectedType; magic: ReadonlyArray<number> }> = [
  { type: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
  { type: "docx", magic: [0x50, 0x4b, 0x03, 0x04] }, // "PK\x03\x04"
];

/** Canonical content-type per detected type — derived from bytes, never trusted from the client. */
const CONTENT_TYPE: Readonly<Record<DetectedType, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

function startsWith(bytes: Uint8Array, magic: ReadonlyArray<number>): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

/** The canonical content-type for a detected type (use this, never a client-supplied MIME). */
export function contentTypeFor(type: DetectedType): string {
  return CONTENT_TYPE[type];
}

/** SHA-256 of the uploaded bytes, hex — recorded on documents.sha256 (varchar(64) `^[a-f0-9]{64}$`). */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface ValidatedUpload {
  detectedType: DetectedType;
  contentType: string;
  byteSize: number;
  sha256: string;
}

/**
 * Validate an uploaded file by its CONTENT, not its name. Fails closed: any empty, oversized, or
 * unrecognized payload throws UploadError (CLAUDE.md §5). A client-declared filename/MIME is ignored.
 *
 * Note (documented limitation): a DOCX is detected by the generic ZIP signature, so any OOXML ZIP
 * (xlsx/pptx) or bare ZIP would also pass as "docx". That is acceptable here — the file is stored and
 * later read by the AI strictly as fenced data, never executed — and the 25 MB cap bounds abuse. Deeper
 * `[Content_Types].xml` inspection is intentionally out of scope (YAGNI) until a real need appears.
 */
export function validateUpload(bytes: Uint8Array): ValidatedUpload {
  if (bytes.byteLength === 0) throw new UploadError("Empty file");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("File exceeds the 25MB limit");

  const match = SIGNATURES.find((s) => startsWith(bytes, s.magic));
  if (!match) throw new UploadError("Unsupported file type (only PDF and DOCX are accepted)");

  return {
    detectedType: match.type,
    contentType: CONTENT_TYPE[match.type],
    byteSize: bytes.byteLength,
    sha256: sha256Hex(bytes),
  };
}
