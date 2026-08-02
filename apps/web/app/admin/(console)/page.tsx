/**
 * /admin — the operator home / morning brief. A read-only digest of everything that is waiting on a
 * human decision (the same shape the Inngest morning-brief email surfaces), with deep-links into the
 * action surfaces. Rendering this page never advances any state (CLAUDE.md §2). Middleware already
 * gates /admin; requireAdmin is defense in depth.
 */
import Link from "next/link";
import type { JSX } from "react";

import {
  aiUsageEvents,
  and,
  arFollowups,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  outreachCampaigns,
  solicitations,
  sql,
  withOrg,
} from "@hermes/db";
import { monitorPayablesAtRisk, monitorSamRegistration } from "@hermes/inngest";

import { Card, PageHeader, Section, Stat } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const DEADLINE_HORIZON_MS = 72 * 60 * 60 * 1000; // surface deadlines within 72h
const LIVE_STATUSES = [
  "TRIAGE_COMPLETE",
  "READY_FOR_SOURCING",
  "AWAITING_APPROVAL",
  "SOURCING_IN_PROGRESS",
  "PRICING_PENDING",
  "PROPOSAL_DRAFT",
] as const;

export default async function AdminHome(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const now = new Date();
  const horizon = new Date(now.getTime() + DEADLINE_HORIZON_MS);

  const brief = await withOrg(orgId, async (tx) => {
    const triaged = await tx
      .select({
        id: solicitations.id,
        title: solicitations.title,
        feasibilityScore: solicitations.feasibilityScore,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.status, "TRIAGE_COMPLETE")))
      .orderBy(desc(solicitations.feasibilityScore))
      .limit(5);

    const [pendingOutreach] = await tx
      .select({ n: count() })
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.status, "PENDING_APPROVAL")));

    const pricing = await tx
      .select({ id: solicitations.id, title: solicitations.title })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.status, "PRICING_PENDING")))
      .limit(5);

    const deadlines = await tx
      .select({
        id: solicitations.id,
        title: solicitations.title,
        deadline: solicitations.responseDeadline,
      })
      .from(solicitations)
      .where(
        and(
          eq(solicitations.orgId, orgId),
          inArray(solicitations.status, [...LIVE_STATUSES]),
          gte(solicitations.responseDeadline, now),
          lte(solicitations.responseDeadline, horizon),
        ),
      )
      .orderBy(solicitations.responseDeadline)
      .limit(10);

    const [arOverdue] = await tx
      .select({ n: count() })
      .from(arFollowups)
      .where(
        and(
          eq(arFollowups.orgId, orgId),
          eq(arFollowups.status, "SCHEDULED"),
          lte(arFollowups.dueDate, now),
        ),
      );

    // §3.3 — AI-spend rollup (last 7 days): a simple, honest cost signal, not an invoice reconciliation.
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [aiUsage] = await tx
      .select({
        totalCostUsd: sql<string | null>`sum(${aiUsageEvents.estimatedCostUsd})`,
        calls: count(),
      })
      .from(aiUsageEvents)
      .where(and(eq(aiUsageEvents.orgId, orgId), gte(aiUsageEvents.occurredAt, sevenDaysAgo)));

    // §3.3 — same-cron-pattern compliance reminders (SAM/reps-certs) + Prompt-Payment at-risk/missed flags.
    const complianceReminders = await monitorSamRegistration(tx, { orgId, now });
    const paymentsAtRisk = await monitorPayablesAtRisk(tx, { orgId, now });

    return {
      triaged,
      pendingOutreach: pendingOutreach?.n ?? 0,
      pricing,
      deadlines,
      arOverdue: arOverdue?.n ?? 0,
      aiSpend7dUsd: aiUsage?.totalCostUsd ? Number(aiUsage.totalCostUsd) : 0,
      aiCalls7d: aiUsage?.calls ?? 0,
      complianceReminders,
      paymentsAtRisk,
    };
  });

  return (
    <main>
      <PageHeader
        title="Admin Console"
        lede={`Morning brief for ${session.user.email}. Nothing here is sent or advanced without your explicit approval.`}
      />

      <div className={c.statGrid}>
        <Stat label="Awaiting sourcing decision" value={brief.triaged.length} />
        <Stat
          label="Outreach awaiting approval"
          value={brief.pendingOutreach}
          tone={brief.pendingOutreach > 0 ? "warn" : "neutral"}
        />
        <Stat label="In pricing / bid review" value={brief.pricing.length} />
        <Stat
          label="Deadlines within 72h"
          value={brief.deadlines.length}
          tone={brief.deadlines.length > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Overdue AR follow-ups"
          value={brief.arOverdue}
          tone={brief.arOverdue > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Payments at risk / missed"
          value={brief.paymentsAtRisk.length}
          tone={brief.paymentsAtRisk.length > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Compliance reminders"
          value={brief.complianceReminders.length}
          tone={brief.complianceReminders.length > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="AI spend (7d)"
          value={`$${brief.aiSpend7dUsd.toFixed(2)}`}
        />
      </div>

      <Section
        title="Solicitations awaiting a sourcing decision"
        count={brief.triaged.length}
        actions={
          <Link href="/admin/solicitations" className={c.crumb}>
            Open board →
          </Link>
        }
      >
        {brief.triaged.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {brief.triaged.map((s) => (
              <Card as="li" key={s.id} size="sm">
                <div className={c.rowBetween}>
                  <Link href={`/admin/solicitations/${s.id}`}>{s.title}</Link>
                  <span className={c.meta}>feasibility {s.feasibilityScore ?? "?"}</span>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Outreach awaiting approval"
        count={brief.pendingOutreach}
        actions={
          <Link href="/admin/approvals" className={c.crumb}>
            Review approvals →
          </Link>
        }
      >
        <p className={c.empty}>
          {brief.pendingOutreach === 0
            ? "Nothing pending."
            : `${brief.pendingOutreach} campaign(s) waiting on your decision.`}
        </p>
      </Section>

      <Section title="Solicitations in pricing / bid review" count={brief.pricing.length}>
        {brief.pricing.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {brief.pricing.map((s) => (
              <Card as="li" key={s.id} size="sm">
                <Link href={`/admin/solicitations/${s.id}`}>{s.title}</Link>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Response deadlines within 72h" count={brief.deadlines.length}>
        {brief.deadlines.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {brief.deadlines.map((s) => (
              <Card as="li" key={s.id} size="sm">
                <div className={c.rowBetween}>
                  <Link href={`/admin/solicitations/${s.id}`}>{s.title}</Link>
                  {s.deadline ? <span className={c.meta}>due {s.deadline.toISOString()}</span> : null}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Subcontractor payments at risk or missed"
        count={brief.paymentsAtRisk.length}
        actions={
          <Link href="/admin/financials" className={c.crumb}>
            Open financials →
          </Link>
        }
      >
        {brief.paymentsAtRisk.length === 0 ? (
          <p className={c.empty}>None — no Prompt-Payment deadline is currently at risk or missed.</p>
        ) : (
          <ul className={c.list}>
            {brief.paymentsAtRisk.map((item, i) => (
              <Card as="li" key={i} size="sm">
                <div className={c.rowBetween}>
                  <span>{item.label}</span>
                  {item.detail ? <span className={c.meta}>{item.detail}</span> : null}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Compliance reminders (SAM registration / reps &amp; certs)"
        count={brief.complianceReminders.length}
        actions={
          <Link href="/admin/settings" className={c.crumb}>
            Open settings →
          </Link>
        }
      >
        {brief.complianceReminders.length === 0 ? (
          <p className={c.empty}>None due within 60 days.</p>
        ) : (
          <ul className={c.list}>
            {brief.complianceReminders.map((item, i) => (
              <Card as="li" key={i} size="sm">
                <div className={c.rowBetween}>
                  <span>{item.label}</span>
                  {item.detail ? <span className={c.meta}>{item.detail}</span> : null}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="AI usage (last 7 days)">
        <Card size="sm">
          <p className={c.meta}>
            {brief.aiCalls7d} call(s), an estimated ${brief.aiSpend7dUsd.toFixed(2)} — a directional cost
            signal (not verified against the live Anthropic pricing page), so a runaway loop or a busy
            month never becomes an invisible surprise bill.
          </p>
        </Card>
      </Section>
    </main>
  );
}
