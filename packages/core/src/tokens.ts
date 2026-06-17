/**
 * Signed, single-purpose, expiring tokens for the no-/pre-account portal pages (/quote/[token],
 * /optout/[token], /invite/[token]). Identity is NEVER a raw client-set id: each token is a
 * SERVER-MINTED, HMAC-signed value scoped to exactly one PURPOSE plus exactly one subject.
 *
 *   • QUOTE_SUBMISSION / OPT_OUT — PROSPECT-scoped. Authorize writing ONLY a prospect-scoped row,
 *     never a vetted vendor (CLAUDE.md §7). A quote token cannot be replayed to opt out, and vice-versa.
 *   • VENDOR_INVITE — VENDOR-scoped (Phase-6 onboarding). Authorizes creating a NEW vendor-account
 *     user PRE-LINKED to an already-vetted vendor (the admin minted it for that vendor). It carries a
 *     `vendor` id and NEVER a `prospect`; a prospect token can never be used on the invite route.
 *
 * The purpose-XOR-subject invariant is enforced at BOTH mint (a token is built with exactly one of
 * prospect/vendor, per purpose) and verify (the route's expected purpose dictates which subject must
 * be present) — so the two scopes can never cross-contaminate.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Mirrors the DB `token_purpose` enum. */
export type TokenPurpose = "QUOTE_SUBMISSION" | "OPT_OUT" | "VENDOR_INVITE";

export interface TokenPayload {
  p: TokenPurpose;
  org: string; // orgId (tenant)
  prospect?: string; // vendor_prospects.id — prospect-scoped purposes (QUOTE_SUBMISSION / OPT_OUT)
  vendor?: string; // vendors.id — vendor-scoped purposes (VENDOR_INVITE)
  sol?: string; // solicitation id (quote tokens)
  jti: string; // unique id (enables single-use revocation if used jtis are tracked)
  exp: number; // epoch ms
}

export class TokenError extends Error {
  constructor(public readonly reason: string) {
    super(`Invalid token: ${reason}`);
    this.name = "TokenError";
  }
}

function secret(): string {
  const s = process.env.TOKEN_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("TOKEN_SIGNING_SECRET missing or too short (>=32 chars).");
  return s;
}

const b64url = (buf: Buffer): string => buf.toString("base64url");
const sign = (body: string): string => b64url(createHmac("sha256", secret()).update(body).digest());

/**
 * Stable HMAC-SHA-256 hash of a minted token (keyed by TOKEN_SIGNING_SECRET), hex. Stored alongside
 * the record it authorizes (outreach campaign / vendor invite) so it can be located/revoked by its
 * token WITHOUT ever persisting the raw token (CLAUDE.md §7). The schema has no raw-token column by
 * design; the live token reaches the recipient only in the sent email / copied link and is validated
 * statelessly by verifyToken.
 */
export function hashToken(token: string): string {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false; // length isn't secret
  return timingSafeEqual(ba, bb);
}

const DEFAULT_TTL_DAYS = 14;

/**
 * Mint a signed token. Default TTL 14 days. The subject is purpose-determined: VENDOR_INVITE carries a
 * `vendorId` (and must NOT carry a prospect); every other purpose carries a `prospectId` (and must NOT
 * carry a vendor). Mismatches throw — a quote/opt-out token can never silently become vendor-scoped.
 */
export function mintToken(input: {
  purpose: TokenPurpose;
  orgId: string;
  prospectId?: string;
  vendorId?: string;
  solicitationId?: string;
  ttlDays?: number;
}): string {
  const isInvite = input.purpose === "VENDOR_INVITE";
  if (isInvite) {
    if (!input.vendorId) throw new Error("VENDOR_INVITE token requires vendorId");
    if (input.prospectId) throw new Error("VENDOR_INVITE token must not carry a prospect");
  } else {
    if (!input.prospectId) throw new Error(`${input.purpose} token requires prospectId`);
    if (input.vendorId) throw new Error(`${input.purpose} token must not carry a vendor`);
  }
  const payload: TokenPayload = {
    p: input.purpose,
    org: input.orgId,
    prospect: isInvite ? undefined : input.prospectId,
    vendor: isInvite ? input.vendorId : undefined,
    sol: input.solicitationId,
    jti: randomBytes(8).toString("hex"),
    exp: Date.now() + (input.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400_000,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

/**
 * Verify a token for the EXPECTED purpose. Throws TokenError on any mismatch. Always pass the purpose
 * the current route requires — this is what stops an opt-out token from being used to submit a quote,
 * or a prospect token from being used on the vendor-invite route (the subject required differs).
 */
export function verifyToken(
  token: string,
  expectedPurpose: "VENDOR_INVITE",
): TokenPayload & { vendor: string };
export function verifyToken(
  token: string,
  expectedPurpose: "QUOTE_SUBMISSION" | "OPT_OUT",
): TokenPayload & { prospect: string };
export function verifyToken(token: string, expectedPurpose: TokenPurpose): TokenPayload {
  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) throw new TokenError("malformed");
  if (!safeEqual(sig, sign(body))) throw new TokenError("bad signature");

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    throw new TokenError("unparseable payload");
  }

  if (payload.p !== expectedPurpose) throw new TokenError("wrong purpose");
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) throw new TokenError("expired");
  if (!payload.org) throw new TokenError("missing scope");
  // The required subject is purpose-determined — a token missing its scope is rejected closed.
  if (expectedPurpose === "VENDOR_INVITE") {
    if (!payload.vendor) throw new TokenError("missing scope");
  } else if (!payload.prospect) {
    throw new TokenError("missing scope");
  }
  return payload;
}
