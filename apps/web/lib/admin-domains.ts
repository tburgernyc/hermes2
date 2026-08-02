/**
 * §3.6 granular admin roles — the route/domain map + the single allow/deny decision. Kept edge-safe (no
 * DB, no Node-only imports, no framework imports) so BOTH `middleware.ts` (edge runtime) and the
 * page/action guard primitives in `lib/auth-guard.ts` (Node runtime) import the exact same function —
 * there is exactly one place that decides "is this admin role allowed here," never two copies that can
 * drift. Enforcement is server-side at both layers (middleware redirect + the guard thrown in the
 * page/action itself); nav visibility (layout.tsx) reads the same table as a UX courtesy only, never as
 * the boundary (CLAUDE.md §7 — never a client-side-only hide of a nav link).
 */

/** Granular admin access level. Mirrors the DB `admin_role` enum (packages/db/src/schema/enums.ts) —
 *  every ADMIN-role user carries exactly one (CHECK-enforced), a VENDOR-role user never does. */
export type AdminRole = "FULL" | "CAPTURE" | "FINANCE";

/**
 * A route/action "domain." OPEN = every admin level, no restriction beyond plain admin + satisfied TOTP
 * (the dashboard, the audit log, the /admin/totp enrollment/step-up pages). SETTINGS/CAPTURE/FINANCE
 * deliberately share their literal string with the matching `AdminRole` so `isAdminDomainAllowed` needs
 * no separate lookup table — the domain name from `AdminRole` union it accepts either FULL, or its own name.
 */
export type AdminDomain = "OPEN" | "SETTINGS" | "CAPTURE" | "FINANCE";

/**
 * Every gated admin route, longest-prefix matched to its domain. New admin surfaces register here —
 * ONE line each — to get both the middleware redirect and (via `requireAdminDomain` in auth-guard.ts) the
 * page/action guard for free. An unlisted `/admin/**` path (the dashboard, `/admin/audit`,
 * `/admin/totp/**`) defaults to OPEN. §3.3/§3.5/§3.8's forthcoming contracts/invoices/timekeeping
 * surfaces are FINANCE-domain; add their prefixes here when those routes land (Wave-2c retrofit).
 */
const ADMIN_ROUTE_DOMAINS: readonly { prefix: string; domain: AdminDomain }[] = [
  { prefix: "/admin/settings", domain: "SETTINGS" },
  { prefix: "/admin/users", domain: "SETTINGS" },
  { prefix: "/admin/solicitations", domain: "CAPTURE" },
  { prefix: "/admin/vendors", domain: "CAPTURE" },
  { prefix: "/admin/prospects", domain: "CAPTURE" },
  { prefix: "/admin/approvals", domain: "CAPTURE" },
  { prefix: "/admin/inquiries", domain: "CAPTURE" },
];

/** Longest-prefix match (so a future more-specific entry nested under a broader one wins). */
export function domainForPath(pathname: string): AdminDomain {
  let best: { prefix: string; domain: AdminDomain } | undefined;
  for (const entry of ADMIN_ROUTE_DOMAINS) {
    const matches = pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`);
    if (matches && (!best || entry.prefix.length > best.prefix.length)) best = entry;
  }
  return best?.domain ?? "OPEN";
}

/**
 * The one true allow/deny decision. FULL always passes (current behavior, unchanged — every existing
 * admin route stays reachable to a FULL admin exactly as before this feature shipped). A CAPTURE/FINANCE
 * role passes only its own matching domain; OPEN passes for any admin level. A null/undefined adminRole
 * (e.g. a pre-§3.6 session JWT minted before this shipped, or any future ADMIN row somehow missing one)
 * fails CLOSED on every non-OPEN domain — never treated as an implicit FULL.
 */
export function isAdminDomainAllowed(
  adminRole: AdminRole | null | undefined,
  domain: AdminDomain,
): boolean {
  if (domain === "OPEN") return true;
  if (!adminRole) return false;
  if (adminRole === "FULL") return true;
  return adminRole === domain;
}
