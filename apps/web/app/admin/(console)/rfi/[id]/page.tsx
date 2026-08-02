/**
 * /admin/rfi/[id] — a single sources-sought/RFI capture-track item (§3.8.1). Shows the notice, the
 * AI-drafted (reviewable) capability-statement document once drafted, and the four human-gated
 * transitions: draft capability statement (RECEIVED only), record response submitted, close (no action),
 * convert to tracked pursuit. Deliberately a SEPARATE detail page from /admin/solicitations/[id] — this
 * unit does not touch that heavily-shared file (concurrent §3.2/§3.3/§3.5/§3.6 work). requireAdmin guards
 * the page; getStorage() needs the Node runtime.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import { and, desc, documents, eq, solicitations, withOrg } from "@hermes/db";
import { getStorage } from "@hermes/core";

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { humanizeStatus } from "@/lib/admin-board";
import { requireAdmin } from "@/lib/auth-guard";

import { closeNoAction, convertToPursuit, recordResponseSubmitted, requestCapabilityStatementDraft } from "../actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE_TRACK_STATUSES = ["RECEIVED", "CAPABILITY_DRAFTED", "RESPONSE_SUBMITTED"];

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // getStorage() (Tigris/AWS SDK) is Node-only

export default async function RfiDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await withOrg(orgId, async (tx) => {
    const [sol] = await tx
      .select()
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, id)))
      .limit(1);
    if (!sol || !sol.rfiTrackStatus) return null;

    const [doc] = await tx
      .select({ id: documents.id, storageKey: documents.storageKey, createdAt: documents.createdAt })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.solicitationId, id),
          eq(documents.kind, "CAPABILITY_STATEMENT"),
        ),
      )
      .orderBy(desc(documents.createdAt))
      .limit(1);

    // If already CONVERTED, find the new pursuit this row created (reverse lookup).
    const [converted] = sol.rfiTrackStatus === "CONVERTED"
      ? await tx
          .select({ id: solicitations.id, title: solicitations.title })
          .from(solicitations)
          .where(and(eq(solicitations.orgId, orgId), eq(solicitations.convertedFromSolicitationId, id)))
          .limit(1)
      : [undefined];

    return { sol, doc, converted };
  });

  if (!data) notFound();
  const { sol, doc, converted } = data;

  let draftText = "";
  let loadError = false;
  if (doc) {
    try {
      const bytes = await getStorage().get(doc.storageKey);
      draftText = new TextDecoder().decode(bytes);
    } catch {
      loadError = true;
    }
  }

  const status = sol.rfiTrackStatus!;
  const isActive = ACTIVE_TRACK_STATUSES.includes(status);

  return (
    <main>
      <PageHeader
        title={sol.title}
        back={
          <Link href="/admin/rfi" className={c.crumb}>
            ← Sources sought / RFI
          </Link>
        }
        lede={
          <>
            {sol.agency ?? "Agency unknown"} · {humanizeStatus(status)}
            {sol.noticeType ? ` · ${humanizeStatus(sol.noticeType)}` : ""}
          </>
        }
      />

      {sol.scopeText && (
        <Section title="Notice text">
          <p className={c.scope}>{sol.scopeText.slice(0, 4000)}</p>
        </Section>
      )}

      <Section title="Capability-statement response">
        {!doc ? (
          <p className={c.empty}>
            No draft yet — informational capture-development activity, not a priced bid.
          </p>
        ) : loadError ? (
          <p className={c.empty}>The drafted document could not be loaded from storage.</p>
        ) : (
          <Card>
            <p className={c.meta}>AI-drafted for your review — prose only, no pricing, no commitment.</p>
            <pre className={c.scope} data-testid="capability-statement-text">
              {draftText}
            </pre>
          </Card>
        )}
      </Section>

      <Section title="Track this item">
        <Card>
          <div className={c.row}>
            {status === "RECEIVED" && (
              <form action={requestCapabilityStatementDraft}>
                <input type="hidden" name="solicitationId" value={sol.id} />
                <Button type="submit" size="sm">
                  Draft capability statement
                </Button>
              </form>
            )}
            {(status === "RECEIVED" || status === "CAPABILITY_DRAFTED") && (
              <form action={recordResponseSubmitted}>
                <input type="hidden" name="solicitationId" value={sol.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Record response submitted
                </Button>
              </form>
            )}
            {isActive && (
              <form action={convertToPursuit}>
                <input type="hidden" name="solicitationId" value={sol.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Convert to tracked pursuit
                </Button>
              </form>
            )}
            {isActive && (
              <form action={closeNoAction}>
                <input type="hidden" name="solicitationId" value={sol.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Close (no action)
                </Button>
              </form>
            )}
          </div>
          {status === "CONVERTED" && (
            <p className={c.meta}>
              Converted into a tracked pursuit.{" "}
              {converted ? (
                <Link href={`/admin/solicitations/${converted.id}`}>{converted.title} →</Link>
              ) : (
                "The linked pursuit could not be found."
              )}
            </p>
          )}
          {status === "CLOSED_NO_ACTION" && (
            <p className={c.meta}>
              <Badge tone="neutral">Closed</Badge> No further action on this notice.
            </p>
          )}
        </Card>
      </Section>
    </main>
  );
}
