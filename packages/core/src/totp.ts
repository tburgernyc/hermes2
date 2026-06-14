/**
 * Admin TOTP (CLAUDE.md §7): secret generation, provisioning URI, code verification (otplib), and
 * AES-256-GCM encryption of the secret at rest — the DB stores `iv.tag.ciphertext`, never the plaintext
 * seed. The encryption key is a DEDICATED secret (TOTP_ENCRYPTION_KEY), never AUTH_SECRET.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { authenticator } from "otplib";

const ISSUER = "Hermes 2.0";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

// Tolerate ±1 time-step (30s) of clock drift on verification.
authenticator.options = { window: 1 };

function encryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOTP_ENCRYPTION_KEY is not set.");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must decode to 32 bytes (AES-256): 64 hex chars or base64.");
  }
  return key;
}

/** Generate a new base32 TOTP secret for an admin enrolling a second factor. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI for the authenticator-app QR code. */
export function totpKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

/** Current 6-digit code for a secret. Used by enrollment confirmation and the e2e test harness. */
export function generateTotpCode(secret: string): string {
  return authenticator.generate(secret);
}

/** Verify a 6-digit code against the plaintext secret. Never throws (fail closed on garbage input). */
export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code.trim(), secret });
  } catch {
    return false;
  }
}

/** Encrypt a plaintext TOTP secret → `iv.tag.ciphertext` (each base64). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

/** Decrypt `iv.tag.ciphertext`; throws if the auth tag fails (tampering / wrong key). */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed TOTP ciphertext.");
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
