/**
 * Org "directives" — the firm's compliance configuration stored as validated JSONB on `orgs.directives`.
 * Untrusted input is validated at the boundary (parseDirectives). Socio-economic set-aside eligibility
 * is structurally locked to `false` (CLAUDE.md §6.7): Burger Consulting holds no such certifications.
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

/**
 * Socio-economic set-aside eligibility. Every certified category is locked to `false` via
 * `z.literal(false)`, so any attempt to enable one fails validation at the boundary.
 */
const setAsideEligibilitySchema = z.object({
  totalSmallBusiness: z.boolean(),
  eightA: z.literal(false),
  hubzone: z.literal(false),
  sdvosb: z.literal(false),
  wosb: z.literal(false),
});

export const orgDirectivesSchema = z.object({
  naicsCodes: z.array(z.string().regex(NAICS_RE)).min(1),
  setAsideEligibility: setAsideEligibilitySchema,
  zeroFloat: z.object({
    minFeasibilityScore: z.number().int().min(1).max(10),
    maxResponseDays: z.number().int().positive(),
  }),
  thresholds: z.object({
    priceRealismMinMarginPct: percentThreshold,
    passThroughMaxPct: percentThreshold,
    tinaThresholdUsd: usdThreshold,
    limitationsOnSubcontractingMaxNonSimilarPct: subcontractingCapThreshold,
  }),
});

export type OrgDirectives = z.infer<typeof orgDirectivesSchema>;

/** Validate untrusted directives input at the system boundary. Throws ZodError on violation. */
export function parseDirectives(input: unknown): OrgDirectives {
  return orgDirectivesSchema.parse(input);
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
