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
