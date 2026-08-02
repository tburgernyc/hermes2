import type { JSX, ReactNode } from "react";

import { AppNav } from "@/components/ui/console";
import { auth } from "@/auth";
import { domainForPath, isAdminDomainAllowed } from "@/lib/admin-domains";

import styles from "./console-shell.module.css";

const ADMIN_NAV = [
  { href: "/admin", label: "Home" },
  { href: "/admin/solicitations", label: "Solicitations" },
  { href: "/admin/prospects", label: "Prospects" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/users", label: "Users" },
] as const;

/**
 * Admin CONSOLE layout — studio background + the glass AppNav. Scoped to the (console) route group so it
 * wraps every operator page but NOT the /admin/totp auth pages (which sit outside the group and render
 * their own full-screen AuthScreen). Middleware + each page's own requireAdmin/requireAdminDomain call are
 * the ENFORCEMENT (CLAUDE.md §7); the nav filtering below is a UX courtesy only — a CAPTURE/FINANCE admin
 * who navigates straight to a hidden link is still redirected by middleware and refused by the page/action
 * guard, never let through because a link happened to be visible.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }): Promise<JSX.Element> {
  const session = await auth();
  const adminRole = session?.user?.adminRole ?? null;
  const links = ADMIN_NAV.filter((l) => isAdminDomainAllowed(adminRole, domainForPath(l.href)));

  return (
    <div className={styles.shell}>
      <AppNav links={links} label="Admin" testId="admin-nav" homeHref="/admin" />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
