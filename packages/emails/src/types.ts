/**
 * Typed inputs for the outbound templates. Kept in a .ts file (no JSX) so non-React callers — notably
 * the @hermes/inngest job logic — can import these shapes without pulling React into their type graph.
 */

/** Vendor/prospect-derived strings in these inputs are UNTRUSTED; React Email autoescapes them at render. */
export interface OutreachEmailInput {
  to: string;
  subject: string;
  prospectName: string;
  /** Pre-composed SOW summary (plain text). Rendered as escaped paragraphs — never raw HTML. */
  bodyText: string;
  /** Signed, single-purpose URLs minted at send time (CLAUDE.md §7). */
  quoteUrl: string;
  optoutUrl: string;
}

export interface BriefItem {
  label: string;
  detail?: string;
}

export interface MorningBriefInput {
  to: string | string[];
  orgName: string;
  dateLabel: string;
  triageReady: BriefItem[];
  awaitingApproval: BriefItem[];
  rankedQuotes: number;
  deadlines: BriefItem[];
  arOverdue: BriefItem[];
  approvalsUrl: string;
}
