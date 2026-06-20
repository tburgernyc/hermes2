/**
 * /admin/solicitations — the solicitations kanban. Lanes are the five operator phases (see admin-board).
 * A TRIAGE_COMPLETE card carries the two human sourcing decisions: approve sourcing (which emits the
 * human-gate event + arms the outreach workflow) or mark no-go. Rendering the board advances nothing
 * (CLAUDE.md §2). Middleware gates /admin; requireAdmin is defense in depth.
 */
import Link from "next/link";
import type { JSX } from "react";

import { desc, eq, solicitations, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { groupByColumn, humanizeStatus } from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";

// approveSourcing is the canonical human-gate emitter; it lives with the other gate actions.
import { approveSourcing } from "../approvals/actions";
import { markNoGo } from "./actions";

export const dynamic = "force-dynamic";

export default async function SolicitationsBoard(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const rows = await withOrg(orgId, async (tx) =>
    tx
      .select({
        id: solicitations.id,
        title: solicitations.title,
        agency: solicitations.agency,
        status: solicitations.status,
        feasibilityScore: solicitations.feasibilityScore,
        zeroFloatFit: solicitations.zeroFloatFit,
      })
      .from(solicitations)
      .where(eq(solicitations.orgId, orgId))
      .orderBy(desc(solicitations.createdAt))
      .limit(200),
  );

  const columns = groupByColumn(rows);

  return (
    <main>
      <PageHeader
        title="Solicitations"
        lede="Sourced from SAM.gov and triaged by the AI (a recommendation only — you decide)."
      />

      <div className={c.kanban}>
        {columns.map((col) => (
          <section key={col.title} data-testid={`column-${col.title}`} className={c.column}>
            <h2 className={c.columnHead}>
              {col.title} <span className={c.columnCount}>({col.items.length})</span>
            </h2>
            {col.items.length === 0 ? (
              <p className={c.empty}>—</p>
            ) : (
              <div className={c.columnCards}>
                {col.items.map((s) => (
                  <Card as="article" key={s.id} size="sm">
                    <Link href={`/admin/solicitations/${s.id}`}>
                      <strong>{s.title}</strong>
                    </Link>
                    <div className={c.meta}>{s.agency ?? "—"}</div>
                    <div className={c.row}>
                      <Badge>{humanizeStatus(s.status)}</Badge>
                      <span className={c.meta}>
                        feasibility {s.feasibilityScore ?? "?"} · fit {s.zeroFloatFit ?? "?"}
                      </span>
                    </div>
                    {s.status === "TRIAGE_COMPLETE" && (
                      <div className={c.row}>
                        <form action={approveSourcing}>
                          <input type="hidden" name="solicitationId" value={s.id} />
                          <Button type="submit" size="sm">
                            Approve sourcing
                          </Button>
                        </form>
                        <form action={markNoGo}>
                          <input type="hidden" name="solicitationId" value={s.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            No-go
                          </Button>
                        </form>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
