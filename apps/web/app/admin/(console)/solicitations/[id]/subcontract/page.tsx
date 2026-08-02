/**
 * /admin/solicitations/[id]/subcontract — the §3.1.4 review surface. Renders the cascaded `contracts` row,
 * its milestone schedule, and the drafted (unsigned) SUBCONTRACT_DRAFT document text — a binding legal
 * document to a third party, so it gets the same care as the proposal's counsel-review gate (CLAUDE.md
 * §2/§6): nothing is sent to the vendor and e-signature cannot start until the admin explicitly confirms
 * review (a SEPARATE follow-on action). requireAdmin guards the page; getStorage() needs the Node runtime.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import { and, asc, contractMilestones, contracts, desc, documents, eq, withOrg } from "@hermes/db";
import { getStorage } from "@hermes/core";

import fieldStyles from "@/components/ui/Field.module.css";
import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { humanizeStatus } from "@/lib/admin-board";
import { formatUsd } from "@/lib/portal";
import { requireAdmin } from "@/lib/auth-guard";

import { confirmSubcontractReview, startEsign } from "./actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // getStorage() (Tigris/AWS SDK) is Node-only

export default async function SubcontractReview({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await withOrg(orgId, async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.solicitationId, id)))
      .limit(1);
    if (!contract) return null;

    const milestones = await tx
      .select()
      .from(contractMilestones)
      .where(and(eq(contractMilestones.orgId, orgId), eq(contractMilestones.contractId, contract.id)))
      .orderBy(asc(contractMilestones.sequence));

    const [doc] = await tx
      .select({
        id: documents.id,
        storageKey: documents.storageKey,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.contractId, contract.id),
          eq(documents.kind, "SUBCONTRACT_DRAFT"),
        ),
      )
      .orderBy(desc(documents.createdAt))
      .limit(1);

    return { contract, milestones, doc };
  });

  if (!data) notFound();
  const { contract, milestones, doc } = data;

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

  const reviewed = Boolean(contract.agreementReviewedBy);
  const canStartEsign = reviewed && contract.esignStatus === "NOT_STARTED";

  return (
    <main>
      <PageHeader
        title="Subcontract agreement"
        back={
          <Link href={`/admin/solicitations/${id}`} className={c.crumb}>
            ← Solicitation
          </Link>
        }
        lede={`Contract status ${humanizeStatus(contract.status)} · e-signature ${humanizeStatus(contract.esignStatus)}`}
      />

      <Section title="Contract summary">
        <Card>
          <ul className={c.list}>
            <li className={c.rowBetween}>
              <span className={c.meta}>Contract type</span>
              <span>{contract.contractType}</span>
            </li>
            <li className={c.rowBetween}>
              <span className={c.meta}>Total value</span>
              <span>{formatUsd(contract.totalValue)}</span>
            </li>
            <li className={c.rowBetween}>
              <span className={c.meta}>Accelerated payments</span>
              <span>{contract.acceleratedPayments ? "Yes" : "No"}</span>
            </li>
            <li className={c.rowBetween}>
              <span className={c.meta}>Admin review</span>
              <span data-testid="review-status">
                {reviewed ? `Confirmed ${contract.agreementReviewedAt?.toISOString() ?? ""}` : "Not yet reviewed"}
              </span>
            </li>
          </ul>
        </Card>
      </Section>

      <Section title="Milestone schedule" count={milestones.length}>
        {milestones.length === 0 ? (
          <p className={c.empty}>No milestones.</p>
        ) : (
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="milestones-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <td>{m.sequence}</td>
                    <td>{m.description}</td>
                    <td>{formatUsd(m.amount)}</td>
                    <td>{humanizeStatus(m.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Drafted subcontract agreement (PROVISIONAL — review before it goes anywhere)">
        {!doc ? (
          <p className={c.empty}>No draft has been generated yet.</p>
        ) : reviewed ? (
          <Card>
            <p className={c.meta}>
              This agreement was reviewed and confirmed. It has NOT been sent to the vendor automatically —
              starting e-signature is a separate, explicit step below.
            </p>
            {loadError ? (
              <p className={c.empty}>The confirmed document could not be loaded from storage.</p>
            ) : (
              <pre className={c.scope} data-testid="subcontract-draft-text">
                {draftText}
              </pre>
            )}
          </Card>
        ) : (
          <Card>
            <p className={c.meta}>
              Read (and edit if needed) the drafted agreement below, then confirm your review. This is a
              binding legal document headed to a third party — nothing is sent to the vendor until you
              confirm, and e-signature cannot start until then either.
            </p>
            {loadError && (
              <p className={c.empty}>
                The AI-drafted text could not be loaded from storage — you can still write or paste the
                agreement text below before confirming.
              </p>
            )}
            <form action={confirmSubcontractReview}>
              <input type="hidden" name="contractId" value={contract.id} />
              <textarea
                name="draftText"
                defaultValue={draftText}
                rows={22}
                data-testid="subcontract-draft-textarea"
                className={fieldStyles.input}
              />
              <Button type="submit">Confirm review</Button>
            </form>
          </Card>
        )}
      </Section>

      <Section title="E-signature">
        <Card>
          <p className={c.row}>
            <span className={c.meta}>Status:</span>{" "}
            <Badge tone={contract.esignStatus === "NOT_STARTED" ? "neutral" : "info"}>
              {humanizeStatus(contract.esignStatus)}
            </Badge>
          </p>
          {canStartEsign ? (
            <form action={startEsign}>
              <input type="hidden" name="contractId" value={contract.id} />
              <Button type="submit" data-testid="start-esign-button">
                Start e-signature
              </Button>
            </form>
          ) : !reviewed ? (
            <p className={c.meta}>Confirm review above before e-signature can start.</p>
          ) : (
            <p className={c.meta}>
              E-signature has already started. (Stub — the real e-signature vendor integration is a later
              phase, §7.3.)
            </p>
          )}
        </Card>
      </Section>
    </main>
  );
}
