/**
 * /admin/audit — read-only viewer over the append-only `audit_log` (CLAUDE.md §7: a row is written on
 * every autonomous action and every human approval). Until this page existed, the only way to see the
 * audit trail was a raw SQL SELECT — the table was written constantly but never surfaced. Read-only:
 * renders nothing that can mutate state, sends nothing, advances no workflow (CLAUDE.md §2 untouched).
 * Untrusted values (actor_email snapshot, action/entity strings, before/after JSON) are rendered as DATA
 * via JSX autoescape, never as markup.
 */
import type { JSX } from "react";

import { auditLog, desc, eq, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const ACTOR_TONE = {
  SYSTEM: "info",
  ADMIN: "success",
  VENDOR: "neutral",
  TOKEN: "warn",
} as const;

function compactJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function AuditPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const rows = await withOrg(orgId, (tx) =>
    tx
      .select({
        id: auditLog.id,
        actorType: auditLog.actorType,
        actorEmail: auditLog.actorEmail,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        before: auditLog.before,
        after: auditLog.after,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.orgId, orgId))
      .orderBy(desc(auditLog.createdAt))
      .limit(300),
  );

  return (
    <main>
      <PageHeader
        title="Audit log"
        lede={`${rows.length} most recent event${rows.length === 1 ? "" : "s"} — append-only, never edited or deleted.`}
      />

      {rows.length === 0 ? (
        <p className={c.empty}>No audit events yet.</p>
      ) : (
        <ul className={c.list} data-testid="audit-list">
          {rows.map((r) => {
            const before = compactJson(r.before);
            const after = compactJson(r.after);
            return (
              <Card as="li" key={r.id} testId={`audit-${r.id}`}>
                <div className={c.rowBetween}>
                  <div>
                    <strong>{r.action}</strong>
                    {r.entityType ? (
                      <>
                        {" "}
                        · {r.entityType}
                        {r.entityId ? ` #${r.entityId.slice(0, 8)}` : ""}
                      </>
                    ) : null}
                  </div>
                  <div className={c.row}>
                    <Badge tone={ACTOR_TONE[r.actorType]}>{r.actorType}</Badge>
                    {r.actorEmail ? <span className={c.meta}>{r.actorEmail}</span> : null}
                    <span className={c.meta}>{r.createdAt.toISOString().replace("T", " ").slice(0, 19)}</span>
                  </div>
                </div>
                {before || after ? (
                  <details>
                    <summary>Details</summary>
                    {before ? (
                      <>
                        <p className={c.meta}>Before</p>
                        <pre>{before}</pre>
                      </>
                    ) : null}
                    {after ? (
                      <>
                        <p className={c.meta}>After</p>
                        <pre>{after}</pre>
                      </>
                    ) : null}
                  </details>
                ) : null}
              </Card>
            );
          })}
        </ul>
      )}
    </main>
  );
}
