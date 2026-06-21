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
import { humanizeStatus, isQualifiableProspectStatus } from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";

import { addProspect, markProspectQualified } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProspectsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const { prospects, pendingOutreach } = await withOrg(orgId, async (tx) => {
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

    return { prospects, pendingOutreach: pendingOutreach?.n ?? 0 };
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
            <div className={c.formGrid}>
              <Field label="Company" name="companyName" required maxLength={200} />
              <Field label="Email" name="contactEmail" type="email" />
              <Field label="NAICS" name="naicsCodes" placeholder="541511, 541512" />
              <Field label="Capabilities" name="capabilitiesText" />
            </div>
            <Button type="submit">Add prospect</Button>
          </form>
        </Card>
      </Section>

      <Section title="All prospects" count={prospects.length}>
        {prospects.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {prospects.map((p) => (
              <Card as="li" key={p.id} size="sm" testId={`prospect-${p.id}`} className={c.hoverable}>
                <div className={c.rowBetween}>
                  <div>
                    <strong>{p.companyName}</strong>
                    {p.contactEmail ? (
                      <span className={c.metaMono}> · {p.contactEmail}</span>
                    ) : null}
                    <div className={c.row}>
                      <Badge>{humanizeStatus(p.status)}</Badge>
                      <Badge tone="neutral">{humanizeStatus(p.prospectSource)}</Badge>
                      <span className={c.metaMono}>score {p.discoveryScore ?? "?"}</span>
                    </div>
                  </div>
                  {isQualifiableProspectStatus(p.status) && (
                    <form action={markProspectQualified}>
                      <input type="hidden" name="prospectId" value={p.id} />
                      <Button type="submit" size="sm" variant="secondary">
                        Mark qualified
                      </Button>
                    </form>
                  )}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
