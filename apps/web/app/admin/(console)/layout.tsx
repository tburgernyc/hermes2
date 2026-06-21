import type { JSX, ReactNode } from "react";

import { auth } from "@/auth";
import { ConsoleShell } from "@/components/ui/ConsoleShell";

const ADMIN_NAV = [
  { href: "/admin", label: "Console" },
  { href: "/admin/solicitations", label: "Solicitations" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/prospects", label: "Prospects" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/inquiries", label: "Inquiries" },
] as const;

/**
 * Admin CONSOLE layout — the glass nav pill + ambient studio/command background (ConsoleShell), scoped to
 * the (console) route group so it wraps every operator page but NOT the /admin/totp auth pages (which sit
 * outside the group and render their own full-screen AuthScreen). The chrome is presentational; middleware
 * + each page's requireAdmin enforce access. The operator identity in the nav is resolved from the session
 * HERE on the server — never client-supplied (§7).
 */
export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();
  const operatorName = session?.user?.email ?? "Operator";

  return (
    <ConsoleShell
      navLinks={ADMIN_NAV}
      navLabel="Admin"
      surfaceTag="Admin · HITL"
      operatorName={operatorName}
      homeHref="/admin"
      testId="admin-nav"
    >
      {children}
    </ConsoleShell>
  );
}
