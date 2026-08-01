/**
 * /admin/approvals — the human-in-the-loop console. Lists the items the autonomous pipeline has parked
 * for a human: triaged solicitations awaiting a sourcing decision, and drafted outreach awaiting approval.
 * Every button routes to a Server Action that is the ONLY emitter of a human-gate event (CLAUDE.md §2).
 * Middleware already gates /admin; requireAdmin is defense in depth.
 */
import type { JSX } from "react";

import { and, auditLog, desc, eq, outreachCampaigns, solicitations, vendorProspects, withOrg } from "@hermes/db";

import { Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth-guard";

import { approveLossNotification, approveOutreach, approveSourcing, rejectOutreach } from "./actions";

export const dynamic = "force-dynamic";

interface PendingLossNotification {
  quoteId: string;
  to: string;
  companyName: string;
  solicitationTitle: string;
}

export default async function ApprovalsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const { triaged, pendingOutreach, pendingLossNotifications } = await withOrg(orgId, async (tx) => {
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
        body: outreachCampaigns.body,
        prospectCompanyName: vendorProspects.companyName,
        prospectContactEmail: vendorProspects.contactEmail,
      })
      .from(outreachCampaigns)
      .innerJoin(
        vendorProspects,
        and(eq(vendorProspects.orgId, outreachCampaigns.orgId), eq(vendorProspects.id, outreachCampaigns.prospectId)),
      )
      .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.status, "PENDING_APPROVAL")))
      .limit(50);

    // §3.1 item 5: audit_log doubles as the lightweight loss-notification approval queue (no new table,
    // O4) — a candidate is "pending" iff it was QUEUED and has no matching SENT row for the same quote.
    const queuedRows = await tx
      .select({ entityId: auditLog.entityId, after: auditLog.after, createdAt: auditLog.createdAt })
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "LOSS_NOTIFICATION_QUEUED")))
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
    const sentRows = await tx
      .select({ entityId: auditLog.entityId })
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "LOSS_NOTIFICATION_SENT")));
    const sentIds = new Set(sentRows.map((r) => r.entityId));

    const seen = new Set<string>();
    const pendingLossNotifications: PendingLossNotification[] = [];
    for (const r of queuedRows) {
      if (!r.entityId || sentIds.has(r.entityId) || seen.has(r.entityId)) continue;
      seen.add(r.entityId);
      const payload = r.after as { to?: unknown; companyName?: unknown; solicitationTitle?: unknown } | null;
      const to = typeof payload?.to === "string" ? payload.to : null;
      if (!to) continue; // nothing queued with no resolvable contact email
      pendingLossNotifications.push({
        quoteId: r.entityId,
        to,
        companyName: typeof payload?.companyName === "string" ? payload.companyName : "Subcontractor",
        solicitationTitle:
          typeof payload?.solicitationTitle === "string" ? payload.solicitationTitle : "the solicitation",
      });
    }

    return { triaged, pendingOutreach, pendingLossNotifications };
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
                  <div>
                    <strong>{o.subject}</strong>
                    <div className={c.meta}>
                      To: {o.prospectCompanyName}
                      {o.prospectContactEmail ? ` <${o.prospectContactEmail}>` : " (no contact email on file)"}
                    </div>
                  </div>
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
                <p className={c.scope}>{o.body}</p>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Loss notifications awaiting approval" count={pendingLossNotifications.length}>
        {pendingLossNotifications.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {pendingLossNotifications.map((n) => (
              <Card as="li" key={n.quoteId} size="sm">
                <div className={c.rowBetween}>
                  <div>
                    <strong>{n.companyName}</strong>
                    <div className={c.meta}>
                      {n.to} · not selected for &quot;{n.solicitationTitle}&quot;
                    </div>
                  </div>
                  <form action={approveLossNotification}>
                    <input type="hidden" name="quoteId" value={n.quoteId} />
                    <Button type="submit" size="sm">
                      Approve &amp; send
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
