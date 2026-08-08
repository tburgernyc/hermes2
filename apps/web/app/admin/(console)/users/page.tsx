/**
 * /admin/users — §3.6 admin-role assignment. FULL-only (requireFullAdmin): assigns each ADMIN-role user's
 * granular access level (FULL/CAPTURE/FINANCE). This is the ONLY UI path to change `users.admin_role` —
 * previously there was none at all (Phase A shipped only the schema + the backfill). Read-only until
 * submitted; middleware + requireFullAdmin both gate this page (CLAUDE.md §7 — never a client-side-only
 * hide of a nav link).
 */
import type { JSX } from "react";

import { asc, eq, users, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader, Section, Select } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { requireFullAdmin } from "@/lib/auth-guard";

import { updateAdminRole } from "./actions";

export const dynamic = "force-dynamic";

const ADMIN_ROLE_OPTIONS = ["FULL", "CAPTURE", "FINANCE"] as const;

const ROLE_TONE = { FULL: "success", CAPTURE: "info", FINANCE: "warn" } as const;

export default async function AdminUsersPage(): Promise<JSX.Element> {
  const session = await requireFullAdmin();
  const orgId = session.user.orgId;

  const admins = await withOrg(orgId, (tx) =>
    tx
      .select({ id: users.id, email: users.email, adminRole: users.adminRole, isActive: users.isActive })
      .from(users)
      .where(eq(users.orgId, orgId))
      .orderBy(asc(users.email)),
  );

  // Only ADMIN-role rows carry an admin_role (the DB CHECK forbids it on VENDOR rows) — filter here so a
  // vendor user is never listed as if it were assignable.
  const adminUsers = admins.filter((u) => u.adminRole !== null);

  return (
    <main>
      <PageHeader
        title="Admin users"
        lede="Assign each admin's access level. FULL = unrestricted (current behavior). CAPTURE = solicitations, proposals, and outreach — no compliance settings, no financial records. FINANCE = contracts, invoices, AR, and timekeeping — no sourcing, outreach, or proposal drafting. A role change takes effect the next time that admin logs in."
      />

      <Section title="Admins" count={adminUsers.length}>
        {adminUsers.length === 0 ? (
          <p className={c.empty}>No admin users found.</p>
        ) : (
          <ul className={c.list} data-testid="admin-users-list">
            {adminUsers.map((u) => (
              <Card as="li" key={u.id} testId={`admin-user-${u.id}`}>
                <div className={c.rowBetween}>
                  <div>
                    <strong>{u.email}</strong>
                    {u.id === session.user.id ? <span className={c.meta}> (you)</span> : null}
                    {!u.isActive ? <span className={c.meta}> · inactive</span> : null}
                  </div>
                  <Badge tone={u.adminRole ? ROLE_TONE[u.adminRole] : "neutral"}>{u.adminRole}</Badge>
                </div>
                <form action={updateAdminRole} className={c.row}>
                  <input type="hidden" name="userId" value={u.id} />
                  <Select label="Access level" name="adminRole" defaultValue={u.adminRole ?? "FULL"}>
                    {ADMIN_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
