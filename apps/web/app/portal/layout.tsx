import Link from "next/link";
import type { JSX, ReactNode } from "react";

/**
 * Vendor portal shell: a persistent nav across the subcontractor surfaces. Middleware gates /portal
 * (vendor role) and each page re-checks via requireVendor / requireVendorWithVendorId, so this layout
 * stays presentational and does NOT guard (mirrors the admin shell).
 */
const NAV: { href: string; label: string }[] = [
  { href: "/portal", label: "Home" },
  { href: "/portal/solicitations", label: "Open RFQs" },
  { href: "/portal/quotes", label: "My Quotes" },
  { href: "/portal/contracts", label: "My Subcontracts" },
  { href: "/portal/documents", label: "My Documents" },
];

export default function PortalLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div>
      <nav
        aria-label="Portal"
        data-testid="portal-nav"
        style={{
          display: "flex",
          gap: "1rem",
          padding: "0.5rem 0",
          borderBottom: "1px solid #ccc",
          marginBottom: "1rem",
        }}
      >
        {NAV.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
