/**
 * packages/inngest/src/sourcing.ts — Phase B subcontractor discovery: SAM.gov Entity Management +
 * USASpending connectors and a DETERMINISTIC, fail-closed pre-vet. PURE + DB-free (mirrors logic.ts's
 * buildSamSearchUrl and the ai/compliance determinism): the network fetch is INJECTED by the caller
 * (deps.fetchDoc = the SSRF-guarded safeFetchDocument), so every function here is unit-testable offline.
 *
 * SECURITY / Prime Directive (CLAUDE.md §2/§7):
 *  - The pre-vet is DETERMINISTIC — a model score never decides eligibility. Debarment/exclusion is a
 *    HARD BLOCK, and an UNKNOWN exclusion status also blocks (fail-closed: never surface a possibly-
 *    excluded entity as a candidate).
 *  - All parsing is DEFENSIVE: a missing/ambiguous field drops that entity rather than fabricating a
 *    "vetted" record. Malformed top-level JSON yields an empty list, never a thrown success.
 *
 * SAM Entity Management API v3 (https://api.sam.gov/entity-information/v3/entities): SAM_API_KEY needs the
 * Entity-API entitlement (SEPARATE from the Opportunities API) or the fetch 401/403s and the run fails loud
 * (the operator sees "stop and report", never fake candidates). `api.sam.gov` is already SSRF-allowlisted.
 * Exact field paths are confirmed against the live API at deploy; the parser tolerates absence either way.
 */

export const SAM_ENTITY_ENDPOINT = "https://api.sam.gov/entity-information/v3/entities";
export const USASPENDING_AWARD_ENDPOINT =
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

/** Bound the external work per run (SAM page + one embed + one score + one USASpending call per entity). */
export const MAX_CANDIDATES_PER_RUN = 25;

const NAICS_RE = /^[0-9]{6}$/;

/* ----------------------------------- SAM Entity connector ----------------------------------- */

/**
 * Build the SAM Entity Management v3 search URL for ONE NAICS code. PURE + exported (unit-testable, no
 * network). Filters to ACTIVE registrations under the NAICS and requests the sections the pre-vet reads.
 */
export function buildSamEntityUrl(
  naicsCode: string,
  apiKey: string,
  opts: { page?: number; size?: number } = {},
): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    naicsCode,
    registrationStatus: "A", // Active only
    includeSections: "entityRegistration,coreData,assertions,pointsOfContact",
    page: String(opts.page ?? 0),
    size: String(Math.min(opts.size ?? MAX_CANDIDATES_PER_RUN, 100)),
  });
  return `${SAM_ENTITY_ENDPOINT}?${params.toString()}`;
}

/** One pre-vet-ready entity distilled from a SAM record. `excluded: null` ⇒ status could not be determined. */
export interface DiscoveredEntity {
  uei: string;
  cageCode: string | null;
  legalName: string;
  pocEmail: string | null;
  primaryNaics: string | null;
  naicsCodes: string[]; // all NAICS the entity asserts
  smallUnderNaics: string[]; // NAICS where the entity reports SBA small-business status
  registrationActive: boolean;
  excluded: boolean | null; // true = debarred/excluded, false = clear, null = unknown (fail-closed → block)
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function yesNo(v: unknown): boolean | null {
  const s = str(v)?.trim().toUpperCase();
  if (s === undefined) return null;
  if (s === "Y" || s === "YES" || s === "TRUE") return true;
  if (s === "N" || s === "NO" || s === "FALSE") return false;
  return null;
}

/** Pull the NAICS list (code + small-business flag) from a SAM record's assertions, defensively. */
function readNaics(record: Record<string, unknown>): {
  all: string[];
  small: string[];
  primary: string | null;
} {
  const assertions = record["assertions"] as Record<string, unknown> | undefined;
  const goods = assertions?.["goodsAndServices"] as Record<string, unknown> | undefined;
  const primaryRaw = str(goods?.["primaryNaics"]) ?? null;
  const primary = primaryRaw && NAICS_RE.test(primaryRaw) ? primaryRaw : null;
  const list = Array.isArray(goods?.["naicsList"])
    ? (goods!["naicsList"] as Record<string, unknown>[])
    : [];
  const all = new Set<string>();
  const small = new Set<string>();
  if (primary) all.add(primary);
  for (const n of list) {
    const code = str(n["naicsCode"]);
    if (!code || !NAICS_RE.test(code)) continue;
    all.add(code);
    if (yesNo(n["sbaSmallBusiness"]) === true) small.add(code);
  }
  return { all: [...all], small: [...small], primary };
}

/** Read the POC email from any of the POC blocks, preferring the government-business contact. */
function readPocEmail(record: Record<string, unknown>): string | null {
  const poc = record["pointsOfContact"] as Record<string, unknown> | undefined;
  if (!poc) return null;
  for (const key of ["governmentBusinessPOC", "electronicBusinessPOC", "pastPerformancePOC"]) {
    const block = poc[key] as Record<string, unknown> | undefined;
    const email = str(block?.["email"]);
    if (email) return email;
  }
  return null;
}

/**
 * Parse a SAM Entity v3 search response into pre-vet-ready entities. DEFENSIVE + fail-closed: malformed
 * top-level JSON ⇒ []; an entity missing a UEI is skipped; an indeterminate exclusion flag ⇒ excluded:null
 * (which the pre-vet treats as a HARD BLOCK).
 */
export function parseSamEntities(payload: string | Uint8Array): DiscoveredEntity[] {
  let json: unknown;
  try {
    const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    json = JSON.parse(text);
  } catch {
    return []; // malformed → empty, never a fabricated success
  }
  const root = json as Record<string, unknown>;
  const data = Array.isArray(root["entityData"])
    ? (root["entityData"] as Record<string, unknown>[])
    : [];

  const out: DiscoveredEntity[] = [];
  for (const record of data) {
    const reg = record["entityRegistration"] as Record<string, unknown> | undefined;
    const uei = str(reg?.["ueiSAM"]);
    if (!uei) continue; // no stable identity → cannot dedupe/track → drop

    const regStatus = str(reg?.["registrationStatus"])?.trim().toUpperCase();
    const registrationActive = regStatus === "ACTIVE" || regStatus === "A";

    // Exclusion: "Y"/"N" flag when present; anything indeterminate ⇒ null ⇒ pre-vet HARD BLOCK.
    const excluded = yesNo(reg?.["exclusionStatusFlag"]);

    const { all, small, primary } = readNaics(record);
    out.push({
      uei,
      cageCode: str(reg?.["cageCode"]) ?? null,
      legalName: str(reg?.["legalBusinessName"]) ?? "Unknown entity",
      pocEmail: readPocEmail(record),
      primaryNaics: primary,
      naicsCodes: all,
      smallUnderNaics: small,
      registrationActive,
      excluded,
    });
  }
  return out;
}

/* ----------------------------------- Deterministic pre-vet ----------------------------------- */

export interface PrevetFlags {
  registrationActive: boolean;
  exclusionClear: boolean; // true ⇔ excluded === false (positively known clear)
  naicsOverlap: string[]; // solicitation NAICS the entity also holds
  smallUnderSubcontractNaics: boolean | null; // the 52.219-14 size signal (advisory, not a block)
}

export interface PrevetResult {
  pass: boolean;
  flags: PrevetFlags;
  reasons: string[]; // why it was blocked (empty when pass === true)
}

/**
 * Deterministic pre-vet for ONE entity against a solicitation NAICS. HARD BLOCKS (drop, never surface):
 *  1. SAM registration not active;
 *  2. exclusion not positively clear (excluded === true OR unknown — fail-closed, never surface a debarred
 *     or indeterminate entity — CLAUDE.md §7);
 *  3. no NAICS overlap with the solicitation (irrelevant capability).
 * Size (small under the subcontract NAICS) is recorded as an ADVISORY flag for the later 52.219-14 math —
 * a non-small sub may still be engaged (it just counts against the 50% cap), so it is flagged, not dropped.
 */
export function prevetEntity(
  entity: DiscoveredEntity,
  args: { solicitationNaics: string | null },
): PrevetResult {
  const naicsOverlap = args.solicitationNaics
    ? entity.naicsCodes.filter((c) => c === args.solicitationNaics)
    : [];
  const flags: PrevetFlags = {
    registrationActive: entity.registrationActive,
    exclusionClear: entity.excluded === false,
    naicsOverlap,
    smallUnderSubcontractNaics: args.solicitationNaics
      ? entity.smallUnderNaics.includes(args.solicitationNaics)
      : null,
  };

  const reasons: string[] = [];
  if (!flags.registrationActive) reasons.push("SAM registration not active");
  if (!flags.exclusionClear) {
    reasons.push(entity.excluded === true ? "entity is excluded/debarred" : "exclusion status unknown");
  }
  if (args.solicitationNaics && naicsOverlap.length === 0) {
    reasons.push("no NAICS overlap with solicitation");
  }

  return { pass: reasons.length === 0, flags, reasons };
}

/* ----------------------------------- USASpending past performance ----------------------------------- */

export interface PastPerformance {
  awardCount: number;
  totalAwarded: number;
  agencies: string[];
}

/** POST body to fetch a recipient's prior awards under the given NAICS codes (advisory qualification). */
export function buildPastPerformanceBody(recipientName: string, naicsCodes: string[]): string {
  return JSON.stringify({
    filters: {
      recipient_search_text: [recipientName],
      naics_codes: naicsCodes.filter((c) => NAICS_RE.test(c)),
      award_type_codes: ["A", "B", "C", "D"],
    },
    fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "NAICS"],
    limit: 100,
  });
}

/** Parse a USASpending spending_by_award response into an advisory past-performance summary (null on none). */
export function parsePastPerformance(payload: string | Uint8Array): PastPerformance | null {
  let json: unknown;
  try {
    const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const results = (json as Record<string, unknown>)["results"];
  if (!Array.isArray(results) || results.length === 0) return null;

  let totalAwarded = 0;
  const agencies = new Set<string>();
  for (const row of results as Record<string, unknown>[]) {
    const amt = row["Award Amount"];
    const n = typeof amt === "number" ? amt : Number(amt);
    if (Number.isFinite(n) && n > 0) totalAwarded += n;
    const agency = str(row["Awarding Agency"]);
    if (agency) agencies.add(agency);
  }
  return { awardCount: results.length, totalAwarded, agencies: [...agencies] };
}

/** Build a capabilities description for embedding/scoring from an entity's SAM data (treated as data). */
export function deriveCapabilitiesText(entity: DiscoveredEntity): string {
  const parts = [
    entity.legalName,
    entity.primaryNaics ? `Primary NAICS ${entity.primaryNaics}.` : "",
    entity.naicsCodes.length > 0 ? `NAICS: ${entity.naicsCodes.join(", ")}.` : "",
    entity.smallUnderNaics.length > 0
      ? `Small business under: ${entity.smallUnderNaics.join(", ")}.`
      : "",
  ];
  return parts.filter(Boolean).join(" ").trim();
}
