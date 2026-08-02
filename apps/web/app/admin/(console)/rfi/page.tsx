/**
 * /admin/rfi — the sources-sought/RFI capture-track queue (§3.8.1). A lighter status track than the
 * bid/award kanban at /admin/solicitations: RECEIVED → CAPABILITY_DRAFTED → RESPONSE_SUBMITTED →
 * optionally CONVERTED, or CLOSED_NO_ACTION. These rows are deliberately excluded from the
 * /admin/solicitations board (a sources-sought/RFI notice never has a bid/award `status` to show there).
 * Rendering advances nothing (CLAUDE.md §2). requireAdmin guards the page.
 */
import Link from "next/link";
import type { JSX } from "react";

import { desc, isNotNull, solicitations, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { humanizeStatus } from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function RfiQueuePage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const rows = await withOrg(orgId, (tx) =>
    tx
      .select({
        id: solicitations.id,
        title: solicitations.title,
        agency: solicitations.agency,
        noticeType: solicitations.noticeType,
        rfiTrackStatus: solicitations.rfiTrackStatus,
        responseDeadline: solicitations.responseDeadline,
      })
      .from(solicitations)
      .where(isNotNull(solicitations.rfiTrackStatus))
      .orderBy(desc(solicitations.createdAt))
      .limit(200),
  );

  return (
    <main>
      <PageHeader
        title="Sources sought / RFI"
        lede="Informational capture-development activity — no bid, no award. A lighter status track: received → capability statement drafted → submitted → optionally converted into a tracked pursuit."
      />
      {rows.length === 0 ? (
        <p className={c.empty}>None yet. Sources-sought/RFI notices route here automatically at discovery.</p>
      ) : (
        <ul className={c.list}>
          {rows.map((r) => (
            <Card as="li" key={r.id} size="sm" testId={`rfi-${r.id}`}>
              <div className={c.rowBetween}>
                <div>
                  <Link href={`/admin/rfi/${r.id}`}>
                    <strong>{r.title}</strong>
                  </Link>
                  <div className={c.meta}>{r.agency ?? "Agency unknown"}</div>
                  <div className={c.row}>
                    <Badge tone="info">{humanizeStatus(r.rfiTrackStatus ?? "")}</Badge>
                    {r.noticeType && <Badge tone="neutral">{humanizeStatus(r.noticeType)}</Badge>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
