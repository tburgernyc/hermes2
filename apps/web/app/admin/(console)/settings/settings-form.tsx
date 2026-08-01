"use client";

/**
 * Client form for /admin/settings. useActionState so a validation error or success confirmation renders
 * inline without a full navigation. Every numeric field is a plain controlled-by-the-DOM input (no client
 * state mirroring) — the server re-validates everything on submit (CLAUDE.md §7); this form only shapes
 * the inputs and shows the previous saved values as defaults.
 */
import type { JSX } from "react";
import { useActionState } from "react";

import { Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { updateSettings, type SettingsState } from "./actions";
import type { OrgDirectives } from "@hermes/db";

interface OrgIdentity {
  name: string;
  ein: string | null;
  uei: string | null;
  cageCode: string | null;
  primaryDomain: string | null;
}

interface ThresholdField {
  key: keyof OrgDirectives["thresholds"];
  label: string;
  hint: string;
}

const THRESHOLD_FIELDS: ThresholdField[] = [
  {
    key: "priceRealismMinMarginPct",
    label: "Price realism minimum margin (%)",
    hint: "Below this margin, a quote triggers a REALISM_WARNING for human review. Product heuristic.",
  },
  {
    key: "realismThinMarginPct",
    label: "Thin-margin watch threshold (%)",
    hint: "Product heuristic.",
  },
  {
    key: "realismBelowBenchmarkPct",
    label: "Below-benchmark realism threshold (%)",
    hint: "Product heuristic vs. USASpending award benchmarks.",
  },
  {
    key: "passThroughMaxPct",
    label: "Pass-through disclosure threshold (%)",
    hint: "FAR 52.215-23 — flag when subcontracted cost share exceeds this and require a value-add justification.",
  },
  {
    key: "tinaThresholdUsd",
    label: "TINA threshold, civilian (USD)",
    hint: "Certified cost-or-pricing data trigger. Rarely fires under adequate price competition.",
  },
  {
    key: "tinaDefenseThresholdUsd",
    label: "TINA threshold, defense (USD)",
    hint: "For contracts entered after 2026-06-30.",
  },
  {
    key: "subcontractingTriggerUsd",
    label: "Limitations-on-subcontracting SAT trigger (USD)",
    hint: "FAR 52.219-14 applies at/above this contract value.",
  },
  {
    key: "limitationsOnSubcontractingMaxNonSimilarPct",
    label: "Max non-similarly-situated share (%)",
    hint: "FAR 52.219-14 statutory ceiling is 50% — this can only be set STRICTER, never looser.",
  },
  {
    key: "smallBusinessSizeStandardUsd",
    label: "SBA small-business size standard (USD)",
    hint: "13 CFR 121.201 receipts-based size standard for your NAICS codes.",
  },
];

export function SettingsForm({
  org,
  directives,
}: {
  org: OrgIdentity;
  directives: OrgDirectives;
}): JSX.Element {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateSettings, { ok: false });
  const t = directives.thresholds;

  return (
    <form action={action}>
      <Section title="Firm identity">
        <div className={c.row}>
          <Field label="Legal name" name="name" defaultValue={org.name} required maxLength={200} />
          <Field
            label="EIN"
            name="ein"
            defaultValue={org.ein ?? ""}
            placeholder="12-3456789"
            hint="Leave blank until assigned."
          />
        </div>
        <div className={c.row}>
          <Field
            label="UEI"
            name="uei"
            defaultValue={org.uei ?? ""}
            placeholder="12 letters/digits"
            hint="SAM.gov Unique Entity Identifier."
          />
          <Field
            label="CAGE code"
            name="cageCode"
            defaultValue={org.cageCode ?? ""}
            placeholder="5 letters/digits"
            hint="Leave blank until assigned."
          />
        </div>
        <Field
          label="Primary domain"
          name="primaryDomain"
          defaultValue={org.primaryDomain ?? ""}
          placeholder="yourcompany.com"
        />
      </Section>

      <Section title="Registration status">
        <label className={c.field}>
          <span className={c.fieldLabel}>
            <input
              type="checkbox"
              name="samRegistrationActive"
              defaultChecked={directives.registration.samRegistrationActive}
            />{" "}
            SAM.gov registration is active (FAR 52.204-7)
          </span>
        </label>
        <label className={c.field}>
          <span className={c.fieldLabel}>
            <input type="checkbox" name="cageAssigned" defaultChecked={directives.registration.cageAssigned} />{" "}
            CAGE code has been assigned
          </span>
        </label>
      </Section>

      <Section title="Scope & go/no-go">
        <Field
          label="NAICS codes (comma-separated)"
          name="naicsCodes"
          defaultValue={directives.naicsCodes.join(", ")}
          required
        />
        <div className={c.row}>
          <Field
            label="Minimum feasibility score (1-10)"
            name="minFeasibilityScore"
            type="number"
            min={1}
            max={10}
            defaultValue={directives.zeroFloat.minFeasibilityScore}
            required
          />
          <Field
            label="Max response days"
            name="maxResponseDays"
            type="number"
            min={1}
            defaultValue={directives.zeroFloat.maxResponseDays}
            required
          />
        </div>
        <label className={c.field}>
          <span className={c.fieldLabel}>
            <input
              type="checkbox"
              name="totalSmallBusiness"
              defaultChecked={directives.setAsideEligibility.totalSmallBusiness}
            />{" "}
            Eligible for Total Small Business set-asides
          </span>
        </label>
        <p className={c.meta}>
          8(a) / HUBZone / SDVOSB / WOSB eligibility cannot be enabled here — the system structurally locks
          these to &ldquo;not certified&rdquo; (CLAUDE.md §6.7) until you hold the actual certification and
          this rule is deliberately updated in code, never toggled in a settings form.
        </p>
      </Section>

      <Section title="Compliance thresholds (PENDING COUNSEL until confirmed)">
        {THRESHOLD_FIELDS.map((tf) => (
          <div className={c.row} key={tf.key}>
            <Field
              label={tf.label}
              name={tf.key}
              type="number"
              step="any"
              defaultValue={t[tf.key].value}
              hint={tf.hint}
              required
            />
            <label className={c.field}>
              <span className={c.fieldLabel}>
                <input
                  type="checkbox"
                  name={`${tf.key}Confirmed`}
                  defaultChecked={!t[tf.key].pendingCounsel}
                />{" "}
                Confirmed by counsel
              </span>
            </label>
          </div>
        ))}
      </Section>

      <Section title="Indirect rates">
        <label className={c.field}>
          <span className={c.fieldLabel}>
            <input
              type="checkbox"
              name="provisionalRatesMode"
              defaultChecked={directives.provisionalRatesMode}
            />{" "}
            Provisional rates mode (leave ON until real indirect rates replace the illustrative ones below —
            a bid cannot go live while this is ON)
          </span>
        </label>
        <div className={c.row}>
          <Field
            label="Fringe (0-1)"
            name="fringe"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            defaultValue={directives.illustrativeIndirectRates.fringe}
            required
          />
          <Field
            label="Overhead (0-1)"
            name="overhead"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            defaultValue={directives.illustrativeIndirectRates.overhead}
            required
          />
        </div>
        <div className={c.row}>
          <Field
            label="G&A (0-1)"
            name="ga"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            defaultValue={directives.illustrativeIndirectRates.ga}
            required
          />
          <Field
            label="Fee (0-1)"
            name="fee"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            defaultValue={directives.illustrativeIndirectRates.fee}
            required
          />
        </div>
        <div className={c.row}>
          <Field
            label="Wrap-rate sanity min"
            name="wrapSanityMin"
            type="number"
            step="0.01"
            defaultValue={directives.illustrativeIndirectRates.wrapSanityMin}
            required
          />
          <Field
            label="Wrap-rate sanity max"
            name="wrapSanityMax"
            type="number"
            step="0.01"
            defaultValue={directives.illustrativeIndirectRates.wrapSanityMax}
            required
          />
        </div>
      </Section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>

      {state.error ? (
        <Alert testId="settings-error">{state.error}</Alert>
      ) : state.ok ? (
        <Alert variant="success" role="status" testId="settings-success">
          Settings saved.
        </Alert>
      ) : null}
    </form>
  );
}
