/**
 * /admin/solicitations — the solicitations kanban. Lanes are the five operator phases (see admin-board).
 * A TRIAGE_COMPLETE card carries the two human sourcing decisions: approve sourcing (which emits the
 * human-gate event + arms the outreach workflow) or mark no-go. Rendering the board advances nothing
 * (CLAUDE.md §2). Middleware gates /admin; requireAdmin is defense in depth.
 */
import Link from "next/link";
import type { JSX } from "react";

import { desc, eq, solicitations, withOrg } from "@hermes/db";

import { requireAdmin } from "@/lib/auth-guard";
import { groupByColumn, humanizeStatus } from "@/lib/admin-board";

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
      <h1>Solicitations</h1>
      <p>Sourced from SAM.gov and triaged by the AI (a recommendation only — you decide).</p>

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", overflowX: "auto" }}>
        {columns.map((col) => (
          <section key={col.title} data-testid={`column-${col.title}`} style={{ minWidth: 240 }}>
            <h2>
              {col.title} ({col.items.length})
            </h2>
            {col.items.length === 0 ? (
              <p>—</p>
            ) : (
              col.items.map((s) => (
                <article
                  key={s.id}
                  style={{ border: "1px solid #ccc", padding: "0.5rem", marginBottom: "0.5rem" }}
                >
                  <Link href={`/admin/solicitations/${s.id}`}>
                    <strong>{s.title}</strong>
                  </Link>
                  <div>{s.agency ?? "—"}</div>
                  <div>
                    {humanizeStatus(s.status)} · feasibility {s.feasibilityScore ?? "?"} · fit{" "}
                    {s.zeroFloatFit ?? "?"}
                  </div>
                  {s.status === "TRIAGE_COMPLETE" && (
                    <div>
                      <form action={approveSourcing} style={{ display: "inline" }}>
                        <input type="hidden" name="solicitationId" value={s.id} />
                        <button type="submit">Approve sourcing</button>
                      </form>{" "}
                      <form action={markNoGo} style={{ display: "inline" }}>
                        <input type="hidden" name="solicitationId" value={s.id} />
                        <button type="submit">No-go</button>
                      </form>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
