/**
 * /admin/vendors — the minimal vendor-vetting surface (the full queue UI is Phase 6). Lets an admin
 * promote a qualified prospect to a vendor, vet a vendor, and bind a VENDOR-role user to a vetted vendor.
 * Establishing the user↔vendor link is an admin-only action (CLAUDE.md §7) — never self-asserted.
 * Middleware already gates /admin; requireAdmin is defense in depth.
 */
import type { JSX } from "react";

import {
  and,
  desc,
  eq,
  isNull,
  users,
  vendorProspects,
  vendors,
  withOrg,
} from "@hermes/db";

import { requireAdmin } from "@/lib/auth-guard";

import { linkVendorUser, promoteProspectToVendor, vetVendor } from "./actions";

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
      <h1>Vendors</h1>
      <p>Promote, vet, and link vendor accounts. Signed in as {session.user.email}.</p>

      <section>
        <h2>Qualified prospects ({qualifiedProspects.length})</h2>
        {qualifiedProspects.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {qualifiedProspects.map((p) => (
              <li key={p.id}>
                <strong>{p.companyName}</strong>
                <form action={promoteProspectToVendor} style={{ display: "inline" }}>
                  <input type="hidden" name="prospectId" value={p.id} />
                  <button type="submit">Promote to vendor</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Vendors awaiting vetting ({pendingVendors.length})</h2>
        {pendingVendors.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul>
            {pendingVendors.map((v) => (
              <li key={v.id}>
                <strong>{v.companyName}</strong>
                <form action={vetVendor} style={{ display: "inline" }}>
                  <input type="hidden" name="vendorId" value={v.id} />
                  <button type="submit">Mark vetted</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Link a vendor user</h2>
        {vettedVendors.length === 0 || unlinkedUsers.length === 0 ? (
          <p>Need at least one vetted vendor and one unlinked vendor user.</p>
        ) : (
          <form action={linkVendorUser}>
            <label>
              User{" "}
              <select name="userId" required defaultValue="">
                <option value="" disabled>
                  Select a user
                </option>
                {unlinkedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Vendor{" "}
              <select name="vendorId" required defaultValue="">
                <option value="" disabled>
                  Select a vendor
                </option>
                {vettedVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.companyName}
                  </option>
                ))}
              </select>
            </label>{" "}
            <button type="submit">Link</button>
          </form>
        )}
      </section>
    </main>
  );
}
