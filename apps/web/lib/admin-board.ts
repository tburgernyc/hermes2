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

/**
 * §3.2 baseline audit: prospect_status RESPONDED had no writer anywhere — CONTACTED (now set by
 * sendOutreach, packages/inngest/src/logic.ts) was the last reachable state before QUALIFIED, so a
 * prospect who replied (by phone/email, outside the system) had no way to have that logged. A reply only
 * makes sense after outreach actually went out, so only CONTACTED is eligible. Single source of truth
 * shared by the prospects page (which button to render) and markProspectResponded's DB guard.
 */
export const RESPONDABLE_PROSPECT_STATUSES = ["CONTACTED"] as const;

/** Whether a prospect in this status can be marked RESPONDED (a reply was logged). */
export function isRespondableProspectStatus(status: string): boolean {
  return (RESPONDABLE_PROSPECT_STATUSES as readonly string[]).includes(status);
}

/**
 * §3.2 baseline audit: prospect_status DECLINED had no writer anywhere — a prospect who explicitly said
 * "not interested" had no distinct terminal state; the only way to stop tracking them was the unrelated
 * OPTED_OUT (a public token action, not an admin decision). Any active, non-terminal prospect can be
 * declined — including an already-QUALIFIED one (qualifying is not a promise; the sub can still decline
 * before promotion to a vetted vendor).
 */
export const DECLINABLE_PROSPECT_STATUSES = [
  "NEW",
  "SCREENED",
  "CONTACTED",
  "RESPONDED",
  "QUALIFIED",
] as const;

/** Whether a prospect in this status can be marked DECLINED. */
export function isDeclinableProspectStatus(status: string): boolean {
  return (DECLINABLE_PROSPECT_STATUSES as readonly string[]).includes(status);
}

/**
 * §3.1: a solicitation's government-award OUTCOME (AWARDED / REJECTED / CLOSED) can only be recorded once
 * it has actually been human-submitted to the agency — never earlier in the pipeline (recording an award
 * on an un-submitted pursuit would be dishonest). Single source of truth shared by the solicitation detail
 * page (which form to render) and the recordOutcome action's atomic guard, so the UI and the write can
 * never drift apart (mirrors QUALIFIABLE_PROSPECT_STATUSES).
 */
export const OUTCOME_RECORDABLE_STATUSES = ["SUBMITTED"] as const;

/** Whether a solicitation in this status may have its government-award outcome recorded. */
export function isOutcomeRecordableStatus(status: string): boolean {
  return (OUTCOME_RECORDABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * §3.2 baseline audit: the post-award subcontract lifecycle (contract_status) had NO writer past the
 * PENDING_SIGNATURE row draftSubcontract inserts — ACTIVE/COMPLETED/TERMINATED/CLOSED_OUT were all defined
 * enum values with zero human-facing affordance. These are all human business decisions (never inferred),
 * shared between the subcontract review page (which button to render) and each action's atomic guard.
 */
export const ACTIVATABLE_CONTRACT_STATUSES = ["PENDING_SIGNATURE"] as const;

/** Whether a contract in this status can move to ACTIVE. Combined with an esign_status=SIGNED check at
 * the call site (see subcontract/actions.ts activateContract) — ACTIVE naturally follows a recorded
 * countersignature, so the eligibility is genuinely two-column, mirroring the existing canStartEsign
 * precedent (subcontract/page.tsx) rather than forcing a single-column list to carry both conditions. */
export function isActivatableContractStatus(status: string): boolean {
  return (ACTIVATABLE_CONTRACT_STATUSES as readonly string[]).includes(status);
}

/** A contract may be deliberately terminated from either pre-signature or active — never inferred, never
 * automatic; TERMINATED must always be an explicit admin decision. */
export const TERMINATABLE_CONTRACT_STATUSES = ["PENDING_SIGNATURE", "ACTIVE"] as const;

export function isTerminatableContractStatus(status: string): boolean {
  return (TERMINATABLE_CONTRACT_STATUSES as readonly string[]).includes(status);
}

/** The work is done — an admin marking ACTIVE → COMPLETED. */
export const COMPLETABLE_CONTRACT_STATUSES = ["ACTIVE"] as const;

export function isCompletableContractStatus(status: string): boolean {
  return (COMPLETABLE_CONTRACT_STATUSES as readonly string[]).includes(status);
}

/** Administrative closeout of an already-completed contract (COMPLETED → CLOSED_OUT). This is an operator
 * judgment call recorded here — it is NOT gated on the §3.3 financial flow (final invoice paid, retention
 * released); that wiring is Wave 2c / operator decision 13, out of §3.2 scope. */
export const CLOSEOUTABLE_CONTRACT_STATUSES = ["COMPLETED"] as const;

export function isCloseoutableContractStatus(status: string): boolean {
  return (CLOSEOUTABLE_CONTRACT_STATUSES as readonly string[]).includes(status);
}

/**
 * §3.2 baseline audit: esign_status SIGNED/EXPIRED had no writer — only NOT_STARTED (default) and SENT
 * (the documented e-signature STUB) were reachable. An admin recording that a countersigned agreement came
 * back, or that a sent one lapsed, is a human recording an EXTERNAL fact — exactly the established pattern
 * for markProspectResponded/markProspectDeclined. This is never a real e-signature vendor integration
 * (deferred to §7.3); it is a status flip + audit row only.
 */
export const ESIGN_RESOLVABLE_STATUSES = ["SENT"] as const;

export function isEsignResolvableStatus(status: string): boolean {
  return (ESIGN_RESOLVABLE_STATUSES as readonly string[]).includes(status);
}

/** An expired or declined e-signature can be explicitly resent (→ SENT again) by the same STUB action that
 * first sends it (startEsign) — an admin decision to try again, not an automatic retry. */
export const ESIGN_STARTABLE_STATUSES = ["NOT_STARTED", "EXPIRED", "DECLINED"] as const;

export function isEsignStartableStatus(status: string): boolean {
  return (ESIGN_STARTABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * §3.2 baseline audit: milestone_status PENDING → IN_PROGRESS → COMPLETED had ZERO writer anywhere —
 * contract_milestones rows sit at the PENDING column default forever. INVOICED and PAID are deliberately
 * NOT included here: they belong to the §3.3 financial flow / Wave 2c T&M-invoice wiring (operator
 * decision 13), never written by this admin surface.
 */
export const STARTABLE_MILESTONE_STATUSES = ["PENDING"] as const;

export function isStartableMilestoneStatus(status: string): boolean {
  return (STARTABLE_MILESTONE_STATUSES as readonly string[]).includes(status);
}

export const COMPLETABLE_MILESTONE_STATUSES = ["IN_PROGRESS"] as const;

export function isCompletableMilestoneStatus(status: string): boolean {
  return (COMPLETABLE_MILESTONE_STATUSES as readonly string[]).includes(status);
}

/**
 * §3.2 baseline audit: proposal_status PRICING_REVIEW/COMPLIANCE_REVIEW had no writer — the live ladder
 * skipped straight from DRAFT to COUNSEL_REVIEW. Extended ladder (strictly additive, never removes a
 * reachable state): DRAFT → PRICING_REVIEW → COMPLIANCE_REVIEW → COUNSEL_REVIEW → READY_TO_SUBMIT →
 * SUBMITTED. Each step is a separate human decision; no outbound, no auto-advance.
 */
export const PRICING_REVIEWABLE_PROPOSAL_STATUSES = ["DRAFT"] as const;

export function isPricingReviewableProposalStatus(status: string): boolean {
  return (PRICING_REVIEWABLE_PROPOSAL_STATUSES as readonly string[]).includes(status);
}

export const COMPLIANCE_REVIEWABLE_PROPOSAL_STATUSES = ["PRICING_REVIEW"] as const;

export function isComplianceReviewableProposalStatus(status: string): boolean {
  return (COMPLIANCE_REVIEWABLE_PROPOSAL_STATUSES as readonly string[]).includes(status);
}

/** counselReviewProposal's source status moved from DRAFT to COMPLIANCE_REVIEW now that pricing/compliance
 * review are separate, earlier steps in the ladder above. */
export const COUNSEL_REVIEWABLE_PROPOSAL_STATUSES = ["COMPLIANCE_REVIEW"] as const;

export function isCounselReviewableProposalStatus(status: string): boolean {
  return (COUNSEL_REVIEWABLE_PROPOSAL_STATUSES as readonly string[]).includes(status);
}

/**
 * §3.2 baseline audit: outreach_status BOUNCED had no writer — no bounce ingestion exists. The operator
 * sees a bounce in their own inbox (a Resend delivery-failure notice) and records it here; this is a human
 * observing an external fact, never inferred. Recording a bounce sends nothing (CLAUDE.md §2). Automated
 * Resend-webhook ingestion is future work, not built here.
 */
export const BOUNCEABLE_OUTREACH_STATUSES = ["SENT"] as const;

export function isBounceableOutreachStatus(status: string): boolean {
  return (BOUNCEABLE_OUTREACH_STATUSES as readonly string[]).includes(status);
}
