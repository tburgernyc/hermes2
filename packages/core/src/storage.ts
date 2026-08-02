/**
 * Object storage for validated uploads. Objects are NEVER public — downloads are short-lived signed
 * URLs only (CLAUDE.md §7). Two drivers, selected at call time (never at import — no env read on load):
 *   - "tigris"  : Fly Tigris (S3-compatible), used in prod when TIGRIS_BUCKET is configured.
 *   - "memory"  : in-process, used ONLY when explicitly opted into via STORAGE_DRIVER=memory (dev/e2e).
 *
 * Fail closed: if neither a Tigris bucket nor an explicit memory opt-in is present, getStorage() throws
 * rather than silently dropping a file. Bytes are validated by ./upload.ts BEFORE they reach here.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

export interface StorageDriver {
  readonly name: "tigris" | "memory";
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Read an object's bytes back (§3.1.4 — the admin review surface renders the drafted SUBCONTRACT_DRAFT
   *  document inline rather than only offering a download link). Throws if the key does not exist. */
  get(key: string): Promise<Uint8Array>;
  signedGetUrl(key: string, ttlSeconds?: number): Promise<string>;
}

/* ------------------------------------------------------------------ */
/* Tigris (S3-compatible)                                              */
/* ------------------------------------------------------------------ */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function tigrisClient(): S3Client {
  return new S3Client({
    region: process.env.TIGRIS_REGION ?? "auto",
    endpoint: requireEnv("TIGRIS_ENDPOINT"),
    credentials: {
      accessKeyId: requireEnv("TIGRIS_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("TIGRIS_SECRET_ACCESS_KEY"),
    },
  });
}

const tigrisDriver: StorageDriver = {
  name: "tigris",
  async put(key, bytes, contentType) {
    const bucket = requireEnv("TIGRIS_BUCKET");
    await tigrisClient().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
  },
  async get(key) {
    const bucket = requireEnv("TIGRIS_BUCKET");
    const res = await tigrisClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) throw new Error(`Object not found: ${key}`);
    return res.Body.transformToByteArray();
  },
  async signedGetUrl(key, ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS) {
    const bucket = requireEnv("TIGRIS_BUCKET");
    return getSignedUrl(tigrisClient(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  },
};

/* ------------------------------------------------------------------ */
/* In-memory (dev / e2e only — explicit opt-in)                        */
/* ------------------------------------------------------------------ */

const memoryStore = new Map<string, { bytes: Uint8Array; contentType: string }>();

const memoryDriver: StorageDriver = {
  name: "memory",
  async put(key, bytes, contentType) {
    memoryStore.set(key, { bytes, contentType });
  },
  async get(key) {
    const entry = memoryStore.get(key);
    if (!entry) throw new Error(`Object not found: ${key}`);
    return entry.bytes;
  },
  async signedGetUrl(key) {
    // A non-fetchable but inspectable stand-in; the memory driver is never used in production.
    return `memory://${key}`;
  },
};

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

/**
 * Resolve the active driver. STORAGE_DRIVER=memory is an explicit dev/test opt-in; otherwise a
 * configured TIGRIS_BUCKET selects Tigris. Neither → throw (prod must configure object storage).
 */
export function getStorage(): StorageDriver {
  if (process.env.STORAGE_DRIVER === "memory") return memoryDriver;
  if (process.env.STORAGE_DRIVER === "tigris" || process.env.TIGRIS_BUCKET) return tigrisDriver;
  throw new Error(
    "No object storage configured: set TIGRIS_* (production) or STORAGE_DRIVER=memory (dev/test).",
  );
}

/** Org + prospect-scoped object key for a tokenized quote document. */
export function quoteDocumentKey(
  orgId: string,
  prospectId: string,
  quoteId: string,
  ext: string,
): string {
  return `orgs/${orgId}/prospects/${prospectId}/quotes/${quoteId}.${ext}`;
}

/**
 * Org + vendor-scoped object key for a LOGGED-IN vendor's quote document (Phase-6 PR K). Distinct from
 * quoteDocumentKey: a submitted quote is owned by a vetted vendor, not a prospect, so the path is keyed
 * by vendorId. Mirrors the per-vendor RLS isolation — every object a vendor writes lives under its own
 * vendor prefix.
 */
export function vendorQuoteDocumentKey(
  orgId: string,
  vendorId: string,
  quoteId: string,
  ext: string,
): string {
  return `orgs/${orgId}/vendors/${vendorId}/quotes/${quoteId}.${ext}`;
}

/**
 * Org + contract-scoped object key for a SYSTEM-generated contract document (§3.1.4 — the AI-drafted,
 * pre-signature SUBCONTRACT_DRAFT, and later a signed final). Keyed by documentId (not a fixed filename)
 * so multiple documents can exist against the same contract over time (a draft revision, then the signed
 * copy) without ever overwriting each other in storage.
 */
export function contractDocumentKey(
  orgId: string,
  contractId: string,
  documentId: string,
  ext: string,
): string {
  return `orgs/${orgId}/contracts/${contractId}/documents/${documentId}.${ext}`;
}

/**
 * Org + solicitation-scoped object key for a SYSTEM-generated solicitation document (§3.8.1 — the
 * AI-drafted CAPABILITY_STATEMENT response to a sources-sought/RFI notice). Keyed by documentId (not a
 * fixed filename) so a redraft never overwrites the prior one, mirroring contractDocumentKey.
 */
export function solicitationDocumentKey(
  orgId: string,
  solicitationId: string,
  documentId: string,
  ext: string,
): string {
  return `orgs/${orgId}/solicitations/${solicitationId}/documents/${documentId}.${ext}`;
}
