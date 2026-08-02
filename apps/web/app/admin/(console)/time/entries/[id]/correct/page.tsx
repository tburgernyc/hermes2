/**
 * /admin/time/entries/[id]/correct — the correction surface (§3.5 item 3). Only reachable/valid for an
 * entry whose period is SUBMITTED or APPROVED (an OPEN-period entry is a draft, edited/deleted directly
 * from /admin/time). Shows the entry's CURRENT values plus its full correction history before the form,
 * so the reviewer can see exactly what is about to change and what has already been changed.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import {
  and,
  contractMilestones,
  contracts as contractsTable,
  desc,
  eq,
  solicitations,
  timeEntries,
  timeEntryCorrections,
  timesheetPeriods,
  users,
  withOrg,
} from "@hermes/db";

import { Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireAdmin } from "@/lib/auth-guard";

import { CorrectionForm } from "../../../correction-form";
import type { ContractOption, MilestoneOption } from "../../../entry-form";

export const dynamic = "force-dynamic";

function renderSnapshot(v: unknown): string {
  if (typeof v !== "object" || v === null) return String(v);
  const obj = v as Record<string, unknown>;
  return ["hours", "chargeClass", "contractId", "milestoneId", "description"]
    .filter((k) => k in obj)
    .map((k) => `${k}: ${JSON.stringify(obj[k])}`)
    .join(", ");
}

export default async function CorrectEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const data = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: timeEntries.id,
        workDate: timeEntries.workDate,
        hours: timeEntries.hours,
        chargeClass: timeEntries.chargeClass,
        contractId: timeEntries.contractId,
        milestoneId: timeEntries.milestoneId,
        description: timeEntries.description,
        periodStatus: timesheetPeriods.status,
      })
      .from(timeEntries)
      .innerJoin(
        timesheetPeriods,
        and(eq(timesheetPeriods.orgId, timeEntries.orgId), eq(timesheetPeriods.id, timeEntries.periodId)),
      )
      .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.id, id)))
      .limit(1);
    const entry = rows[0];
    if (!entry) return null;

    const corrections = await tx
      .select({
        id: timeEntryCorrections.id,
        correctedByEmail: users.email,
        correctedAt: timeEntryCorrections.correctedAt,
        oldValues: timeEntryCorrections.oldValues,
        newValues: timeEntryCorrections.newValues,
        reason: timeEntryCorrections.reason,
      })
      .from(timeEntryCorrections)
      .leftJoin(users, and(eq(users.orgId, timeEntryCorrections.orgId), eq(users.id, timeEntryCorrections.correctedBy)))
      .where(and(eq(timeEntryCorrections.orgId, orgId), eq(timeEntryCorrections.timeEntryId, id)))
      .orderBy(desc(timeEntryCorrections.correctedAt));

    const contractRows = await tx
      .select({
        id: contractsTable.id,
        contractType: contractsTable.contractType,
        solicitationTitle: solicitations.title,
      })
      .from(contractsTable)
      .leftJoin(
        solicitations,
        and(eq(solicitations.orgId, contractsTable.orgId), eq(solicitations.id, contractsTable.solicitationId)),
      )
      .where(eq(contractsTable.orgId, orgId));
    const contractOptions: ContractOption[] = contractRows.map((r) => ({
      id: r.id,
      label: r.solicitationTitle ? `${r.solicitationTitle} (${r.contractType})` : `${r.contractType} contract ${r.id.slice(0, 8)}`,
    }));

    const milestoneRows = await tx
      .select({
        id: contractMilestones.id,
        contractId: contractMilestones.contractId,
        sequence: contractMilestones.sequence,
        description: contractMilestones.description,
      })
      .from(contractMilestones)
      .where(eq(contractMilestones.orgId, orgId));
    const milestoneOptions: MilestoneOption[] = milestoneRows.map((m) => ({
      id: m.id,
      contractId: m.contractId,
      label: `#${m.sequence} — ${m.description}`,
    }));

    return { entry, corrections, contractOptions, milestoneOptions };
  });

  if (!data) notFound();
  const { entry, corrections, contractOptions, milestoneOptions } = data;

  if (entry.periodStatus === "OPEN") {
    return (
      <main>
        <PageHeader title="Correct time entry" />
        <Card>
          <p data-testid="not-correctable">
            This entry has not been submitted yet — go back and edit or delete it directly.
          </p>
          <Link href="/admin/time">← Back to my timesheet</Link>
        </Card>
      </main>
    );
  }

  return (
    <main>
      <PageHeader title="Correct time entry" back={<Link href="/admin/time">← My timesheet</Link>} />

      <Section title="Current (submitted) values">
        <Card size="sm">
          <p>
            {entry.workDate} · {Number(entry.hours).toFixed(2)}h · {entry.chargeClass}
          </p>
          <p className={c.scope}>{entry.description}</p>
        </Card>
      </Section>

      {corrections.length > 0 ? (
        <Section title="Correction history" count={corrections.length}>
          <ul className={c.list}>
            {corrections.map((corr) => (
              <Card as="li" key={corr.id} size="sm">
                <p>
                  <em>{corr.reason}</em>
                </p>
                <p className={c.meta}>old: {renderSnapshot(corr.oldValues)}</p>
                <p className={c.meta}>new: {renderSnapshot(corr.newValues)}</p>
                <p className={c.meta}>
                  by {corr.correctedByEmail ?? "unknown"} on {corr.correctedAt.toISOString().slice(0, 10)}
                </p>
              </Card>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Record a correction">
        <Card>
          <CorrectionForm
            entryId={entry.id}
            contracts={contractOptions}
            milestones={milestoneOptions}
            current={{
              hours: entry.hours,
              chargeClass: entry.chargeClass,
              contractId: entry.contractId,
              milestoneId: entry.milestoneId,
              description: entry.description,
            }}
          />
        </Card>
      </Section>
    </main>
  );
}
