/**
 * §3.8.2 vendor-bench helpers — pure, dependency-free view/validation helpers for proactively adding and
 * searching vendors BEFORE any specific opportunity drives it (independent of any solicitation).
 *
 * Schema note (deviation — see the PR description): `vendors` carries `capabilitiesText` +
 * `capabilityEmbedding` but, unlike `vendor_prospects`, has NO dedicated structured `naicsCodes` column
 * (packages/db is frozen for this unit — see the boundary note in the PR). `smallUnderNaics` exists but is
 * a DIFFERENT, legally-load-bearing concept (FAR 52.219-14 "small under NAICS X" for the similarly-situated
 * test) and must never be repurposed for capability tagging. So NAICS tags are folded into
 * `capabilitiesText` as a normalized `NAICS: 541511, 541512` line (tagNaicsIntoCapabilities), and the
 * bench directory searches/filters against that same free text (both in the DB via ILIKE and, for display,
 * via extractNaicsCodes below). A future PR adding a dedicated `vendors.naicsCodes` column would let the
 * directory filter precisely instead of via substring match.
 */

const NAICS_RE = /^[0-9]{6}$/;
const NAICS_TAG_RE = /^NAICS:\s*(.+)$/im;

/** Parse a comma/space-separated NAICS list, keeping only well-formed 6-digit codes (mirrors prospects). */
export function parseNaics(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => NAICS_RE.test(s));
}

/**
 * Fold a NAICS code list into a capabilities free-text block as a normalized, parseable/searchable first
 * line. Idempotent-ish for display purposes (always writes a fresh tag line — callers pass the user's
 * freeform description separately, never round-trip an existing tagged block through this twice).
 */
export function tagNaicsIntoCapabilities(naicsCodes: string[], capabilitiesText: string | null): string {
  const body = (capabilitiesText ?? "").trim();
  if (naicsCodes.length === 0) return body;
  const tag = `NAICS: ${naicsCodes.join(", ")}`;
  return body.length > 0 ? `${tag}\n\n${body}` : tag;
}

/** Recover the tagged NAICS codes back out of a capabilities block written by tagNaicsIntoCapabilities. */
export function extractNaicsCodes(capabilitiesText: string | null): string[] {
  if (!capabilitiesText) return [];
  const match = NAICS_TAG_RE.exec(capabilitiesText);
  if (!match) return [];
  return parseNaics(match[1] ?? "");
}

/** The capability description with the leading "NAICS: ..." tag line stripped (for a clean read view). */
export function stripNaicsTag(capabilitiesText: string | null): string {
  if (!capabilitiesText) return "";
  return capabilitiesText.replace(NAICS_TAG_RE, "").trim();
}
