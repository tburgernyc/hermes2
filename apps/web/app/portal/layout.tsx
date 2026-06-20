import type { JSX, ReactNode } from "react";

import { AppNav } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";

const PORTAL_NAV = [
  { href: "/portal", label: "Home" },
  { href: "/portal/solicitations", label: "Open RFQs" },
  { href: "/portal/quotes", label: "My Quotes" },
  { href: "/portal/contracts", label: "My Subcontracts" },
  { href: "/portal/documents", label: "My Documents" },
] as const;

/**
 * Vendor portal shell: the glass AppNav across the subcontractor surfaces. Middleware gates /portal and
 * each page re-checks via requireVendor / requireVendorWithVendorId, so this layout is presentational.
 */
export default function PortalLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className={c.appShell}>
      <AppNav links={PORTAL_NAV} label="Portal" testId="portal-nav" homeHref="/portal" />
      <div className={c.appContent}>{children}</div>
    </div>
  );
}
