/**
 * packages/core/src/upload.ts
 *
 * File intake for proposal documents. Two rules:
 *  1. Validate by MAGIC BYTES, never by file extension or the client-declared MIME type.
 *  2. Enforce a hard size cap before storage.
 *
 * Storage is Fly Tigris (S3-compatible) with short-lived signed URLs — objects are never public.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

/** Accepted document types and their leading magic bytes. */
const SIGNATURES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
  // DOCX is a ZIP container; PK\x03\x04. (Deeper [Content_Types].xml inspection optional.)
  docx: [[0x50, 0x4b, 0x03, 0x04]],
};

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

/**
 * Validate an uploaded file by content, not by its name. Returns the detected type or throws.
 * `declaredType` is accepted only as a hint; the bytes decide.
 */
export function validateUpload(bytes: Uint8Array): { detectedType: "pdf" | "docx" } {
  if (bytes.byteLength === 0) throw new UploadError("Empty file");
  if (bytes.byteLength > MAX_BYTES) throw new UploadError("File exceeds 25MB limit");

  for (const [type, sigs] of Object.entries(SIGNATURES)) {
    if (sigs.some((sig) => startsWith(bytes, sig))) {
      return { detectedType: type as "pdf" | "docx" };
    }
  }
  throw new UploadError("Unsupported file type (only PDF and DOCX are accepted)");
}

/* ------------------------------------------------------------------ */
/* Tigris storage                                                      */
/* ------------------------------------------------------------------ */

function s3(): S3Client {
  return new S3Client({
    region: process.env.TIGRIS_REGION ?? "auto",
    endpoint: process.env.TIGRIS_ENDPOINT, // e.g. https://fly.storage.tigris.dev
    credentials: {
      accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = () => process.env.TIGRIS_BUCKET!;

/** Store validated bytes under an org-scoped key. */
export async function putToTigris(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: bytes, ContentType: contentType })
  );
}

/** Short-lived signed download URL (default 5 minutes). Never serve these objects publicly. */
export async function signedGetUrl(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET(), Key: key }), { expiresIn });
}
