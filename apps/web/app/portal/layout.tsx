import type { JSX, ReactNode } from "react";

import { and, eq, vendors, withVendorRole } from "@hermes/db";

import { auth } from "@/auth";
import { ConsoleShell } from "@/components/ui/ConsoleShell";

export const runtime = "nodejs"; // resolves the vendor name via @hermes/db (pg) — Node-only

const PORTAL_NAV = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/solicitations", label: "Open RFQs" },
  { href: "/portal/quotes", label: "My Quotes" },
  { href: "/portal/contracts", label: "Subcontracts" },
  { href: "/portal/documents", label: "Documents" },
] as const;

/**
 * Vendor portal shell — the Slice-2 ConsoleShell (glass nav + ambient background + Command/Studio theme
 * toggle), parameterized for the subcontractor surface. Middleware gates /portal and each page re-checks
 * via requireVendor / requireVendorWithVendorId, so this layout is presentational. The role chip shows the
 * vendor ORG NAME, resolved HERE on the server under withVendorRole (per-vendor RLS) — never client-set
 * (§7); the email rides along only as the chip's title. An unlinked vendor (no vendorId) still gets the
 * shell with a neutral label.
 */
export default async function PortalLayout({ children }: { children: ReactNode }): Promise<JSX.Element> {
  const session = await auth();
  const email = session?.user?.email ?? undefined;
  const orgId = session?.user?.orgId;
  const vendorId = session?.user?.vendorId;

  let vendorName = email ?? "Subcontractor";
  if (orgId && vendorId) {
    try {
      const rows = await withVendorRole(orgId, vendorId, (tx) =>
        tx
          .select({ name: vendors.companyName })
          .from(vendors)
          .where(and(eq(vendors.orgId, orgId), eq(vendors.id, vendorId)))
          .limit(1),
      );
      vendorName = rows[0]?.name ?? email ?? "Subcontractor";
    } catch {
      // Fail soft: the chip name is presentational; never 500 the whole portal over it.
      vendorName = email ?? "Subcontractor";
    }
  }

  return (
    <ConsoleShell
      navLinks={PORTAL_NAV}
      navLabel="Portal"
      surfaceTag="Subcontractor"
      operatorName={vendorName}
      operatorTitle={email}
      homeHref="/portal"
      testId="portal-nav"
    >
      {children}
    </ConsoleShell>
  );
}
