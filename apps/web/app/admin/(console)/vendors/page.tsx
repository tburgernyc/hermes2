/**
 * /admin/vendors — the vendor-vetting surface. Lets an admin promote a qualified prospect to a vendor,
 * vet a vendor, and bind a VENDOR-role user to a vetted vendor. Establishing the user↔vendor link is an
 * admin-only action (CLAUDE.md §7) — never self-asserted. Middleware gates /admin; requireAdmin is
 * defense in depth.
 */
import type { JSX } from "react";

import { and, desc, eq, isNull, users, vendorProspects, vendors, withOrg } from "@hermes/db";

import { Card, PageHeader, Section, Select } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth-guard";

import { linkVendorUser, promoteProspectToVendor, vetVendor } from "./actions";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export default async function VendorsPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const { qualifiedProspects, pendingVendors, vettedVendors, unlinkedUsers } = await withOrg(
    orgId,
    async (tx) => {
      const qualifiedProspects = await tx
        .select({ id: vendorProspects.id, companyName: vendorProspects.companyName })
        .from(vendorProspects)
        .where(and(eq(vendorProspects.orgId, orgId), eq(vendorProspects.status, "QUALIFIED")))
        .limit(50);

      const pendingVendors = await tx
        .select({ id: vendors.id, companyName: vendors.companyName })
        .from(vendors)
        .where(and(eq(vendors.orgId, orgId), eq(vendors.status, "PENDING_REVIEW")))
        .limit(50);

      const vettedVendors = await tx
        .select({ id: vendors.id, companyName: vendors.companyName })
        .from(vendors)
        .where(and(eq(vendors.orgId, orgId), eq(vendors.status, "VETTED")))
        .orderBy(desc(vendors.vettedAt))
        .limit(50);

      const unlinkedUsers = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.role, "VENDOR"), isNull(users.vendorId)))
        .limit(50);

      return { qualifiedProspects, pendingVendors, vettedVendors, unlinkedUsers };
    },
  );

  return (
    <main>
      <PageHeader
        title="Vendors"
        lede={`Promote, vet, and link vendor accounts. Signed in as ${session.user.email}.`}
      />

      <Section title="Qualified prospects" count={qualifiedProspects.length}>
        {qualifiedProspects.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {qualifiedProspects.map((p) => (
              <Card as="li" key={p.id} size="sm">
                <div className={c.rowBetween}>
                  <strong>{p.companyName}</strong>
                  <form action={promoteProspectToVendor}>
                    <input type="hidden" name="prospectId" value={p.id} />
                    <Button type="submit" size="sm">
                      Promote to vendor
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Vendors awaiting vetting" count={pendingVendors.length}>
        {pendingVendors.length === 0 ? (
          <p className={c.empty}>None.</p>
        ) : (
          <ul className={c.list}>
            {pendingVendors.map((v) => (
              <Card as="li" key={v.id} size="sm">
                <div className={c.rowBetween}>
                  <strong>{v.companyName}</strong>
                  <form action={vetVendor}>
                    <input type="hidden" name="vendorId" value={v.id} />
                    <Button type="submit" size="sm">
                      Mark vetted
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Link a vendor user">
        {vettedVendors.length === 0 || unlinkedUsers.length === 0 ? (
          <p className={c.empty}>Need at least one vetted vendor and one unlinked vendor user.</p>
        ) : (
          <Card>
            <form action={linkVendorUser}>
              <Select label="User" name="userId" required defaultValue="">
                <option value="" disabled>
                  Select a user
                </option>
                {unlinkedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </Select>
              <Select label="Vendor" name="vendorId" required defaultValue="">
                <option value="" disabled>
                  Select a vendor
                </option>
                {vettedVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.companyName}
                  </option>
                ))}
              </Select>
              <Button type="submit">Link</Button>
            </form>
          </Card>
        )}
      </Section>

      <Section title="Invite a vendor user">
        {vettedVendors.length === 0 ? (
          <p className={c.empty}>Vet a vendor first, then you can invite a user to onboard onto it.</p>
        ) : (
          <Card>
            <p className={c.meta}>
              Generates a single-use onboarding link. Copy it and send it to the vendor yourself — the app
              never emails on its own.
            </p>
            <InviteForm vendors={vettedVendors} />
          </Card>
        )}
      </Section>
    </main>
  );
}
