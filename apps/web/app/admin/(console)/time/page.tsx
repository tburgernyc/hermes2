/**
 * /admin/time — "My timesheet" (§3.5). Daily entry for the signed-in admin's OWN time, scoped to
 * yourself (this is not a manager entering time for someone else — see the PR body for why the schema
 * reads as admin-only, self-scoped). Shows the current week first (always offers the entry form, even
 * before any period row exists), then recent weeks with their status, entries, and any correction trail.
 * Submitting a week is a self-certification; approving it (a SEPARATE explicit click, by any admin) lives
 * at /admin/time/approvals. Middleware already gates /admin; requireAdmin is defense in depth.
 */
import Link from "next/link";
import type { JSX } from "react";

import { daysLate, todayIsoDate, weekPeriodBounds } from "@hermes/core";
import {
  and,
  contractMilestones,
  contracts as contractsTable,
  desc,
  eq,
  inArray,
  solicitations,
  timeEntries,
  timeEntryCorrections,
  timesheetPeriods,
  users,
  withOrg,
} from "@hermes/db";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireAdmin } from "@/lib/auth-guard";

import { deleteTimeEntry, submitPeriod } from "./actions";
import { EntryForm, type ContractOption, type MilestoneOption } from "./entry-form";

export const dynamic = "force-dynamic";

const RECENT_PERIODS = 8;

const STATUS_MESSAGE: Record<string, string> = {
  created: "Time entry logged.",
  deleted: "Time entry deleted.",
  submitted: "Timesheet period submitted for approval.",
  corrected: "Correction recorded — the original values are preserved in the audit trail.",
  "period-closed": "That week is already submitted — new entries are closed. Use a correction instead.",
  invalid: "Some fields were missing or invalid. Please review and try again.",
  "not-found": "That item could not be found (or is not yours to change).",
  "not-correctable": "That entry hasn't been submitted yet — edit or delete it directly instead.",
  empty: "A period needs at least one entry before it can be submitted.",
  error: "Something went wrong saving that. Please try again.",
};

function formatHours(value: string): string {
  return Number(value).toFixed(2);
}

interface PeriodEntry {
  id: string;
  periodId: string | null;
  workDate: string;
  hours: string;
  chargeClass: "DIRECT" | "INDIRECT";
  contractId: string | null;
  milestoneId: string | null;
  description: string;
  createdAt: Date;
}

interface Correction {
  id: string;
  timeEntryId: string;
  correctedBy: string;
  correctedByEmail: string | null;
  correctedAt: Date;
  oldValues: unknown;
  newValues: unknown;
  reason: string;
}

function renderSnapshot(v: unknown): string {
  if (typeof v !== "object" || v === null) return String(v);
  const obj = v as Record<string, unknown>;
  return ["hours", "chargeClass", "contractId", "milestoneId", "description"]
    .filter((k) => k in obj)
    .map((k) => `${k}: ${JSON.stringify(obj[k])}`)
    .join(", ");
}

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}): Promise<JSX.Element> {
  const { status } = await searchParams;
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const today = todayIsoDate();
  const currentWeek = weekPeriodBounds(today);

  const { periods, entriesByPeriod, correctionsByEntry, contractOptions, milestoneOptions } = await withOrg(
    orgId,
    async (tx) => {
      const periods = await tx
        .select({
          id: timesheetPeriods.id,
          periodStart: timesheetPeriods.periodStart,
          periodEnd: timesheetPeriods.periodEnd,
          status: timesheetPeriods.status,
          submittedAt: timesheetPeriods.submittedAt,
          approvedAt: timesheetPeriods.approvedAt,
        })
        .from(timesheetPeriods)
        .where(and(eq(timesheetPeriods.orgId, orgId), eq(timesheetPeriods.userId, userId)))
        .orderBy(desc(timesheetPeriods.periodStart))
        .limit(RECENT_PERIODS);

      const periodIds = periods.map((p) => p.id);
      const entries: PeriodEntry[] =
        periodIds.length === 0
          ? []
          : await tx
              .select({
                id: timeEntries.id,
                periodId: timeEntries.periodId,
                workDate: timeEntries.workDate,
                hours: timeEntries.hours,
                chargeClass: timeEntries.chargeClass,
                contractId: timeEntries.contractId,
                milestoneId: timeEntries.milestoneId,
                description: timeEntries.description,
                createdAt: timeEntries.createdAt,
              })
              .from(timeEntries)
              .where(and(eq(timeEntries.orgId, orgId), inArray(timeEntries.periodId, periodIds)))
              .orderBy(desc(timeEntries.workDate));

      const entriesByPeriod = new Map<string, PeriodEntry[]>();
      for (const e of entries) {
        const key = e.periodId ?? "";
        const list = entriesByPeriod.get(key) ?? [];
        list.push(e);
        entriesByPeriod.set(key, list);
      }

      const entryIds = entries.map((e) => e.id);
      const correctionRows =
        entryIds.length === 0
          ? []
          : await tx
              .select({
                id: timeEntryCorrections.id,
                timeEntryId: timeEntryCorrections.timeEntryId,
                correctedBy: timeEntryCorrections.correctedBy,
                correctedByEmail: users.email,
                correctedAt: timeEntryCorrections.correctedAt,
                oldValues: timeEntryCorrections.oldValues,
                newValues: timeEntryCorrections.newValues,
                reason: timeEntryCorrections.reason,
              })
              .from(timeEntryCorrections)
              .leftJoin(
                users,
                and(eq(users.orgId, timeEntryCorrections.orgId), eq(users.id, timeEntryCorrections.correctedBy)),
              )
              .where(and(eq(timeEntryCorrections.orgId, orgId), inArray(timeEntryCorrections.timeEntryId, entryIds)))
              .orderBy(desc(timeEntryCorrections.correctedAt));

      const correctionsByEntry = new Map<string, Correction[]>();
      for (const row of correctionRows as Correction[]) {
        const list = correctionsByEntry.get(row.timeEntryId) ?? [];
        list.push(row);
        correctionsByEntry.set(row.timeEntryId, list);
      }

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
        .where(eq(contractsTable.orgId, orgId))
        .orderBy(desc(contractsTable.createdAt));
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

      return { periods, entriesByPeriod, correctionsByEntry, contractOptions, milestoneOptions };
    },
  );

  const hasCurrentWeek = periods.some((p) => p.periodStart === currentWeek.periodStart);

  return (
    <main>
      <PageHeader
        title="My timesheet"
        lede="Daily entry, charged to a contract/milestone or logged indirect. Every edit to a submitted entry is a recorded correction, never a silent overwrite."
      />
      {status && STATUS_MESSAGE[status] ? (
        <Alert variant={["created", "deleted", "submitted", "corrected"].includes(status) ? "success" : "error"} role="status" testId="time-status">
          {STATUS_MESSAGE[status]}
        </Alert>
      ) : null}

      <Section title="Log time">
        <Card>
          <EntryForm contracts={contractOptions} milestones={milestoneOptions} today={today} />
        </Card>
      </Section>

      {!hasCurrentWeek ? (
        <Section title={`This week (${currentWeek.periodStart} – ${currentWeek.periodEnd})`}>
          <p className={c.empty}>No entries yet this week — log your first one above.</p>
        </Section>
      ) : null}

      <Section title="Recent periods" count={periods.length}>
        {periods.length === 0 ? (
          <p className={c.empty}>No timesheet periods yet.</p>
        ) : (
          <ul className={c.list}>
            {periods.map((p) => {
              const entries = entriesByPeriod.get(p.id) ?? [];
              const directHours = entries
                .filter((e) => e.chargeClass === "DIRECT")
                .reduce((sum, e) => sum + Number(e.hours), 0);
              const indirectHours = entries
                .filter((e) => e.chargeClass === "INDIRECT")
                .reduce((sum, e) => sum + Number(e.hours), 0);
              const tone = p.status === "APPROVED" ? "success" : p.status === "SUBMITTED" ? "warn" : "neutral";
              return (
                <Card as="li" key={p.id} size="sm" testId={`period-${p.id}`}>
                  <div className={c.rowBetween}>
                    <div>
                      <strong>
                        {p.periodStart} – {p.periodEnd}
                      </strong>
                      <div className={c.meta}>
                        <Badge tone={tone}>{p.status}</Badge> · {directHours.toFixed(2)}h direct ·{" "}
                        {indirectHours.toFixed(2)}h indirect
                        {p.submittedAt ? ` · submitted ${p.submittedAt.toISOString().slice(0, 10)}` : ""}
                        {p.approvedAt ? ` · approved ${p.approvedAt.toISOString().slice(0, 10)}` : ""}
                      </div>
                    </div>
                    {p.status === "OPEN" && entries.length > 0 ? (
                      <form action={submitPeriod}>
                        <input type="hidden" name="periodId" value={p.id} />
                        <Button type="submit" size="sm">
                          Submit period
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  {entries.length === 0 ? (
                    <p className={c.empty}>No entries.</p>
                  ) : (
                    <div className={c.tableWrap}>
                      <table className={c.table} data-testid={`entries-table-${p.id}`}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Hours</th>
                            <th>Class</th>
                            <th>Description</th>
                            <th>Logged</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((e) => {
                            const late = daysLate(e.workDate, e.createdAt.toISOString().slice(0, 10));
                            const corrections = correctionsByEntry.get(e.id) ?? [];
                            return (
                              <tr key={e.id} data-testid={`entry-${e.id}`}>
                                <td>{e.workDate}</td>
                                <td>{formatHours(e.hours)}</td>
                                <td>{e.chargeClass}</td>
                                <td>
                                  {e.description}
                                  {corrections.length > 0 ? (
                                    <details>
                                      <summary data-testid={`corrections-${e.id}`}>
                                        {corrections.length} correction{corrections.length > 1 ? "s" : ""}
                                      </summary>
                                      <ul>
                                        {corrections.map((corr) => (
                                          <li key={corr.id}>
                                            <em>{corr.reason}</em> — old: {renderSnapshot(corr.oldValues)}; new:{" "}
                                            {renderSnapshot(corr.newValues)} (by {corr.correctedByEmail ?? "unknown"} on{" "}
                                            {corr.correctedAt.toISOString().slice(0, 10)})
                                          </li>
                                        ))}
                                      </ul>
                                    </details>
                                  ) : null}
                                </td>
                                <td>{late > 0 ? `${late}d late` : "same day"}</td>
                                <td>
                                  {p.status === "OPEN" ? (
                                    <form action={deleteTimeEntry}>
                                      <input type="hidden" name="entryId" value={e.id} />
                                      <Button type="submit" size="sm" variant="ghost">
                                        Delete
                                      </Button>
                                    </form>
                                  ) : (
                                    <Link href={`/admin/time/entries/${e.id}/correct`}>Correct</Link>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })}
          </ul>
        )}
      </Section>

      <p className={c.meta}>
        <Link href="/admin/time/approvals">Approve submitted periods →</Link>
      </p>
    </main>
  );
}
