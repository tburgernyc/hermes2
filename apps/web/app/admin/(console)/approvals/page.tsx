/**
 * /admin/approvals — the human-in-the-loop console. Lists the items the autonomous pipeline has parked
 * for a human: triaged solicitations awaiting a sourcing decision, and drafted outreach awaiting approval.
 * Every button routes to a Server Action that is the ONLY emitter of a human-gate event (CLAUDE.md §2).
 * Middleware already gates /admin; requireAdmin is defense in depth.
 */
import type { JSX } from "react";

import { and, desc, eq, outreachCampaigns, solicitations, withOrg } from "@hermes/db";

import { Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
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
      <PageHeader
        title="Approvals"
        lede={`Nothing is sent or advanced without your explicit approval. Signed in as ${session.user.email}.`}
      />

      <Section title="Solicitations awaiting a sourcing decision" count={triaged.length}>
        {triaged.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {triaged.map((s) => (
              <Card as="li" key={s.id} size="sm">
                <div className={c.rowBetween}>
                  <div>
                    <strong>{s.title}</strong>
                    <div className={c.meta}>
                      {s.agency ?? "Agency unknown"} · feasibility {s.feasibilityScore ?? "?"} · fit{" "}
                      {s.zeroFloatFit ?? "?"}
                    </div>
                  </div>
                  <form action={approveSourcing}>
                    <input type="hidden" name="solicitationId" value={s.id} />
                    <Button type="submit" size="sm">
                      Approve sourcing
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Outreach awaiting approval" count={pendingOutreach.length}>
        {pendingOutreach.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {pendingOutreach.map((o) => (
              <Card as="li" key={o.id} size="sm">
                <div className={c.rowBetween}>
                  <strong>{o.subject}</strong>
                  <div className={c.row}>
                    <form action={approveOutreach}>
                      <input type="hidden" name="outreachId" value={o.id} />
                      <Button type="submit" size="sm">
                        Approve &amp; send
                      </Button>
                    </form>
                    <form action={rejectOutreach}>
                      <input type="hidden" name="outreachId" value={o.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Reject
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
