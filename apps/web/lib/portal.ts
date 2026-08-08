/**
 * Shared vendor-portal constants + display helpers. OPEN_RFQ_STATUSES is the SINGLE source for which
 * solicitation statuses a logged-in vendor may browse (PR J) and, later, quote against (PR K) — so the
 * browse surface and the submit guard cannot drift apart. SOURCING_IN_PROGRESS is the state-machine
 * window where the firm has approved sourcing and is actively collecting subcontractor quotes.
 */
import { solicitationStatus } from "@hermes/db";

export type SolicitationStatus = (typeof solicitationStatus.enumValues)[number];

export const OPEN_RFQ_STATUSES: SolicitationStatus[] = ["SOURCING_IN_PROGRESS"];

/** UPPER_SNAKE enum value → "Title Case" for display. Pure; intentionally not coupled to the admin UI. */
export function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** money/numeric columns arrive as strings from Drizzle; render as USD, or an em dash when null. */
export function formatUsd(value: string | null): string {
  if (value === null) return "—";
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * §3.2 baseline audit — decision record for quote_status INVITED (deliberately left unreachable):
 *
 * INVITED is vendor_quotes' column default, but nothing ever writes a row at that status. The naive fix —
 * INSERT a placeholder vendor_quotes row the moment outreach is sent to a PROSPECT — was investigated and
 * rejected as unsafe:
 *   1. Outreach targets vendor_prospects (pre-portal recipients reached via an emailed token link to
 *      /quote/[token]), not logged-in VENDOR-role portal users. A prospect is not a portal principal at
 *      all until promoted to a vetted vendor AND onboarded via a VENDOR_INVITE token — so there is no
 *      portal session to show "invited" to at outreach-send time in the first place.
 *   2. The tokenized submit action (apps/web/app/quote/[token]/actions.ts) always INSERTs a BRAND NEW
 *      vendor_quotes row with a fresh app-side UUID — it never looks for, updates, or consumes an existing
 *      row for that prospect. A pre-created INVITED row would therefore sit alongside the real SUBMITTED
 *      row forever: a confusing duplicate, not a state transition. Making the token path consume/update a
 *      pre-existing row instead would require editing that action — explicitly out of this unit's file
 *      scope (see the orchestrator's boundary) — and touching the public, low-trust token-submit path
 *      without a proving test is exactly the class of change the spec calls out as hazardous (the
 *      vendor_quotes party-XOR CHECK + the migration-0011 one-active-quote partial unique index on
 *      (org_id, solicitation_id, vendor_id) were both authored around "insert once, at submission").
 * Given both, this unit leaves INVITED unused rather than risk the tokenized submit path with an unproven
 * change outside its scope. The vendor-facing equivalent of "you were invited" is the browse-open-RFQ page
 * for logged-in vendors (OPEN_RFQ_STATUSES above) and the /quote/[token] page itself for prospects — both
 * already exist and need no vendor_quotes row to work. A future unit that also owns the token-submit path
 * could revisit wiring INVITED properly (option (b) in the audit), with a test proving the one-active-quote
 * index and party-XOR CHECK still hold.
 */
