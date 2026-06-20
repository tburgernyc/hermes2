import type { JSX, ReactNode } from "react";

import { AppNav } from "@/components/ui/console";

import styles from "./console-shell.module.css";

const ADMIN_NAV = [
  { href: "/admin", label: "Home" },
  { href: "/admin/solicitations", label: "Solicitations" },
  { href: "/admin/prospects", label: "Prospects" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/inquiries", label: "Inquiries" },
] as const;

/**
 * Admin CONSOLE layout — studio background + the glass AppNav. Scoped to the (console) route group so it
 * wraps every operator page but NOT the /admin/totp auth pages (which sit outside the group and render
 * their own full-screen AuthScreen). Presentational only; middleware + each page's requireAdmin gate.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className={styles.shell}>
      <AppNav links={ADMIN_NAV} label="Admin" testId="admin-nav" homeHref="/admin" />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
