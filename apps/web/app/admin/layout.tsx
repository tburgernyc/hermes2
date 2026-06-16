import Link from "next/link";
import type { JSX, ReactNode } from "react";

/**
 * Admin console shell: a persistent nav across the operator surfaces. Middleware already gates /admin
 * (admin role + satisfied TOTP) and each page re-checks via requireAdmin, so this layout stays
 * presentational and does NOT guard — the /admin/totp enrollment + step-up pages must render under it
 * before the factor is satisfied.
 */
const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Home" },
  { href: "/admin/solicitations", label: "Solicitations" },
  { href: "/admin/prospects", label: "Prospects" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/vendors", label: "Vendors" },
];

export default function AdminLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div>
      <nav
        aria-label="Admin"
        data-testid="admin-nav"
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
