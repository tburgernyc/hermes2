/**
 * /admin/approvals — the minimal human-in-the-loop console (the full admin dashboard is Phase 6). Lists
 * the items the autonomous pipeline has parked for a human: triaged solicitations awaiting a sourcing
 * decision, and drafted outreach awaiting approval. Every button here routes to a Server Action that is
 * the ONLY emitter of a human-gate event (CLAUDE.md §2). Middleware already gates /admin; requireAdmin is
 * defense in depth.
 */
import type { JSX } from "react";

import { and, desc, eq, outreachCampaigns, solicitations, withOrg } from "@hermes/db";

import { requireAdmin } from "@/lib/auth-guard";

import { approveOutreach, approveSourcing, rejectOutreach } from "./actions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const { triaged, pendingOutreach } = await withOrg(orgId, async (tx) => {
    const triaged = await tx
      .select({
        id: solicitations.id,
        title: solicitations.title,
        agency: solicitations.agency,
        feasibilityScore: solicitations.feasibilityScore,
        zeroFloatFit: solicitations.zeroFloatFit,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.status, "TRIAGE_COMPLETE")))
      .orderBy(desc(solicitations.feasibilityScore))
      .limit(50);

    const pendingOutreach = await tx
      .select({
        id: outreachCampaigns.id,
        subject: outreachCampaigns.subject,
        prospectId: outreachCampaigns.prospectId,
      })
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.status, "PENDING_APPROVAL")))
      .limit(50);

    return { triaged, pendingOutreach };
  });

  return (
    <main>
      <h1>Approvals</h1>
      <p>
        Nothing is sent or advanced without your explicit approval. Signed in as {session.user.email}.
      </p>

      <section>
        <h2>Solicitations awaiting a sourcing decision ({triaged.length})</h2>
        {triaged.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {triaged.map((s) => (
              <li key={s.id}>
                <strong>{s.title}</strong>
                {s.agency ? ` — ${s.agency}` : ""} (feasibility {s.feasibilityScore ?? "?"}, fit{" "}
                {s.zeroFloatFit ?? "?"})
                <form action={approveSourcing} style={{ display: "inline" }}>
                  <input type="hidden" name="solicitationId" value={s.id} />
                  <button type="submit">Approve sourcing</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Outreach awaiting approval ({pendingOutreach.length})</h2>
        {pendingOutreach.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {pendingOutreach.map((o) => (
              <li key={o.id}>
                <strong>{o.subject}</strong>
                <form action={approveOutreach} style={{ display: "inline" }}>
                  <input type="hidden" name="outreachId" value={o.id} />
                  <button type="submit">Approve &amp; send</button>
                </form>
                <form action={rejectOutreach} style={{ display: "inline" }}>
                  <input type="hidden" name="outreachId" value={o.id} />
                  <button type="submit">Reject</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
