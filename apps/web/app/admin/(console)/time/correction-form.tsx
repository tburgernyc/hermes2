"use client";

/**
 * Client form for correcting a SUBMITTED/APPROVED time entry (§3.5 item 3). Prefilled with the entry's
 * CURRENT values so the admin edits forward from them; correctTimeEntry captures those current values
 * as `oldValues` server-side (re-read in the same transaction, not trusted from this form) before
 * applying whatever this form submits as `newValues`. A reason is required — the server also enforces
 * this (both the Zod schema and the DB `time_entry_corrections_reason_present` CHECK).
 */
import { useState, type JSX } from "react";

import { Select } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { correctTimeEntry } from "./actions";
import type { ContractOption, MilestoneOption } from "./entry-form";

export function CorrectionForm({
  entryId,
  contracts,
  milestones,
  current,
}: {
  entryId: string;
  contracts: ContractOption[];
  milestones: MilestoneOption[];
  current: {
    hours: string;
    chargeClass: "DIRECT" | "INDIRECT";
    contractId: string | null;
    milestoneId: string | null;
    description: string;
  };
}): JSX.Element {
  const [chargeClass, setChargeClass] = useState<"DIRECT" | "INDIRECT">(current.chargeClass);
  const [contractId, setContractId] = useState(current.contractId ?? "");
  const filteredMilestones = milestones.filter((m) => m.contractId === contractId);

  return (
    <form action={correctTimeEntry} className={c.formStack} data-testid="correction-form">
      <input type="hidden" name="entryId" value={entryId} />

      <Field label="Corrected hours" name="hours" type="number" step="0.25" min="0.25" max="24" required defaultValue={current.hours} />

      <Select
        label="Corrected charge class"
        name="chargeClass"
        value={chargeClass}
        onChange={(e) => setChargeClass(e.target.value === "INDIRECT" ? "INDIRECT" : "DIRECT")}
      >
        <option value="DIRECT">Direct — billable to a contract</option>
        <option value="INDIRECT">Indirect — G&amp;A / overhead / B&amp;P</option>
      </Select>

      <Select
        label={chargeClass === "DIRECT" ? "Corrected contract (required)" : "Corrected contract (optional)"}
        name="contractId"
        value={contractId}
        onChange={(e) => setContractId(e.target.value)}
        required={chargeClass === "DIRECT"}
      >
        <option value="">{chargeClass === "DIRECT" ? "Select a contract" : "— none —"}</option>
        {contracts.map((ct) => (
          <option key={ct.id} value={ct.id}>
            {ct.label}
          </option>
        ))}
      </Select>

      <Select label="Corrected milestone (optional)" name="milestoneId" defaultValue="" disabled={!contractId}>
        <option value="">— none —</option>
        {filteredMilestones.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>

      <label>
        <span className={c.formLabel}>Corrected description of work performed</span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          required
          defaultValue={current.description}
          className={c.control}
        />
      </label>

      <label>
        <span className={c.formLabel}>Reason for this correction (required)</span>
        <textarea
          name="reason"
          rows={2}
          maxLength={1000}
          required
          placeholder="e.g. Entered wrong hours; should be 6.5, not 8."
          className={c.control}
          data-testid="correction-reason"
        />
      </label>

      <Button type="submit">Save correction</Button>
    </form>
  );
}
