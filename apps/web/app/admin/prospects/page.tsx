/**
 * /admin/prospects — the subcontractor prospect list, with a manual-add form and the qualify decision.
 * "Approve outreach" (per drafted campaign) lives on /admin/approvals; this page deep-links to it and
 * shows the pending count. Rendering advances nothing (CLAUDE.md §2). requireAdmin guards the page.
 */
import Link from "next/link";
import type { JSX } from "react";

import { and, count, desc, eq, outreachCampaigns, vendorProspects, withOrg } from "@hermes/db";

import { requireAdmin } from "@/lib/auth-guard";
import { humanizeStatus, isQualifiableProspectStatus } from "@/lib/admin-board";

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
      <h1>Prospects</h1>
      <p>
        Outreach awaiting approval: {pendingOutreach} —{" "}
        <Link href="/admin/approvals">review approvals</Link>.
      </p>

      <section>
        <h2>Add a prospect</h2>
        <form action={addProspect}>
          <label>
            Company <input name="companyName" required maxLength={200} />
          </label>{" "}
          <label>
            Email <input name="contactEmail" type="email" />
          </label>{" "}
          <label>
            NAICS <input name="naicsCodes" placeholder="541511, 541512" />
          </label>{" "}
          <label>
            Capabilities <input name="capabilitiesText" />
          </label>{" "}
          <button type="submit">Add prospect</button>
        </form>
      </section>

      <section>
        <h2>All prospects ({prospects.length})</h2>
        {prospects.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {prospects.map((p) => (
              <li key={p.id} data-testid={`prospect-${p.id}`}>
                <strong>{p.companyName}</strong>
                {p.contactEmail ? ` · ${p.contactEmail}` : ""} · {humanizeStatus(p.status)} ·{" "}
                {humanizeStatus(p.prospectSource)}
                {isQualifiableProspectStatus(p.status) && (
                  <form action={markProspectQualified} style={{ display: "inline" }}>
                    <input type="hidden" name="prospectId" value={p.id} />
                    <button type="submit">Mark qualified</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
