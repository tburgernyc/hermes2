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
