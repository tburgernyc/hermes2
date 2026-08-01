/**
 * /admin/settings — organization identity + compliance-directives configuration. Previously the ONLY way
 * to change `orgs.directives` (the counsel-confirmation gates, indirect rates, registration status) was a
 * raw SQL UPDATE against the seeded row — there was no UI path at all. This page + its Server Action close
 * that gap. Read-only until submitted; requireAdmin guards the page itself (not just the action), matching
 * every other /admin page in this console.
 */
import type { JSX } from "react";

import { eq, orgs, parseDirectives, withOrg } from "@hermes/db";

import { PageHeader } from "@/components/ui/console";
import { requireAdmin } from "@/lib/auth-guard";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const org = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        name: orgs.name,
        ein: orgs.ein,
        uei: orgs.uei,
        cageCode: orgs.cageCode,
        primaryDomain: orgs.primaryDomain,
        directives: orgs.directives,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    return rows[0];
  });

  if (!org) {
    return (
      <main>
        <PageHeader title="Settings" />
        <p>Organization record not found.</p>
      </main>
    );
  }

  const directives = parseDirectives(org.directives);

  return (
    <main>
      <PageHeader
        title="Organization & compliance settings"
        lede="Firm identity, registration status, and the counsel-confirmation gates that block a live bid submission."
      />
      <SettingsForm
        org={{
          name: org.name,
          ein: org.ein,
          uei: org.uei,
          cageCode: org.cageCode,
          primaryDomain: org.primaryDomain,
        }}
        directives={directives}
      />
    </main>
  );
}
