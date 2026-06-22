/**
 * pgEnums for the Hermes 2.0 schema. Values are UPPERCASE constants (case-sensitive in Postgres).
 * The solicitation/proposal/quote statuses encode the workflow state machine (PROJECT_PLAN.md §2);
 * compliance-bearing enums map to CLAUDE.md §6 and remain PENDING COUNSEL CONFIRMATION.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["ADMIN", "VENDOR"]);

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

/**
 * AI advisory recommendation (recommendation-only — a human always decides). Mirrors the AI engine's
 * RecommendationZ (packages/ai schemas). Surfaced on triaged solicitations and matched outreach so the
 * operator sees the model's advisory verdict before deciding — never a gate (CLAUDE.md §2).
 */
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

export const documentEntityType = pgEnum("document_entity_type", [
  "SOLICITATION",
  "VENDOR",
  "VENDOR_PROSPECT",
  "VENDOR_QUOTE",
  "PROPOSAL",
  "CONTRACT",
  "CONTRACT_MILESTONE",
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
