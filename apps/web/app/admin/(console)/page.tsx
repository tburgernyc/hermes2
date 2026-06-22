/**
 * /admin — the operator home / morning brief. A read-only digest of everything that is waiting on a
 * human decision (the same shape the Inngest morning-brief email surfaces), with deep-links into the
 * action surfaces. Rendering this page never advances any state (CLAUDE.md §2). Middleware already
 * gates /admin; requireAdmin is defense in depth.
 */
import Link from "next/link";
import type { JSX } from "react";

import {
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

import { Badge, Card, PageHeader, Section, Stat } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { recommendationLabel, recommendationTone } from "@/lib/admin-board";
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
        agency: solicitations.agency,
        zeroFloatFit: solicitations.zeroFloatFit,
        feasibilityScore: solicitations.feasibilityScore,
        recommendation: solicitations.triageRecommendation,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.status, "TRIAGE_COMPLETE")))
      .orderBy(desc(solicitations.feasibilityScore))
      .limit(5);

    // Read-only signal: live solicitations whose quotes carried injection attempts (flagged + ignored).
    const injection = await tx
      .select({ id: solicitations.id, title: solicitations.title })
      .from(solicitations)
      .where(
        and(
          eq(solicitations.orgId, orgId),
          inArray(solicitations.status, [...LIVE_STATUSES]),
          sql`jsonb_array_length(${solicitations.quoteInjectionAttempts}) > 0`,
        ),
      )
      .limit(10);

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

    return {
      triaged,
      pendingOutreach: pendingOutreach?.n ?? 0,
      pricing,
      deadlines,
      arOverdue: arOverdue?.n ?? 0,
      injection,
    };
  });

  return (
    <main>
      <PageHeader
        title="Admin Console"
        lede={`Morning brief for ${session.user.email}. Nothing here is sent or advanced without your explicit approval.`}
      />

      {brief.injection.length > 0 && (
        <Card className={c.blockerCard} testId="injection-alert">
          <strong>
            ⚠ {brief.injection.length} live solicitation(s) had quote(s) that attempted to influence the
            AI ranking — flagged and ignored. Review before relying on the rankings.
          </strong>
          <ul className={c.bulletList}>
            {brief.injection.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/solicitations/${s.id}`} className={c.linkish}>
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
              <Card as="li" key={s.id} size="sm" className={c.hoverable}>
                <div className={c.rowBetween}>
                  <div>
                    <div className={c.row}>
                      <Link href={`/admin/solicitations/${s.id}`} className={c.linkish}>
                        {s.title}
                      </Link>
                      {s.recommendation && (
                        <Badge tone={recommendationTone(s.recommendation)}>
                          {recommendationLabel(s.recommendation)}
                        </Badge>
                      )}
                    </div>
                    <div className={c.metaMono}>
                      {s.agency ?? "—"} · fit {s.zeroFloatFit ?? "?"}
                    </div>
                  </div>
                  <div className={c.row}>
                    <div
                      className={c.scoreBar}
                      title={`feasibility ${s.feasibilityScore ?? 0} / 10`}
                      aria-hidden="true"
                    >
                      <div className={c.scoreFill} data-score={s.feasibilityScore ?? 0} />
                    </div>
                    <span className={c.metaMono}>{s.feasibilityScore ?? "?"}</span>
                  </div>
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
    </main>
  );
}
