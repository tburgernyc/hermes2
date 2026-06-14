/**
 * packages/core/src/tokens.ts
 *
 * Signed, single-purpose, expiring tokens for the no-account portal pages (/quote/[token], /optout/[token]).
 *
 * Why this exists (v1 audit lesson): vendor identity must NEVER be a raw client-set id. A tokenized
 * submission carries a SERVER-MINTED, HMAC-signed token that encodes exactly which prospect + solicitation
 * it is scoped to, and for exactly one purpose. An opt-out token cannot be replayed to submit a quote, and
 * vice-versa (distinct single-purpose tokens — the Phase 5 rule).
 *
 * These tokens authorize writing ONLY a prospect-scoped row. They never grant access to a vetted vendor
 * record (see auth-guard.ts + the portal's write rule).
 */
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

export type TokenPurpose = "quote" | "optout";

export interface TokenPayload {
  p: TokenPurpose;
  org: string; // orgId (tenant)
  prospect: string; // vendor_prospects.id this token is scoped to
  sol?: string; // solicitation id (for quote tokens)
  jti: string; // unique id (enables single-use revocation if you track used jtis)
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
  if (!s || s.length < 32) throw new Error("TOKEN_SIGNING_SECRET missing or too short (>=32 chars)");
  return s;
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const sign = (body: string) => b64url(createHmac("sha256", secret()).update(body).digest());

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false; // length check first; lengths aren't secret
  return timingSafeEqual(ba, bb);
}

/** Mint a signed token. Default TTL 14 days (matches the outreach approval/expiry window). */
export function mintToken(input: {
  purpose: TokenPurpose;
  orgId: string;
  prospectId: string;
  solicitationId?: string;
  ttlDays?: number;
}): string {
  const payload: TokenPayload = {
    p: input.purpose,
    org: input.orgId,
    prospect: input.prospectId,
    sol: input.solicitationId,
    jti: randomBytes(8).toString("hex"),
    exp: Date.now() + (input.ttlDays ?? 14) * 86_400_000,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

/**
 * Verify a token for the EXPECTED purpose. Throws TokenError on any mismatch.
 * Always pass the purpose the current route requires — this is what stops an opt-out token from being
 * used to submit a quote.
 */
export function verifyToken(token: string, expectedPurpose: TokenPurpose): TokenPayload {
  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) throw new TokenError("malformed");
  if (!safeEqual(sig, sign(body))) throw new TokenError("bad signature");

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new TokenError("unparseable payload");
  }

  if (payload.p !== expectedPurpose) throw new TokenError("wrong purpose");
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) throw new TokenError("expired");
  if (!payload.org || !payload.prospect) throw new TokenError("missing scope");
  return payload;
}
