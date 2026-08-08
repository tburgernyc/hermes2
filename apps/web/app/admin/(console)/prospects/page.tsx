/**
 * /admin/prospects — the subcontractor prospect list, with a manual-add form and the qualify decision.
 * "Approve outreach" (per drafted campaign) lives on /admin/approvals; this page deep-links to it and
 * shows the pending count. Rendering advances nothing (CLAUDE.md §2). requireAdmin guards the page.
 */
import Link from "next/link";
import type { JSX } from "react";

import { and, count, desc, eq, outreachCampaigns, vendorProspects, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  humanizeStatus,
  isDeclinableProspectStatus,
  isQualifiableProspectStatus,
  isRespondableProspectStatus,
} from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";

import {
  addProspect,
  markProspectDeclined,
  markProspectQualified,
  markProspectResponded,
  recordOutreachBounced,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ProspectsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const { prospects, pendingOutreach, sentOutreach } = await withOrg(orgId, async (tx) => {
    const prospects = await tx
      .select({
        id: vendorProspects.id,
        companyName: vendorProspects.companyName,
        contactEmail: vendorProspects.contactEmail,
        status: vendorProspects.status,
        discoveryScore: vendorProspects.discoveryScore,
        prospectSource: vendorProspects.prospectSource,
      })
      .from(vendorProspects)
      .where(eq(vendorProspects.orgId, orgId))
      .orderBy(desc(vendorProspects.createdAt))
      .limit(200);

    const [pendingOutreach] = await tx
      .select({ n: count() })
      .from(outreachCampaigns)
      .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.status, "PENDING_APPROVAL")));

    // §3.2 baseline audit: outreach_status BOUNCED had no writer. Surface SENT campaigns here so the
    // operator — who sees the bounce as a delivery-failure notice in their OWN inbox — can record it.
    const sentOutreach = await tx
      .select({
        id: outreachCampaigns.id,
        subject: outreachCampaigns.subject,
        sentAt: outreachCampaigns.sentAt,
        prospectCompanyName: vendorProspects.companyName,
        prospectContactEmail: vendorProspects.contactEmail,
      })
      .from(outreachCampaigns)
      .innerJoin(
        vendorProspects,
        and(eq(vendorProspects.orgId, outreachCampaigns.orgId), eq(vendorProspects.id, outreachCampaigns.prospectId)),
      )
      .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.status, "SENT")))
      .orderBy(desc(outreachCampaigns.sentAt))
      .limit(50);

    return { prospects, pendingOutreach: pendingOutreach?.n ?? 0, sentOutreach };
  });

  return (
    <main>
      <PageHeader
        title="Prospects"
        lede={
          <>
            Outreach awaiting approval: {pendingOutreach} —{" "}
            <Link href="/admin/approvals" className={c.crumb}>
              review approvals
            </Link>
            .
          </>
        }
      />

      <Section title="Add a prospect">
        <Card>
          <form action={addProspect}>
            <Field label="Company" name="companyName" required maxLength={200} />
            <Field label="Email" name="contactEmail" type="email" />
            <Field label="NAICS" name="naicsCodes" placeholder="541511, 541512" />
            <Field label="Capabilities" name="capabilitiesText" />
            <Button type="submit">Add prospect</Button>
          </form>
        </Card>
      </Section>

      <Section title="Sent outreach — record delivery issues" count={sentOutreach.length}>
        <p className={c.meta}>
          You will see a bounce as a delivery-failure notice in your own inbox — record it here so the
          campaign&apos;s status reflects it. This never sends anything; automated bounce ingestion (a
          Resend webhook) is future work.
        </p>
        {sentOutreach.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {sentOutreach.map((o) => (
              <Card as="li" key={o.id} size="sm" testId={`sent-outreach-${o.id}`}>
                <div className={c.rowBetween}>
                  <div>
                    <strong>{o.subject}</strong>
                    <div className={c.meta}>
                      To: {o.prospectCompanyName}
                      {o.prospectContactEmail ? ` <${o.prospectContactEmail}>` : ""}
                      {o.sentAt ? ` · sent ${o.sentAt.toISOString()}` : ""}
                    </div>
                  </div>
                  <form action={recordOutreachBounced}>
                    <input type="hidden" name="outreachId" value={o.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Record bounce
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="All prospects" count={prospects.length}>
        {prospects.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {prospects.map((p) => (
              <Card as="li" key={p.id} size="sm" testId={`prospect-${p.id}`}>
                <div className={c.rowBetween}>
                  <div>
                    <strong>{p.companyName}</strong>
                    {p.contactEmail ? ` · ${p.contactEmail}` : ""}
                    <div className={c.row}>
                      <Badge>{humanizeStatus(p.status)}</Badge>
                      <Badge tone="neutral">{humanizeStatus(p.prospectSource)}</Badge>
                    </div>
                  </div>
                  <div className={c.row}>
                    {isRespondableProspectStatus(p.status) && (
                      <form action={markProspectResponded}>
                        <input type="hidden" name="prospectId" value={p.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Log response
                        </Button>
                      </form>
                    )}
                    {isQualifiableProspectStatus(p.status) && (
                      <form action={markProspectQualified}>
                        <input type="hidden" name="prospectId" value={p.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          Mark qualified
                        </Button>
                      </form>
                    )}
                    {isDeclinableProspectStatus(p.status) && (
                      <form action={markProspectDeclined}>
                        <input type="hidden" name="prospectId" value={p.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Decline
                        </Button>
                      </form>
                    )}
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
