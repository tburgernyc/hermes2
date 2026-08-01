/**
 * pgEnums for the Hermes 2.0 schema. Values are UPPERCASE constants (case-sensitive in Postgres).
 * The solicitation/proposal/quote statuses encode the workflow state machine (PROJECT_PLAN.md §2);
 * compliance-bearing enums map to CLAUDE.md §6 and remain PENDING COUNSEL CONFIRMATION.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["ADMIN", "VENDOR"]);

/**
 * Granular admin-side access level (§3.6) — orthogonal to the ADMIN/VENDOR portal split. Carried
 * ONLY by ADMIN-role users (CHECK-enforced on users): FULL = current behavior; CAPTURE =
 * solicitations/proposals/outreach, no directives/financials; FINANCE = contracts/invoices/
 * timekeeping, no sourcing/drafting. Enforcement (RLS + server checks) is Phase-B §3.6 work.
 */
export const adminRole = pgEnum("admin_role", ["FULL", "CAPTURE", "FINANCE"]);

/** Who performed an audited action (token = low-trust public submission path). */
export const actorType = pgEnum("actor_type", ["SYSTEM", "ADMIN", "VENDOR", "TOKEN"]);

/** Solicitation lifecycle spine. Human-gated transitions are enforced by CHECK + Stage-2 triggers. */
export const solicitationStatus = pgEnum("solicitation_status", [
  "PENDING_TRIAGE",
  "TRIAGE_COMPLETE", // AI recommendation only — no advance, no outbound
  "NO_GO", // triage rejected (terminal)
  "READY_FOR_SOURCING", // human approved sourcing
  "AWAITING_APPROVAL", // outreach drafted, waiting on human
  "SOURCING_IN_PROGRESS", // outreach approved + sent
  "PRICING_PENDING", // quotes received + ranked
  "PROPOSAL_DRAFT", // bid drafted
  "SUBMITTED", // human submitted to agency
  "AWARDED",
  "CLOSED",
  "REJECTED",
]);

/**
 * Which side of the deal the firm is on for a pursuit (§3.4). PRIME = the existing pipeline
 * (the firm bids the government directly, sourcing its own subs). SUBCONTRACTOR = the firm teams
 * under ANOTHER company's prime contract (admin-logged entry point, teaming_partners counterparty,
 * teaming_agreements record). Orthogonal to rfi_track_status (§3.8) — the two axes never collide.
 */
export const dealRole = pgEnum("deal_role", ["PRIME", "SUBCONTRACTOR"]);

/** Post-decision protest tracking (§3.1) — a lightweight status + free-text notes, not a docket. */
export const protestStatus = pgEnum("protest_status", [
  "NONE",
  "CONSIDERING",
  "FILED",
  "RESOLVED_SUSTAINED",
  "RESOLVED_DENIED",
  "WITHDRAWN",
]);

/**
 * §3.8 sources-sought/RFI capture-development track — deliberately LIGHTER than the bid/award
 * state machine (no AWARDED/WON/LOST). NULL on solicitations = not on the RFI track. CONVERTED
 * links forward via solicitations.converted_from_solicitation_id on the NEW pursuit row.
 */
export const rfiTrackStatus = pgEnum("rfi_track_status", [
  "RECEIVED",
  "CAPABILITY_DRAFTED",
  "RESPONSE_SUBMITTED",
  "CONVERTED",
  "CLOSED_NO_ACTION",
]);

/** Reality of the notice (NOT what the firm is eligible for). Eligibility is decided in screening. */
export const setAsideType = pgEnum("set_aside_type", [
  "NONE", // full & open / unrestricted
  "TOTAL_SMALL_BUSINESS",
  "EIGHT_A",
  "HUBZONE",
  "SDVOSB",
  "WOSB",
  "OTHER",
]);

export const contractType = pgEnum("contract_type", [
  "FFP", // Firm-Fixed-Price
  "TM", // Time-and-Materials (materials/subcontracts billed at cost, 0% markup — CLAUDE.md §6.2)
  "FFP_MILESTONE", // FFP with milestone/progress payments
]);

export const zeroFloatFit = pgEnum("zero_float_fit", ["STRONG", "MODERATE", "WEAK", "NONE"]);

/** Shared AI-verdict enum: solicitation triage recommendation AND per-prospect outreach match verdict. */
export const aiRecommendation = pgEnum("ai_recommendation", ["PURSUE", "REJECT", "HUMAN_REVIEW"]);

export const noticeType = pgEnum("notice_type", [
  "SOLICITATION",
  "COMBINED_SYNOPSIS_SOLICITATION",
  "PRESOLICITATION",
  "SOURCES_SOUGHT",
  "RFI",
  "SPECIAL_NOTICE",
  "AWARD_NOTICE",
  "JUSTIFICATION",
]);

export const awardAmountKind = pgEnum("award_amount_kind", [
  "EXACT",
  "ESTIMATED",
  "CEILING",
  "OBLIGATED",
  "UNKNOWN",
]);

export const vendorStatus = pgEnum("vendor_status", [
  "PENDING_REVIEW",
  "VETTED",
  "NON_COMPLIANT", // e.g., expired COI
  "EXCLUDED", // active federal exclusion / debarment
]);

export const prospectStatus = pgEnum("prospect_status", [
  "NEW",
  "SCREENED",
  "CONTACTED",
  "RESPONDED",
  "QUALIFIED",
  "PROMOTED", // a vetted vendor was created from this prospect
  "DECLINED",
  "OPTED_OUT",
]);

export const prospectSource = pgEnum("prospect_source", [
  "DISCOVERY",
  "TOKENIZED_SUBMISSION", // low-trust public write
  "MANUAL",
  "REFERRAL",
]);

export const smallBusinessStatus = pgEnum("small_business_status", [
  "SMALL",
  "OTHER_THAN_SMALL",
  "UNKNOWN",
]);

export const outreachStep = pgEnum("outreach_step", ["DAY_0", "DAY_3", "DAY_7"]);

export const outreachStatus = pgEnum("outreach_status", [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED", // human approved (approved_by/at required by CHECK)
  "SENT",
  "BOUNCED",
  "RESPONDED",
  "OPTED_OUT",
  "CANCELLED",
]);

export const tokenPurpose = pgEnum("token_purpose", [
  "QUOTE_SUBMISSION",
  "OPT_OUT",
  "VENDOR_INVITE", // vendor-scoped account-onboarding token (Phase-6 portal) — see packages/core tokens.ts
]);

export const quoteStatus = pgEnum("quote_status", [
  "INVITED",
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "REJECTED",
  "WITHDRAWN",
  "SELECTED",
]);

export const proposalStatus = pgEnum("proposal_status", [
  "DRAFT",
  "PRICING_REVIEW",
  "COMPLIANCE_REVIEW",
  "COUNSEL_REVIEW",
  "READY_TO_SUBMIT",
  "SUBMITTED", // requires human submitter + counsel review (CHECK — CLAUDE.md §6.6)
  "WON",
  "LOST",
  "WITHDRAWN",
]);

export const costType = pgEnum("cost_type", ["LABOR", "MATERIAL", "ODC", "SUBCONTRACT", "TRAVEL"]);

export const contractStatus = pgEnum("contract_status", [
  "PENDING_SIGNATURE",
  "ACTIVE",
  "COMPLETED",
  "TERMINATED",
  "CLOSED_OUT",
]);

export const esignStatus = pgEnum("esign_status", [
  "NOT_STARTED",
  "SENT",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
]);

export const milestoneStatus = pgEnum("milestone_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "INVOICED",
  "PAID",
]);

export const arFollowupStatus = pgEnum("ar_followup_status", [
  "SCHEDULED",
  "SENT",
  "PAID",
  "ESCALATED",
  "WRITTEN_OFF",
]);

/** Prompt-Payment invoice kind (§3.3): progress (14-day gov clock) vs final (30-day). */
export const invoiceKind = pgEnum("invoice_kind", ["PROGRESS", "FINAL"]);

/**
 * Outbound-invoice lifecycle (§3.3): the firm invoicing the government (PRIME) or a teaming
 * partner (SUBCONTRACTOR). paid_at is the revenue-recognition point — and, on a government
 * invoice, the clock source for the linked subcontractor payable. "Overdue" is computed at
 * runtime from submitted_at/paid_at, never stored (ar_followups precedent).
 */
export const invoiceStatus = pgEnum("invoice_status", ["DRAFT", "SUBMITTED", "PAID", "CANCELLED"]);

/**
 * Subcontractor-payable state (§3.3). The due date is DERIVED at runtime from the linked
 * government invoice's paid_at (7/15-day Prompt Payment clock) — deliberately NO stored due date.
 */
export const payableStatus = pgEnum("payable_status", ["PENDING", "PAID"]);

/** CPARS-style past-performance rating scale (§3.3) — the standard five-level scheme. */
export const cparsRating = pgEnum("cpars_rating", [
  "EXCEPTIONAL",
  "VERY_GOOD",
  "SATISFACTORY",
  "MARGINAL",
  "UNSATISFACTORY",
]);

/** DCAA direct/indirect labor segregation (§3.5, DFARS 252.242-7006). */
export const timeChargeClass = pgEnum("time_charge_class", ["DIRECT", "INDIRECT"]);

/**
 * Timesheet-period lifecycle (§3.5). APPROVED requires a recorded human approver + timestamp
 * (CHECK-enforced) — the same human-gate pattern as outreach approval. Status lives at the
 * PERIOD level; individual time_entries carry no status of their own.
 */
export const timesheetStatus = pgEnum("timesheet_status", ["OPEN", "SUBMITTED", "APPROVED"]);

/** The firm's OWN insurance/bonding policy types (§3.7.2 — mirror of vendor COI tracking). */
export const insurancePolicyType = pgEnum("insurance_policy_type", [
  "GENERAL_LIABILITY",
  "PROFESSIONAL_EO",
  "CYBER",
  "BOND",
  "OTHER",
]);

/** Teaming-agreement lifecycle (§3.4) — deliberately lighter than contracts (the partner's prime
 * usually furnishes/negotiates the controlling agreement text). */
export const teamingAgreementStatus = pgEnum("teaming_agreement_status", [
  "DRAFT",
  "UNDER_NEGOTIATION",
  "EXECUTED",
  "TERMINATED",
  "CLOSED",
]);

/** Manual recertification-event log kinds (§3.7.1 — option-year exercise, size recert, M&A). */
export const complianceEventKind = pgEnum("compliance_event_kind", [
  "OPTION_YEAR_RECERT",
  "SIZE_RECERT",
  "MERGER_ACQUISITION",
  "OTHER",
]);

// TEAMING_AGREEMENT / INSURANCE_POLICY (Phase A, §3.4/§3.7): new values are APPENDED — the
// generated ALTER TYPE ADD VALUE must not be USED in the same migration transaction (PG16 hazard,
// CLAUDE.md Phase-6 PR-I note), so the owner-XOR CHECK arms that reference them live in MANUAL
// migration 0012 (runs in a separate transaction after the drizzle batch commits).
export const documentEntityType = pgEnum("document_entity_type", [
  "SOLICITATION",
  "VENDOR",
  "VENDOR_PROSPECT",
  "VENDOR_QUOTE",
  "PROPOSAL",
  "CONTRACT",
  "CONTRACT_MILESTONE",
  "TEAMING_AGREEMENT",
  "INSURANCE_POLICY",
]);

export const documentKind = pgEnum("document_kind", [
  "SOLICITATION_ATTACHMENT",
  "CAPABILITY_STATEMENT",
  "COI",
  "W9",
  "QUOTE",
  "PROPOSAL_DRAFT",
  "PROPOSAL_FINAL",
  "SIGNED_CONTRACT",
  "DELIVERABLE",
  "OTHER",
  "SUBCONTRACT_DRAFT", // §3.1.4: the AI-drafted, UNSIGNED subcontract awaiting admin review
]);

/** Provenance of the is_services classification (NULL is_services ⇒ unclassified ⇒ block). */
export const classificationSource = pgEnum("classification_source", [
  "AI_TRIAGE",
  "HUMAN",
  "SAM_GOV",
  "HEURISTIC",
]);

/** Audience a public marketing contact inquiry self-identifies as (drives admin triage, not workflow). */
export const inquiryIntent = pgEnum("inquiry_intent", ["TEAMING", "AGENCY", "OTHER"]);

/** Contact-inquiry review state. The admin flips NEW → REVIEWED by hand; no model, no outbound (§2). */
export const inquiryStatus = pgEnum("inquiry_status", ["NEW", "REVIEWED"]);
