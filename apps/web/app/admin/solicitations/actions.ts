"use server";

/**
 * Solicitation + quote decision actions for the operator console. Every action is a HUMAN decision
 * behind requireAdmin (role + satisfied TOTP), runs inside an org-scoped transaction, and appends an
 * ADMIN audit row. None of these send anything outbound or commit the firm to a third party — they
 * record internal triage/selection decisions (CLAUDE.md §2: the model never advances state; a human
 * does). Approving SOURCING (which arms the outreach workflow + emits a human-gate event) stays in
 * ../approvals/actions.ts; this module holds the no-go / shortlist / select decisions, which have no
 * outbound side effects and emit no events.
 */
import { revalidatePath } from "next/cache";

import { and, eq, inArray, sql, solicitations, vendorQuotes, withOrg } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

/**
 * Human "no-go": reject a triaged solicitation (TRIAGE_COMPLETE → NO_GO, terminal). This is a person
 * deciding NOT to pursue — never an AI auto-rejection (triage only ever recommends). NO_GO is outside
 * the sourcing_gate's guarded set, so no approver column is required.
 */
export async function markNoGo(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const solicitationId = readId(formData, "solicitationId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(solicitations)
      .set({ status: "NO_GO" })
      // Only a TRIAGE_COMPLETE solicitation can be marked no-go — never one already advanced/approved.
      .where(
        and(
          eq(solicitations.orgId, orgId),
          eq(solicitations.id, solicitationId),
          eq(solicitations.status, "TRIAGE_COMPLETE"),
        ),
      )
      .returning({ id: solicitations.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "SOLICITATION_NO_GO",
      entityType: "solicitations",
      entityId: solicitationId,
    });
  });

  revalidatePath("/admin/solicitations");
  revalidatePath(`/admin/solicitations/${solicitationId}`);
}

/** Shortlist a submitted quote for closer review (SUBMITTED/UNDER_REVIEW → SHORTLISTED). */
export async function shortlistQuote(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const quoteId = readId(formData, "quoteId");

  const solicitationId = await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(vendorQuotes)
      .set({ status: "SHORTLISTED" })
      .where(
        and(
          eq(vendorQuotes.orgId, orgId),
          eq(vendorQuotes.id, quoteId),
          inArray(vendorQuotes.status, ["SUBMITTED", "UNDER_REVIEW"]),
        ),
      )
      .returning({ id: vendorQuotes.id, solicitationId: vendorQuotes.solicitationId });
    const row = rows[0];
    if (!row) return null;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "QUOTE_SHORTLISTED",
      entityType: "vendor_quotes",
      entityId: quoteId,
    });
    return row.solicitationId;
  });

  if (solicitationId) revalidatePath(`/admin/solicitations/${solicitationId}`);
}

/**
 * Select the winning quote (SHORTLISTED → SELECTED). This records the operator's choice; it does NOT
 * draft a proposal or advance the solicitation (that is the Inngest drafting workflow in the next PR,
 * triggered by an explicit human-gate event). Refuses if a winner is already selected for the
 * solicitation — the choice is single and explicit.
 */
export async function selectQuote(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const quoteId = readId(formData, "quoteId");

  const solicitationId = await withOrg(orgId, async (tx) => {
    // One ATOMIC conditional UPDATE is its own single-winner guard: it only matches a SHORTLISTED quote
    // whose solicitation has no SELECTED winner yet. Postgres takes a row lock on the target before
    // evaluating WHERE, and the correlated NOT EXISTS rejects a second winner — so two concurrent selects
    // (two tabs / double-submit) cannot both win, with no TOCTOU window. The `w` self-join correlates to
    // the row being updated (vendor_quotes.solicitation_id).
    const rows = await tx
      .update(vendorQuotes)
      .set({ status: "SELECTED" })
      .where(
        and(
          eq(vendorQuotes.orgId, orgId),
          eq(vendorQuotes.id, quoteId),
          eq(vendorQuotes.status, "SHORTLISTED"),
          sql`NOT EXISTS (
            SELECT 1 FROM ${vendorQuotes} w
            WHERE w.org_id = ${orgId}
              AND w.solicitation_id = ${vendorQuotes.solicitationId}
              AND w.status = 'SELECTED'
          )`,
        ),
      )
      .returning({ id: vendorQuotes.id, solicitationId: vendorQuotes.solicitationId });
    const row = rows[0];
    if (!row) return null; // not shortlisted, or a winner already exists — no-op

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "QUOTE_SELECTED",
      entityType: "vendor_quotes",
      entityId: quoteId,
      after: { solicitationId: row.solicitationId },
    });
    return row.solicitationId;
  });

  if (solicitationId) revalidatePath(`/admin/solicitations/${solicitationId}`);
}
