/**
 * Password hashing — argon2id via @node-rs/argon2 (prebuilt native binary; no node-gyp, so it builds
 * cleanly in CI and the Fly Docker image). Hashes are self-describing (params embedded), so `verify`
 * needs only the stored hash + the candidate password.
 */
import { hash, verify } from "@node-rs/argon2";

// argon2 algorithm id 2 = Argon2id. Referenced by value (not the `Algorithm` const enum, which
// `verbatimModuleSyntax` forbids importing) so the security-sensitive choice stays explicit.
const ARGON2ID = 2;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { algorithm: ARGON2ID });
}

export async function verifyPassword(storedHash: string, candidate: string): Promise<boolean> {
  try {
    return await verify(storedHash, candidate);
  } catch {
    // A malformed/garbage stored hash must never authenticate — fail closed.
    return false;
  }
}
