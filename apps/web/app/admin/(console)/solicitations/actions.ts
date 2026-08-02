"use server";

/**
 * Solicitation + quote decision actions for the operator console. Every action is a HUMAN decision
 * behind requireCaptureAccess (role + satisfied TOTP), runs inside an org-scoped transaction, and appends an
 * ADMIN audit row. None of these send anything outbound directly to a third party — they record internal
 * triage/selection/outcome decisions (CLAUDE.md §2: the model never advances state; a human does).
 * Approving SOURCING (which arms the outreach workflow + emits a human-gate event) stays in
 * ../approvals/actions.ts; this module holds the no-go / shortlist / select / record-outcome decisions.
 *
 * recordOutcome (§3.1) is the one-level-up sibling of selectQuote: the human records the GOVERNMENT's
 * actual decision. On AWARD it best-effort emits hermes/solicitation.awarded (the human-gate event that
 * cascades the subcontract — see packages/inngest); the emit is OUTSIDE the committed transaction and
 * wrapped so a transient Inngest outage never fails the human's already-recorded decision (mirrors
 * selectQuote's hermes/quote.selected emit).
 */
import { revalidatePath } from "next/cache";

import {
  and,
  eq,
  inArray,
  ne,
  proposals,
  solicitations,
  sql,
  vendorProspects,
  vendorQuotes,
  vendors,
  withOrg,
} from "@hermes/db";
import { inngest, writeAudit } from "@hermes/inngest";

import { OUTCOME_RECORDABLE_STATUSES } from "@/lib/admin-board";
import { requireCaptureAccess } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOME_VALUES = ["AWARDED", "REJECTED", "CLOSED"] as const;
type Outcome = (typeof OUTCOME_VALUES)[number];
const PROTEST_STATUS_VALUES = [
  "NONE",
  "CONSIDERING",
  "FILED",
  "RESOLVED_SUSTAINED",
  "RESOLVED_DENIED",
  "WITHDRAWN",
] as const;
const MAX_TEXT = 4000;
const MAX_PIID = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

function readText(formData: FormData, key: string, max = MAX_TEXT): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw.length > 0 ? raw.slice(0, max) : null;
}

/**
 * Human "no-go": reject a triaged solicitation (TRIAGE_COMPLETE → NO_GO, terminal). This is a person
 * deciding NOT to pursue — never an AI auto-rejection (triage only ever recommends). NO_GO is outside
 * the sourcing_gate's guarded set, so no approver column is required.
 */
export async function markNoGo(formData: FormData): Promise<void> {
  const session = await requireCaptureAccess();
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
  const session = await requireCaptureAccess();
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
  const session = await requireCaptureAccess();
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

    // §3.1 item 5: close the vendor-side loop on loss, right here — every OTHER (non-terminal) quote on
    // this same solicitation flips to REJECTED so a losing vendor's portal status is never left ambiguous.
    // This is a human decision (the same click that selected the winner), so it flips inside this tx —
    // distinct from the loss-notification EMAIL, which is outbound and gets its own explicit approval
    // (queued below as an audit row; sent only via ../approvals/actions.ts approveLossNotification).
    const losers = await tx
      .update(vendorQuotes)
      .set({ status: "REJECTED" })
      .where(
        and(
          eq(vendorQuotes.orgId, orgId),
          eq(vendorQuotes.solicitationId, row.solicitationId),
          ne(vendorQuotes.id, quoteId),
          inArray(vendorQuotes.status, ["INVITED", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"]),
        ),
      )
      .returning({
        id: vendorQuotes.id,
        vendorId: vendorQuotes.vendorId,
        prospectId: vendorQuotes.prospectId,
      });

    if (losers.length > 0) {
      const loserVendorIds = losers.map((l) => l.vendorId).filter((v): v is string => Boolean(v));
      const loserProspectIds = losers.map((l) => l.prospectId).filter((v): v is string => Boolean(v));
      const contacts = new Map<string, { name: string; email: string | null }>();
      if (loserVendorIds.length > 0) {
        const vs = await tx
          .select({ id: vendors.id, name: vendors.companyName, email: vendors.contactEmail })
          .from(vendors)
          .where(and(eq(vendors.orgId, orgId), inArray(vendors.id, loserVendorIds)));
        for (const v of vs) contacts.set(v.id, { name: v.name, email: v.email });
      }
      if (loserProspectIds.length > 0) {
        const ps = await tx
          .select({
            id: vendorProspects.id,
            name: vendorProspects.companyName,
            email: vendorProspects.contactEmail,
          })
          .from(vendorProspects)
          .where(and(eq(vendorProspects.orgId, orgId), inArray(vendorProspects.id, loserProspectIds)));
        for (const p of ps) contacts.set(p.id, { name: p.name, email: p.email });
      }

      const solTitleRows = await tx
        .select({ title: solicitations.title })
        .from(solicitations)
        .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, row.solicitationId)))
        .limit(1);
      const solicitationTitle = solTitleRows[0]?.title ?? "the solicitation";

      for (const loser of losers) {
        await writeAudit(tx, {
          orgId,
          actorType: "ADMIN",
          actorUserId: userId,
          actorEmail: session.user.email ?? null,
          action: "QUOTE_REJECTED",
          entityType: "vendor_quotes",
          entityId: loser.id,
          after: { reason: "not_selected", solicitationId: row.solicitationId },
        });

        // Queue (never send) a loss-notification candidate — audit_log doubles as the lightweight
        // approval queue (no new table, O4). The admin explicitly approves the SEND on /admin/approvals.
        const key = loser.vendorId ?? loser.prospectId ?? undefined;
        const contact = key ? contacts.get(key) : undefined;
        if (contact?.email) {
          await writeAudit(tx, {
            orgId,
            actorType: "SYSTEM",
            action: "LOSS_NOTIFICATION_QUEUED",
            entityType: "vendor_quotes",
            entityId: loser.id,
            after: { to: contact.email, companyName: contact.name, solicitationTitle },
          });
        }
      }
    }

    return row.solicitationId;
  });

  if (solicitationId) {
    // Emit the human-gate event OUTSIDE the tx — the selection + its audit are the only correctness-
    // critical facts and have already committed. The drafting workflow ANALYZES only (it never submits).
    // Best-effort: a failed/unconfigured emit must NOT fail the human's selection (Prime-Directive-safe).
    // In web-e2e the production `next start` has no INNGEST_EVENT_KEY, so send() throws — the catch keeps
    // the selection green (no proposal is drafted because Inngest doesn't run in e2e).
    try {
      await inngest.send({
        name: "hermes/quote.selected",
        data: { orgId, solicitationId, quoteId, selectedBy: userId },
      });
    } catch (err) {
      try {
        await withOrg(orgId, (tx) =>
          writeAudit(tx, {
            orgId,
            actorType: "SYSTEM",
            action: "QUOTE_SELECTED_EMIT_FAILED",
            entityType: "vendor_quotes",
            entityId: quoteId,
            after: { solicitationId, error: err instanceof Error ? err.message : String(err) },
          }),
        );
      } catch {
        // The selection already committed — the only correctness-critical fact; never let the failover throw.
      }
    }
    revalidatePath(`/admin/solicitations/${solicitationId}`);
  }
}

/**
 * §3.1 items 1–2: record the GOVERNMENT's actual decision on a SUBMITTED solicitation — the one-level-up
 * sibling of "select the winning subcontractor." On AWARD, captures the award details and flips the
 * solicitation AWARDED / the proposal WON; on loss, REJECTED / LOST with a reason; on cancellation/
 * no-award, CLOSED / WITHDRAWN. Award preconditions are enforced HONESTLY and ATOMICALLY: AWARDED is only
 * accepted when a proposal for this solicitation is genuinely SUBMITTED with a SELECTED winning quote
 * already recorded (a correlated EXISTS in the same conditional UPDATE — no separate check-then-write
 * window). Emits the hermes/solicitation.awarded human-gate event ONLY on a successful AWARD — the
 * subcontract-cascade + agreement-drafting workflow (packages/inngest) reacts to it; it never sends
 * anything and never starts e-signature on its own (CLAUDE.md §2).
 */
export async function recordOutcome(formData: FormData): Promise<void> {
  const session = await requireCaptureAccess();
  const orgId = session.user.orgId;
  const userId = session.user.id;
  const solicitationId = readId(formData, "solicitationId");

  const outcomeRaw = String(formData.get("outcome") ?? "");
  if (!(OUTCOME_VALUES as readonly string[]).includes(outcomeRaw)) {
    throw new Error("Invalid outcome");
  }
  const outcome = outcomeRaw as Outcome;

  const protestStatusRaw = String(formData.get("protestStatus") ?? "NONE");
  const protestStatus = (PROTEST_STATUS_VALUES as readonly string[]).includes(protestStatusRaw)
    ? (protestStatusRaw as (typeof PROTEST_STATUS_VALUES)[number])
    : "NONE";

  // Award-specific fields — parsed regardless of outcome (harmless if unused), validated at the boundary.
  const awardedPiid = readText(formData, "awardedPiid", MAX_PIID);
  const awardedValueRaw = String(formData.get("awardedValue") ?? "").trim();
  let awardedValue: string | null = null;
  if (awardedValueRaw.length > 0) {
    const n = Number(awardedValueRaw);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid awarded value");
    awardedValue = n.toFixed(2);
  }
  const awardDateRaw = String(formData.get("awardDate") ?? "").trim();
  let awardDate: Date | null = null;
  if (awardDateRaw.length > 0) {
    const d = new Date(awardDateRaw);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid award date");
    awardDate = d;
  }
  const coContactName = readText(formData, "coContactName", 200);
  const coContactEmailRaw = String(formData.get("coContactEmail") ?? "").trim();
  if (coContactEmailRaw.length > 0 && !EMAIL_RE.test(coContactEmailRaw)) {
    throw new Error("Invalid contracting-officer email");
  }
  const coContactEmail = coContactEmailRaw.length > 0 ? coContactEmailRaw : null;
  const coContactPhone = readText(formData, "coContactPhone", 40);
  const coContact =
    coContactName || coContactEmail || coContactPhone
      ? { name: coContactName ?? undefined, email: coContactEmail ?? undefined, phone: coContactPhone ?? undefined }
      : null;

  const debriefRequested = formData.get("debriefRequested") === "on";
  const debriefNotes = readText(formData, "debriefNotes");
  const protestNotes = readText(formData, "protestNotes");
  const outcomeNotes = readText(formData, "outcomeNotes");

  const proposalStatus: "WON" | "LOST" | "WITHDRAWN" =
    outcome === "AWARDED" ? "WON" : outcome === "REJECTED" ? "LOST" : "WITHDRAWN";

  const recorded = await withOrg(orgId, async (tx) => {
    const conditions = [
      eq(solicitations.orgId, orgId),
      eq(solicitations.id, solicitationId),
      inArray(solicitations.status, OUTCOME_RECORDABLE_STATUSES),
    ];
    if (outcome === "AWARDED") {
      // Award preconditions must be honest: a proposal that was actually human-submitted, with a SELECTED
      // winning quote already recorded (the subcontract cascade needs both). One atomic correlated EXISTS —
      // no read-then-write TOCTOU window (mirrors selectQuote's single-winner NOT EXISTS guard).
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${proposals} p
        WHERE p.org_id = ${orgId}
          AND p.solicitation_id = ${solicitations.id}
          AND p.status = 'SUBMITTED'
          AND p.selected_quote_id IS NOT NULL
      )`);
    }

    const rows = await tx
      .update(solicitations)
      .set({
        status: outcome,
        outcomeRecordedBy: userId,
        outcomeRecordedAt: new Date(),
        ...(outcome === "AWARDED" ? { awardedPiid, awardedValue, awardDate, coContact } : {}),
        debriefRequested,
        debriefNotes,
        protestStatus,
        protestNotes,
        outcomeNotes,
      })
      .where(and(...conditions))
      .returning({ id: solicitations.id });
    const row = rows[0];
    if (!row) return false; // not in a recordable state, or (for AWARD) no honest winning proposal

    // Flip the proposal to the matching terminal status. A SUBMITTED solicitation always has a proposal
    // (draftProposalBid created it), but stay defensive — a missing row is simply a no-op update.
    await tx
      .update(proposals)
      .set({ status: proposalStatus })
      .where(and(eq(proposals.orgId, orgId), eq(proposals.solicitationId, solicitationId)));

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: `SOLICITATION_OUTCOME_${outcome}`,
      entityType: "solicitations",
      entityId: solicitationId,
      after: { outcome, proposalStatus },
    });
    return true;
  });

  if (recorded && outcome === "AWARDED") {
    // Best-effort, OUTSIDE the committed tx (mirrors selectQuote's hermes/quote.selected emit): the human
    // decision already committed — a transient Inngest outage must never fail it. The subcontract cascade
    // + agreement drafting workflow reacts to this event; it never sends/e-signs on its own (CLAUDE.md §2).
    try {
      await inngest.send({
        name: "hermes/solicitation.awarded",
        data: { orgId, solicitationId, awardedBy: userId },
      });
    } catch (err) {
      try {
        await withOrg(orgId, (tx) =>
          writeAudit(tx, {
            orgId,
            actorType: "SYSTEM",
            action: "SOLICITATION_AWARDED_EMIT_FAILED",
            entityType: "solicitations",
            entityId: solicitationId,
            after: { error: err instanceof Error ? err.message : String(err) },
          }),
        );
      } catch {
        // The outcome already committed — never let the failover throw.
      }
    }
  }

  if (recorded) {
    revalidatePath("/admin/solicitations");
    revalidatePath(`/admin/solicitations/${solicitationId}`);
  }
}
