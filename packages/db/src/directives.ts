/**
 * Org "directives" — the firm's compliance + pricing configuration stored as validated JSONB on
 * `orgs.directives`. Untrusted input is validated at the boundary (parseDirectives). Every threshold is
 * defaulted to the PROVISIONAL baseline from docs/compliance/counsel-compliance-brief.md, so
 * `parseDirectives({})` yields the firm's full provisional config; counsel's confirmed answers + the firm's
 * actual rates merge in by overriding individual keys.
 *
 * Two hard locks (CLAUDE.md §6/§7): socio-economic set-aside eligibility is `z.literal(false)` (the firm
 * holds no such certs), and the limitations-on-subcontracting cap is stricter-only (≤ 50). All compliance
 * thresholds carry `pendingCounsel`; the deterministic engine (@hermes/ai compliance.ts) consumes these
 * values — the language model never decides them.
 */
import { z } from "zod";

const NAICS_RE = /^[0-9]{6}$/;

/** A percentage threshold (0–100), flagged PENDING COUNSEL CONFIRMATION (CLAUDE.md §6). */
const percentThreshold = z.object({
  value: z.number().min(0).max(100),
  pendingCounsel: z.boolean(),
});

/** A non-negative USD threshold, flagged PENDING COUNSEL CONFIRMATION. */
const usdThreshold = z.object({
  value: z.number().nonnegative(),
  pendingCounsel: z.boolean(),
});

/**
 * FAR 52.219-14 cap: the share of government payment to non-similarly-situated subs may never exceed
 * 50%. Config can only be STRICTER than the statutory ceiling, never looser (value clamped to ≤ 50).
 */
const subcontractingCapThreshold = z.object({
  value: z.number().min(0).max(50),
  pendingCounsel: z.boolean(),
});

/** The five subcontractor cost types (mirrors the DB cost_type enum). */
const costTypeEnum = z.enum(["LABOR", "MATERIAL", "ODC", "SUBCONTRACT", "TRAVEL"]);

/** An indirect-rate fraction (0–1), e.g. fringe 0.31. */
const rateFraction = z.number().min(0).max(1);

/**
 * Socio-economic set-aside eligibility. Every certified category is locked to `false` via
 * `z.literal(false)`, so any attempt to enable one fails validation at the boundary (CLAUDE.md §6.7).
 */
const setAsideEligibilitySchema = z
  .object({
    totalSmallBusiness: z.boolean(),
    eightA: z.literal(false),
    hubzone: z.literal(false),
    sdvosb: z.literal(false),
    wosb: z.literal(false),
  })
  .default({
    totalSmallBusiness: true,
    eightA: false,
    hubzone: false,
    sdvosb: false,
    wosb: false,
  });

export const orgDirectivesSchema = z.object({
  naicsCodes: z
    .array(z.string().regex(NAICS_RE))
    .min(1)
    .default(["541511", "541512", "541519"]),
  setAsideEligibility: setAsideEligibilitySchema,
  zeroFloat: z
    .object({
      minFeasibilityScore: z.number().int().min(1).max(10),
      maxResponseDays: z.number().int().positive(),
    })
    .default({ minFeasibilityScore: 6, maxResponseDays: 14 }),
  thresholds: z
    .object({
      // Price realism is a PRODUCT HEURISTIC, not a legal rule (low margin → human review).
      priceRealismMinMarginPct: percentThreshold.default({ value: 5, pendingCounsel: true }),
      realismThinMarginPct: percentThreshold.default({ value: 8, pendingCounsel: true }),
      realismBelowBenchmarkPct: percentThreshold.default({ value: 20, pendingCounsel: true }),
      // FAR 52.215-23 pass-through DISCLOSURE tripwire (not the prohibition).
      passThroughMaxPct: percentThreshold.default({ value: 70, pendingCounsel: true }),
      // TINA: civilian operative $2.5M; defense $10M for contracts entered after 2026-06-30.
      tinaThresholdUsd: usdThreshold.default({ value: 2_500_000, pendingCounsel: true }),
      tinaDefenseThresholdUsd: usdThreshold.default({ value: 10_000_000, pendingCounsel: true }),
      // FAR 52.219-14 trigger: the SAT (raised to $350k eff. 2025-10-01).
      subcontractingTriggerUsd: usdThreshold.default({ value: 350_000, pendingCounsel: true }),
      limitationsOnSubcontractingMaxNonSimilarPct: subcontractingCapThreshold.default({
        value: 50,
        pendingCounsel: true,
      }),
      // SBA size standard for 541511/541512/541519 (13 CFR 121.201).
      smallBusinessSizeStandardUsd: usdThreshold.default({ value: 34_000_000, pendingCounsel: true }),
    })
    .default({
      priceRealismMinMarginPct: { value: 5, pendingCounsel: true },
      realismThinMarginPct: { value: 8, pendingCounsel: true },
      realismBelowBenchmarkPct: { value: 20, pendingCounsel: true },
      passThroughMaxPct: { value: 70, pendingCounsel: true },
      tinaThresholdUsd: { value: 2_500_000, pendingCounsel: true },
      tinaDefenseThresholdUsd: { value: 10_000_000, pendingCounsel: true },
      subcontractingTriggerUsd: { value: 350_000, pendingCounsel: true },
      limitationsOnSubcontractingMaxNonSimilarPct: { value: 50, pendingCounsel: true },
      smallBusinessSizeStandardUsd: { value: 34_000_000, pendingCounsel: true },
    }),
  // SBA receipts averaging is a 5-year period (13 CFR 121.104(c)) — locked to the statutory value.
  receiptsAveragingYears: z.literal(5).default(5),
  // Under T&M these cost types carry 0% markup (profit only in burdened labor) — incl. ODC/TRAVEL (far-04).
  tmZeroMarkupCostTypes: costTypeEnum.array().default(["MATERIAL", "SUBCONTRACT", "ODC", "TRAVEL"]),
  // Unbalanced-pricing detection — all PRODUCT HEURISTICS (FAR 15.404-1(g) has no numeric threshold).
  unbalancedPricing: z
    .object({
      lineItemDeviationPct: percentThreshold.default({ value: 25, pendingCounsel: false }),
      watchPct: percentThreshold.default({ value: 15, pendingCounsel: false }),
      frontLoadingExcessPct: percentThreshold.default({ value: 25, pendingCounsel: false }),
      outYearUnitFloorPct: percentThreshold.default({ value: 75, pendingCounsel: false }),
      // GAO: an understated item alone is NOT unbalanced — require a paired overstated item.
      requireBothOverAndUnder: z.boolean().default(true),
      isHeuristic: z.literal(true).default(true),
    })
    .default({
      lineItemDeviationPct: { value: 25, pendingCounsel: false },
      watchPct: { value: 15, pendingCounsel: false },
      frontLoadingExcessPct: { value: 25, pendingCounsel: false },
      outYearUnitFloorPct: { value: 75, pendingCounsel: false },
      requireBothOverAndUnder: true,
      isHeuristic: true,
    }),
  // Run the full pricing pipeline on provisional rates for testing; never blocks (watermark only). A real
  // bid is gated separately (readyForLiveSubmission). Flip OFF when actual indirect rates are loaded.
  provisionalRatesMode: z.boolean().default(true),
  illustrativeIndirectRates: z
    .object({
      fringe: rateFraction,
      overhead: rateFraction,
      ga: rateFraction,
      fee: rateFraction,
      wrapSanityMin: z.number().positive(),
      wrapSanityMax: z.number().positive(),
    })
    .default({ fringe: 0.31, overhead: 0.42, ga: 0.12, fee: 0.085, wrapSanityMin: 1.6, wrapSanityMax: 2.2 }),
  // Registration gates — part of readyForLiveSubmission; block an ACTUAL bid only, never the workflow.
  registration: z
    .object({
      samRegistrationActive: z.boolean().default(false), // FAR 52.204-7
      cageAssigned: z.boolean().default(false),
    })
    .default({ samRegistrationActive: false, cageAssigned: false }),
});

export type OrgDirectives = z.infer<typeof orgDirectivesSchema>;

/** Validate untrusted directives input at the system boundary. Throws ZodError on violation. */
export function parseDirectives(input: unknown): OrgDirectives {
  return orgDirectivesSchema.parse(input);
}

/** The firm's full PROVISIONAL directives (all schema defaults) — the build/testing baseline. */
export function defaultDirectives(): OrgDirectives {
  return orgDirectivesSchema.parse({});
}

/**
 * True if ANY compliance threshold is still `pendingCounsel` (i.e. not yet confirmed by the firm's
 * licensed government-contracts attorney). Feeds the `counselConfirmed` gate of readyForLiveSubmission —
 * an actual bid cannot go out while this is true.
 */
export function hasUnconfirmedCounselThresholds(directives: OrgDirectives): boolean {
  return Object.values(directives.thresholds).some((t) => t.pendingCounsel);
}

/**
 * Defense-in-depth guard (beyond the z.literal(false) schema lock): reject any directives object that
 * enables a socio-economic set-aside the firm is not certified for (CLAUDE.md §6.7).
 */
export function assertNoSocioEconomicCerts(directives: OrgDirectives): void {
  const e = directives.setAsideEligibility;
  if (e.eightA || e.hubzone || e.sdvosb || e.wosb) {
    throw new Error(
      "Socio-economic set-aside eligibility cannot be enabled: Burger Consulting holds no such certifications (CLAUDE.md §6.7).",
    );
  }
}
