"use server";

/**
 * /admin/settings — the ONLY place `orgs.{name,ein,uei,cageCode,primaryDomain}` and `orgs.directives`
 * can be changed outside a raw DB/seed script. Every write re-validates the FULL merged directives object
 * through `orgDirectivesSchema` (never trusts the form in isolation), so the hard §6.7 lock — a
 * socio-economic set-aside can never be enabled — holds even if a form field were ever mis-wired. Admin
 * session re-checked; org-scoped transaction; audited. This is a configuration change, not an outbound
 * action or a workflow advance (CLAUDE.md §2 untouched).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  eq,
  orgDirectivesSchema,
  orgs,
  parseDirectives,
  withOrg,
  type OrgDirectives,
} from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

export interface SettingsState {
  ok: boolean;
  error?: string;
  savedAt?: number;
}

const UEI_RE = /^[A-Z0-9]{12}$/;
const CAGE_RE = /^[A-Z0-9]{5}$/;
const EIN_RE = /^[0-9]{2}-?[0-9]{7}$/;

/** Everything the settings form posts. Checkbox fields arrive as "on" or are absent when unchecked. */
const formSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ein: z.string().trim().toUpperCase().regex(EIN_RE, "EIN must look like 12-3456789").or(z.literal("")),
  uei: z.string().trim().toUpperCase().regex(UEI_RE, "UEI must be 12 letters/digits").or(z.literal("")),
  cageCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CAGE_RE, "CAGE code must be 5 letters/digits")
    .or(z.literal("")),
  primaryDomain: z.string().trim().max(253).or(z.literal("")),

  naicsCodes: z.string().trim().min(1),
  totalSmallBusiness: z.string().optional(),

  minFeasibilityScore: z.coerce.number().int().min(1).max(10),
  maxResponseDays: z.coerce.number().int().positive(),

  priceRealismMinMarginPct: z.coerce.number().min(0).max(100),
  priceRealismMinMarginPctConfirmed: z.string().optional(),
  realismThinMarginPct: z.coerce.number().min(0).max(100),
  realismThinMarginPctConfirmed: z.string().optional(),
  realismBelowBenchmarkPct: z.coerce.number().min(0).max(100),
  realismBelowBenchmarkPctConfirmed: z.string().optional(),
  passThroughMaxPct: z.coerce.number().min(0).max(100),
  passThroughMaxPctConfirmed: z.string().optional(),
  tinaThresholdUsd: z.coerce.number().nonnegative(),
  tinaThresholdUsdConfirmed: z.string().optional(),
  tinaDefenseThresholdUsd: z.coerce.number().nonnegative(),
  tinaDefenseThresholdUsdConfirmed: z.string().optional(),
  subcontractingTriggerUsd: z.coerce.number().nonnegative(),
  subcontractingTriggerUsdConfirmed: z.string().optional(),
  limitationsOnSubcontractingMaxNonSimilarPct: z.coerce.number().min(0).max(50),
  limitationsOnSubcontractingMaxNonSimilarPctConfirmed: z.string().optional(),
  smallBusinessSizeStandardUsd: z.coerce.number().nonnegative(),
  smallBusinessSizeStandardUsdConfirmed: z.string().optional(),

  provisionalRatesMode: z.string().optional(),
  fringe: z.coerce.number().min(0).max(1),
  overhead: z.coerce.number().min(0).max(1),
  ga: z.coerce.number().min(0).max(1),
  fee: z.coerce.number().min(0).max(1),
  wrapSanityMin: z.coerce.number().positive(),
  wrapSanityMax: z.coerce.number().positive(),

  samRegistrationActive: z.string().optional(),
  cageAssigned: z.string().optional(),
});

function checked(v: string | undefined): boolean {
  return v === "on" || v === "true";
}

/**
 * Merge the form's editable subset into the CURRENT directives, then re-validate the whole object.
 * Anything the form doesn't manage (unbalanced-pricing heuristics, tmZeroMarkupCostTypes,
 * receiptsAveragingYears) passes through untouched from `current`.
 */
function mergeDirectives(current: OrgDirectives, f: z.infer<typeof formSchema>): OrgDirectives {
  const naicsCodes = f.naicsCodes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const next: OrgDirectives = {
    ...current,
    naicsCodes: naicsCodes.length > 0 ? naicsCodes : current.naicsCodes,
    setAsideEligibility: {
      ...current.setAsideEligibility,
      totalSmallBusiness: checked(f.totalSmallBusiness),
      // eightA/hubzone/sdvosb/wosb are NOT settable from this form — orgDirectivesSchema locks them to
      // `false` regardless (CLAUDE.md §6.7); spreading `current` here is a no-op, kept for clarity.
    },
    zeroFloat: {
      minFeasibilityScore: f.minFeasibilityScore,
      maxResponseDays: f.maxResponseDays,
    },
    thresholds: {
      priceRealismMinMarginPct: {
        value: f.priceRealismMinMarginPct,
        pendingCounsel: !checked(f.priceRealismMinMarginPctConfirmed),
      },
      realismThinMarginPct: {
        value: f.realismThinMarginPct,
        pendingCounsel: !checked(f.realismThinMarginPctConfirmed),
      },
      realismBelowBenchmarkPct: {
        value: f.realismBelowBenchmarkPct,
        pendingCounsel: !checked(f.realismBelowBenchmarkPctConfirmed),
      },
      passThroughMaxPct: {
        value: f.passThroughMaxPct,
        pendingCounsel: !checked(f.passThroughMaxPctConfirmed),
      },
      tinaThresholdUsd: {
        value: f.tinaThresholdUsd,
        pendingCounsel: !checked(f.tinaThresholdUsdConfirmed),
      },
      tinaDefenseThresholdUsd: {
        value: f.tinaDefenseThresholdUsd,
        pendingCounsel: !checked(f.tinaDefenseThresholdUsdConfirmed),
      },
      subcontractingTriggerUsd: {
        value: f.subcontractingTriggerUsd,
        pendingCounsel: !checked(f.subcontractingTriggerUsdConfirmed),
      },
      limitationsOnSubcontractingMaxNonSimilarPct: {
        value: f.limitationsOnSubcontractingMaxNonSimilarPct,
        pendingCounsel: !checked(f.limitationsOnSubcontractingMaxNonSimilarPctConfirmed),
      },
      smallBusinessSizeStandardUsd: {
        value: f.smallBusinessSizeStandardUsd,
        pendingCounsel: !checked(f.smallBusinessSizeStandardUsdConfirmed),
      },
    },
    provisionalRatesMode: checked(f.provisionalRatesMode),
    illustrativeIndirectRates: {
      fringe: f.fringe,
      overhead: f.overhead,
      ga: f.ga,
      fee: f.fee,
      wrapSanityMin: f.wrapSanityMin,
      wrapSanityMax: f.wrapSanityMax,
    },
    registration: {
      samRegistrationActive: checked(f.samRegistrationActive),
      cageAssigned: checked(f.cageAssigned),
    },
  };
  return next;
}

export async function updateSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { ok: false, error: "Your session is no longer authorized. Sign in again." };
  }
  const orgId = session.user.orgId;

  const raw = Object.fromEntries(formData.entries());
  const parsedForm = formSchema.safeParse(raw);
  if (!parsedForm.success) {
    const first = parsedForm.error.issues[0];
    return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid input." };
  }
  const f = parsedForm.data;

  try {
    await withOrg(orgId, async (tx) => {
      const rows = await tx
        .select({ directives: orgs.directives, ein: orgs.ein, uei: orgs.uei, cageCode: orgs.cageCode })
        .from(orgs)
        .where(eq(orgs.id, orgId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("org not found");

      const current = parseDirectives(row.directives);
      const merged = mergeDirectives(current, f);
      // Re-validate the WHOLE object (belt behind the per-field merge above — the hard set-aside lock
      // and every range constraint are enforced here regardless of what the form sent).
      const validated = orgDirectivesSchema.parse(merged);

      await tx
        .update(orgs)
        .set({
          name: f.name,
          ein: f.ein || null,
          uei: f.uei || null,
          cageCode: f.cageCode || null,
          primaryDomain: f.primaryDomain || null,
          directives: validated,
        })
        .where(eq(orgs.id, orgId));

      await writeAudit(tx, {
        orgId,
        actorType: "ADMIN",
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? null,
        action: "ORG_SETTINGS_UPDATED",
        entityType: "orgs",
        entityId: orgId,
        before: { ein: row.ein, uei: row.uei, cageCode: row.cageCode, directives: current },
        after: { ein: f.ein || null, uei: f.uei || null, cageCode: f.cageCode || null, directives: validated },
      });
    });
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? `Invalid configuration: ${err.issues[0]?.message ?? "validation failed"}`
        : "Could not save settings. Check the values and try again.";
    return { ok: false, error: message };
  }

  revalidatePath("/admin/settings");
  return { ok: true, savedAt: Date.now() };
}
