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
  withOrg,
} from "@hermes/db";

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

    return {
      triaged,
      pendingOutreach: pendingOutreach?.n ?? 0,
      pricing,
      deadlines,
      arOverdue: arOverdue?.n ?? 0,
    };
  });

  return (
    <main>
      <h1>Admin Console</h1>
      <p>
        Morning brief for {session.user.email}. Nothing here is sent or advanced without your explicit
        approval.
      </p>

      <section>
        <h2>Solicitations awaiting a sourcing decision ({brief.triaged.length})</h2>
        {brief.triaged.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {brief.triaged.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/solicitations/${s.id}`}>{s.title}</Link> (feasibility{" "}
                {s.feasibilityScore ?? "?"})
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/solicitations">Open solicitations board →</Link>
      </section>

      <section>
        <h2>Outreach awaiting approval ({brief.pendingOutreach})</h2>
        <Link href="/admin/approvals">Review approvals →</Link>
      </section>

      <section>
        <h2>Solicitations in pricing / bid review ({brief.pricing.length})</h2>
        {brief.pricing.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {brief.pricing.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/solicitations/${s.id}`}>{s.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Response deadlines within 72h ({brief.deadlines.length})</h2>
        {brief.deadlines.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {brief.deadlines.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/solicitations/${s.id}`}>{s.title}</Link>
                {s.deadline ? ` — due ${s.deadline.toISOString()}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Overdue AR follow-ups ({brief.arOverdue})</h2>
      </section>
    </main>
  );
}
