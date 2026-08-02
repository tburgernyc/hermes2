"use client";

/**
 * Client form for logging a time entry (§3.5 item 2 — daily entry surface). Client-only so the
 * milestone dropdown can be filtered to the selected contract, and the contract field can be
 * required/optional depending on the charge-class choice, without a page round-trip. The actual write
 * (and every re-check — DIRECT-requires-contract, hours range, description-present) happens server-side
 * in createTimeEntry; this component only shapes the UI, it trusts nothing about its own state.
 */
import { useState, type JSX } from "react";

import { Select } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { createTimeEntry } from "./actions";

export interface ContractOption {
  id: string;
  label: string;
}
export interface MilestoneOption {
  id: string;
  contractId: string;
  label: string;
}

export function EntryForm({
  contracts,
  milestones,
  today,
}: {
  contracts: ContractOption[];
  milestones: MilestoneOption[];
  today: string;
}): JSX.Element {
  const [chargeClass, setChargeClass] = useState<"DIRECT" | "INDIRECT">("DIRECT");
  const [contractId, setContractId] = useState("");
  const filteredMilestones = milestones.filter((m) => m.contractId === contractId);

  return (
    <form action={createTimeEntry} className={c.formStack} data-testid="entry-form">
      <Field
        label="Date"
        name="workDate"
        type="date"
        max={today}
        defaultValue={today}
        required
        hint="Same-day entry is the DCAA-expected norm — log today's work today."
      />
      <Field label="Hours" name="hours" type="number" step="0.25" min="0.25" max="24" required />

      <Select
        label="Charge class"
        name="chargeClass"
        value={chargeClass}
        onChange={(e) => setChargeClass(e.target.value === "INDIRECT" ? "INDIRECT" : "DIRECT")}
      >
        <option value="DIRECT">Direct — billable to a contract</option>
        <option value="INDIRECT">Indirect — G&amp;A / overhead / B&amp;P</option>
      </Select>

      <Select
        label={chargeClass === "DIRECT" ? "Contract (required)" : "Contract (optional)"}
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

      <Select label="Milestone (optional)" name="milestoneId" defaultValue="" disabled={!contractId}>
        <option value="">— none —</option>
        {filteredMilestones.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>

      <label>
        <span className={c.formLabel}>Description of work performed</span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          required
          placeholder="What did you work on?"
          className={c.control}
        />
      </label>

      <Button type="submit">Log time</Button>
    </form>
  );
}
