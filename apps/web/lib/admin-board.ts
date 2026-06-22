/**
 * Pure, dependency-free view helpers for the admin console. Kept out of the page components so the
 * grouping logic is unit-testable without a React/JSX transform or a DB. No mutation: every function
 * returns new arrays/strings (CLAUDE.md coding-style — immutability).
 */

export interface BoardColumn {
  title: string;
  /** The solicitation_status values that land in this column, in lifecycle order. */
  statuses: readonly string[];
}

/**
 * The solicitations kanban: the 12 solicitation_status values collapsed into five operator-facing
 * phases. A status that is not listed in any column simply does not appear on the board (defensive —
 * a new enum value won't crash the page; it just needs a column added here).
 */
export const SOLICITATION_BOARD: readonly BoardColumn[] = [
  { title: "Triage", statuses: ["PENDING_TRIAGE", "TRIAGE_COMPLETE"] },
  {
    title: "Sourcing",
    statuses: ["READY_FOR_SOURCING", "AWAITING_APPROVAL", "SOURCING_IN_PROGRESS"],
  },
  { title: "Pricing & bid", statuses: ["PRICING_PENDING", "PROPOSAL_DRAFT"] },
  { title: "Submitted", statuses: ["SUBMITTED", "AWARDED"] },
  { title: "Closed", statuses: ["NO_GO", "CLOSED", "REJECTED"] },
];

export interface BoardGroup<T> {
  title: string;
  items: T[];
}

/**
 * Bucket rows into the given board columns by their `status`. Pure: input is never mutated, original
 * row order is preserved within each column, and every column is present (possibly empty) so the board
 * renders a stable set of lanes.
 */
export function groupByColumn<T extends { status: string }>(
  rows: readonly T[],
  columns: readonly BoardColumn[] = SOLICITATION_BOARD,
): BoardGroup<T>[] {
  return columns.map((col) => ({
    title: col.title,
    items: rows.filter((r) => col.statuses.includes(r.status)),
  }));
}

/** Humanize an UPPER_SNAKE_CASE enum value for display: "PRICING_PENDING" → "Pricing pending". */
export function humanizeStatus(status: string): string {
  if (status.length === 0) return status;
  const lower = status.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * The prospect_status values an admin can still move to QUALIFIED (the manual qualify decision). Single
 * source of truth shared by the prospects page (which button to render) and the action (the DB guard),
 * so the UI and the write can never drift apart.
 */
export const QUALIFIABLE_PROSPECT_STATUSES = ["NEW", "SCREENED", "CONTACTED", "RESPONDED"] as const;

/** Whether a prospect in this status can still be marked QUALIFIED. */
export function isQualifiableProspectStatus(status: string): boolean {
  return (QUALIFIABLE_PROSPECT_STATUSES as readonly string[]).includes(status);
}

/** Console Badge tones — kept loose to match the Badge component's accepted values. */
export type BadgeTone = "success" | "warn" | "neutral" | "info";

/**
 * Map the advisory ai_recommendation enum (PURSUE/REJECT/HUMAN_REVIEW) to a Badge tone. This is a
 * DISPLAY treatment only — the recommendation never gates anything (CLAUDE.md §2); the human decides.
 * PURSUE → success, HUMAN_REVIEW → warn, REJECT → neutral (a no-go is a calm signal, not an error).
 */
export function recommendationTone(recommendation: string | null | undefined): BadgeTone {
  if (recommendation === "PURSUE") return "success";
  if (recommendation === "HUMAN_REVIEW") return "warn";
  return "neutral";
}

/** Human-readable label for the advisory recommendation: "HUMAN_REVIEW" → "Human review". */
export function recommendationLabel(recommendation: string | null | undefined): string {
  if (!recommendation) return "—";
  return humanizeStatus(recommendation);
}
