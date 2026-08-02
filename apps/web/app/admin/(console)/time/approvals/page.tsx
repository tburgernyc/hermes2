/**
 * /admin/time/approvals — the explicit admin approval action for a SUBMITTED timesheet period (§3.5
 * item 4), org-wide across every user (not just the signed-in admin's own periods — a supervisor
 * approves a subordinate's timesheet here; for a solo operator this is the same person taking a second,
 * separate action, which is still the human gate the rest of the system uses — CLAUDE.md §2). A period
 * is not final/billable until this click sets a recorded approver + timestamp (DB CHECK-enforced).
 */
import Link from "next/link";
import type { JSX } from "react";

import { and, desc, eq, timeEntries, timesheetPeriods, users, withOrg } from "@hermes/db";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireAdmin } from "@/lib/auth-guard";

import { approveTimesheetPeriod } from "../actions";

export const dynamic = "force-dynamic";

export default async function TimeApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}): Promise<JSX.Element> {
  const { status } = await searchParams;
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const pending = await withOrg(orgId, async (tx) => {
    const periods = await tx
      .select({
        id: timesheetPeriods.id,
        userEmail: users.email,
        periodStart: timesheetPeriods.periodStart,
        periodEnd: timesheetPeriods.periodEnd,
        submittedAt: timesheetPeriods.submittedAt,
      })
      .from(timesheetPeriods)
      .innerJoin(users, and(eq(users.orgId, timesheetPeriods.orgId), eq(users.id, timesheetPeriods.userId)))
      .where(and(eq(timesheetPeriods.orgId, orgId), eq(timesheetPeriods.status, "SUBMITTED")))
      .orderBy(desc(timesheetPeriods.submittedAt))
      .limit(50);

    const withTotals = [];
    for (const p of periods) {
      const entries = await tx
        .select({ hours: timeEntries.hours, chargeClass: timeEntries.chargeClass })
        .from(timeEntries)
        .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.periodId, p.id)));
      const directHours = entries
        .filter((e) => e.chargeClass === "DIRECT")
        .reduce((sum, e) => sum + Number(e.hours), 0);
      const indirectHours = entries
        .filter((e) => e.chargeClass === "INDIRECT")
        .reduce((sum, e) => sum + Number(e.hours), 0);
      withTotals.push({ ...p, directHours, indirectHours, entryCount: entries.length });
    }
    return withTotals;
  });

  return (
    <main>
      <PageHeader
        title="Timesheet approvals"
        lede="A submitted period is treated as final/billable only after this explicit approval."
        back={<Link href="/admin/time">← My timesheet</Link>}
      />
      {status === "approved" ? (
        <Alert variant="success" role="status" testId="approvals-status">
          Period approved.
        </Alert>
      ) : null}

      <Section title="Submitted periods awaiting approval" count={pending.length}>
        {pending.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {pending.map((p) => (
              <Card as="li" key={p.id} size="sm" testId={`pending-period-${p.id}`}>
                <div className={c.rowBetween}>
                  <div>
                    <strong>{p.userEmail}</strong>
                    <div className={c.meta}>
                      {p.periodStart} – {p.periodEnd} · {p.entryCount} entr{p.entryCount === 1 ? "y" : "ies"} ·{" "}
                      {p.directHours.toFixed(2)}h direct · {p.indirectHours.toFixed(2)}h indirect
                      {p.submittedAt ? ` · submitted ${p.submittedAt.toISOString().slice(0, 10)}` : ""}
                    </div>
                  </div>
                  <form action={approveTimesheetPeriod}>
                    <input type="hidden" name="periodId" value={p.id} />
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
