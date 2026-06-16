/**
 * DB-backed logic suite — the Phase 4 acceptance tests, run against a real Postgres (pgvector container in
 * CI, Neon locally) with AI + Resend mocked. These prove the Prime Directive (CLAUDE.md §2) end to end:
 *   - triage writes a recommendation and STOPS — zero outreach rows, zero emails;
 *   - a fail-closed triage never advances;
 *   - discovery DRAFTS outreach (PENDING_APPROVAL) and sends nothing;
 *   - the send REFUSES a campaign that is not human-APPROVED, and only sends once it is;
 *   - quote ranking advances to the human-review pricing state;
 *   - every autonomous write / approval lands an audit row with the right actor_type.
 */
import { describe, expect, it, vi } from "vitest";

import { FailClosedError } from "@hermes/ai";
import {
  and,
  auditLog,
  eq,
  outreachCampaigns,
  proposals,
  solicitations,
  vendorQuotes,
  type Tx,
} from "@hermes/db";

import {
  draftProposalBid,
  onSourcingApproved,
  rankQuotes,
  sendOutreach,
  triage,
} from "../src/logic.js";
import { HAS_DB, withRollbackTx } from "./helpers/db.js";
import {
  insertLineItem,
  insertOrg,
  insertOutreach,
  insertProspect,
  insertQuote,
  insertSolicitation,
  insertUser,
} from "./helpers/fixtures.js";
import { makeDeps } from "./helpers/mocks.js";

/** Seed a PRICING_PENDING solicitation + a SELECTED quote with one line item, ready for drafting. */
async function seedSelected(
  tx: Tx,
  opts: { isServices?: boolean | null; withLineItem?: boolean } = {},
): Promise<{ orgId: string; solId: string; quoteId: string }> {
  const orgId = await insertOrg(tx);
  const approver = await insertUser(tx, orgId);
  const solId = await insertSolicitation(tx, orgId, {
    status: "PRICING_PENDING",
    sourcingApprovedBy: approver, // the sourcing_gate CHECK is live for PRICING_PENDING
    isServices: opts.isServices === undefined ? true : opts.isServices,
    contractType: "FFP",
    naicsCode: "541511",
  });
  const prospectId = await insertProspect(tx, orgId);
  const quoteId = await insertQuote(tx, orgId, { solicitationId: solId, prospectId, status: "SELECTED" });
  if (opts.withLineItem !== false) {
    await insertLineItem(tx, orgId, { quoteId, costType: "LABOR", contractType: "FFP" });
  }
  return { orgId, solId, quoteId };
}

const d = HAS_DB ? describe : describe.skip;

d("triage (recommendation only — no outreach, no email)", () => {
  it("writes TRIAGE_COMPLETE, drafts zero outreach, and sends no email", () =>
    withRollbackTx(async (tx) => {
      const { deps, sendOutreachEmail } = makeDeps();
      const orgId = await insertOrg(tx);
      const solId = await insertSolicitation(tx, orgId, { status: "PENDING_TRIAGE" });

      const result = await triage(tx, deps, { orgId, solicitationId: solId });
      expect(result.status).toBe("TRIAGE_COMPLETE");

      const [sol] = await tx.select().from(solicitations).where(eq(solicitations.id, solId));
      expect(sol!.status).toBe("TRIAGE_COMPLETE");
      expect(sol!.feasibilityScore).toBe(8);
      expect(sol!.zeroFloatFit).toBe("STRONG");

      const outreach = await tx
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.orgId, orgId));
      expect(outreach).toHaveLength(0);
      expect(sendOutreachEmail).not.toHaveBeenCalled();

      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SOLICITATION_TRIAGED")));
      expect(audits).toHaveLength(1);
      expect(audits[0]!.actorType).toBe("SYSTEM");
    }));

  it("fails closed (no advance) when the model output cannot be validated", () =>
    withRollbackTx(async (tx) => {
      const { deps, sendOutreachEmail } = makeDeps({
        triageSolicitation: async () => {
          throw new FailClosedError("TriageVerdict", "schema mismatch");
        },
      });
      const orgId = await insertOrg(tx);
      const solId = await insertSolicitation(tx, orgId, { status: "PENDING_TRIAGE" });

      const result = await triage(tx, deps, { orgId, solicitationId: solId });
      expect(result.status).toBe("FAILED_CLOSED");

      const [sol] = await tx.select().from(solicitations).where(eq(solicitations.id, solId));
      expect(sol!.status).toBe("PENDING_TRIAGE"); // unchanged — never advanced
      expect(sendOutreachEmail).not.toHaveBeenCalled();

      const audits = await tx
        .select()
        .from(auditLog)
        .where(
          and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SOLICITATION_TRIAGE_FAILED_CLOSED")),
        );
      expect(audits).toHaveLength(1);
    }));
});

d("onSourcingApproved (drafts only — never sends)", () => {
  it("drafts PENDING_APPROVAL outreach with no tokens, advances to AWAITING_APPROVAL, sends nothing", () =>
    withRollbackTx(async (tx) => {
      const { deps, sendOutreachEmail } = makeDeps();
      const orgId = await insertOrg(tx);
      const userId = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, {
        status: "READY_FOR_SOURCING",
        sourcingApprovedBy: userId,
      });
      await insertProspect(tx, orgId, { contactEmail: "reachable@example.test" });
      await insertProspect(tx, orgId, { contactEmail: null }); // unreachable — must be skipped

      const result = await onSourcingApproved(tx, deps, {
        orgId,
        solicitationId: solId,
        approvedBy: userId,
      });
      expect(result.drafted).toHaveLength(1); // only the prospect with an email

      const outreach = await tx
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.orgId, orgId));
      expect(outreach).toHaveLength(1);
      expect(outreach[0]!.status).toBe("PENDING_APPROVAL");
      expect(outreach[0]!.sentAt).toBeNull();
      expect(outreach[0]!.quoteTokenHash).toBeNull(); // tokens are NOT minted until an approved send

      const [sol] = await tx.select().from(solicitations).where(eq(solicitations.id, solId));
      expect(sol!.status).toBe("AWAITING_APPROVAL");
      expect(sendOutreachEmail).not.toHaveBeenCalled();
    }));
});

d("sendOutreach (the gate, in code)", () => {
  it("REFUSES to send a campaign that is not human-APPROVED", () =>
    withRollbackTx(async (tx) => {
      const { deps, sendOutreachEmail } = makeDeps();
      const orgId = await insertOrg(tx);
      const userId = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, {
        status: "AWAITING_APPROVAL",
        sourcingApprovedBy: userId,
      });
      const pid = await insertProspect(tx, orgId, { contactEmail: "p@example.test" });
      const outreachId = await insertOutreach(tx, orgId, {
        solicitationId: solId,
        prospectId: pid,
        status: "PENDING_APPROVAL", // not approved
      });

      const result = await sendOutreach(tx, deps, { orgId, outreachId, approvedBy: userId });
      expect(result.status).toBe("REFUSED");
      expect(sendOutreachEmail).not.toHaveBeenCalled();

      const [o] = await tx
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.id, outreachId));
      expect(o!.status).toBe("PENDING_APPROVAL"); // unchanged
      expect(o!.sentAt).toBeNull();
    }));

  it("sends, marks SENT with token hashes, and advances the solicitation once APPROVED", () =>
    withRollbackTx(async (tx) => {
      const { deps, sendOutreachEmail } = makeDeps();
      const orgId = await insertOrg(tx);
      const userId = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, {
        status: "AWAITING_APPROVAL",
        sourcingApprovedBy: userId,
      });
      const pid = await insertProspect(tx, orgId, { contactEmail: "p@example.test" });
      const outreachId = await insertOutreach(tx, orgId, {
        solicitationId: solId,
        prospectId: pid,
        status: "APPROVED",
        approvedBy: userId,
      });

      const result = await sendOutreach(tx, deps, { orgId, outreachId, approvedBy: userId });
      expect(result.status).toBe("SENT");
      expect(sendOutreachEmail).toHaveBeenCalledTimes(1);
      expect(sendOutreachEmail.mock.calls[0]![0]).toMatchObject({ to: "p@example.test" });

      const [o] = await tx
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.id, outreachId));
      expect(o!.status).toBe("SENT");
      expect(o!.sentAt).not.toBeNull();
      expect(o!.quoteTokenHash).not.toBeNull();
      expect(o!.optoutTokenHash).not.toBeNull();

      const [sol] = await tx.select().from(solicitations).where(eq(solicitations.id, solId));
      expect(sol!.status).toBe("SOURCING_IN_PROGRESS");

      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "OUTREACH_SENT")));
      expect(audits).toHaveLength(1);
      expect(audits[0]!.actorType).toBe("ADMIN");
      expect(audits[0]!.actorUserId).toBe(userId);
    }));
});

d("rankQuotes (recommendation → human pricing review)", () => {
  it("ranks submitted quotes and advances to PRICING_PENDING", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const orgId = await insertOrg(tx);
      const userId = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, {
        status: "SOURCING_IN_PROGRESS",
        sourcingApprovedBy: userId,
      });
      const pid = await insertProspect(tx, orgId, {});
      await insertQuote(tx, orgId, { solicitationId: solId, prospectId: pid, status: "SUBMITTED" });
      await insertQuote(tx, orgId, { solicitationId: solId, prospectId: pid, status: "SUBMITTED" });

      const result = await rankQuotes(tx, deps, { orgId, solicitationId: solId });
      expect(result.status).toBe("PRICING_PENDING");
      expect(result.ranked).toBe(2);

      const quotes = await tx
        .select()
        .from(vendorQuotes)
        .where(eq(vendorQuotes.solicitationId, solId));
      for (const q of quotes) {
        expect(q.aiRank).not.toBeNull();
        expect(q.evaluatedAt).not.toBeNull();
      }

      const [sol] = await tx.select().from(solicitations).where(eq(solicitations.id, solId));
      expect(sol!.status).toBe("PRICING_PENDING");

      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "QUOTES_RANKED")));
      expect(audits).toHaveLength(1);
    }));
});

d("draftProposalBid (human-gated drafting — analyzes, never submits)", () => {
  it("drafts a DRAFT proposal, advances PROPOSAL_DRAFT, and leaves submit/counsel cols NULL", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const { orgId, solId, quoteId } = await seedSelected(tx);

      const result = await draftProposalBid(tx, deps, {
        orgId,
        solicitationId: solId,
        quoteId,
        selectedBy: "00000000-0000-0000-0000-000000000000",
      });
      expect(result.status).toBe("DRAFTED");

      const [p] = await tx.select().from(proposals).where(eq(proposals.solicitationId, solId));
      expect(p!.status).toBe("DRAFT");
      expect(p!.contractType).toBe("FFP");
      expect(p!.selectedQuoteId).toBe(quoteId);
      // The no-auto-submit invariant: no human/counsel columns are set at draft time.
      expect(p!.submittedBy).toBeNull();
      expect(p!.submittedAt).toBeNull();
      expect(p!.counselReviewedBy).toBeNull();
      expect(p!.counselReviewedAt).toBeNull();
      // Deterministic brief is stored.
      expect(p!.pricingScenarios).toBeTruthy();
      expect(p!.complianceChecklist).toBeTruthy();

      const [sol] = await tx.select().from(solicitations).where(eq(solicitations.id, solId));
      expect(sol!.status).toBe("PROPOSAL_DRAFT");

      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "PROPOSAL_DRAFTED")));
      expect(audits).toHaveLength(1);
      expect(audits[0]!.actorType).toBe("SYSTEM");
    }));

  it("fails closed (no row, stays PRICING_PENDING) when the model output cannot be validated", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps({
        draftBid: async () => {
          throw new FailClosedError("ProposalNarrative", "schema mismatch");
        },
      });
      const { orgId, solId, quoteId } = await seedSelected(tx);

      const result = await draftProposalBid(tx, deps, {
        orgId,
        solicitationId: solId,
        quoteId,
        selectedBy: "00000000-0000-0000-0000-000000000000",
      });
      expect(result.status).toBe("FAILED_CLOSED");

      const rows = await tx.select().from(proposals).where(eq(proposals.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const [sol] = await tx.select().from(solicitations).where(eq(solicitations.id, solId));
      expect(sol!.status).toBe("PRICING_PENDING");
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "PROPOSAL_DRAFT_FAILED_CLOSED")));
      expect(audits).toHaveLength(1);
    }));

  it("fails closed without calling the model when is_services is NULL (LoS would fail open)", () =>
    withRollbackTx(async (tx) => {
      const draftBid = vi.fn(async () => {
        throw new Error("draftBid must not be called when is_services is NULL");
      });
      const { deps } = makeDeps({ draftBid });
      const { orgId, solId, quoteId } = await seedSelected(tx, { isServices: null });

      const result = await draftProposalBid(tx, deps, {
        orgId,
        solicitationId: solId,
        quoteId,
        selectedBy: "00000000-0000-0000-0000-000000000000",
      });
      expect(result.status).toBe("FAILED_CLOSED");
      expect(draftBid).not.toHaveBeenCalled();

      const rows = await tx.select().from(proposals).where(eq(proposals.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "PROPOSAL_DRAFT_FAILED_CLOSED")));
      expect(audits[0]!.after).toMatchObject({ stage: "is_services_null" });
    }));

  it("refuses when the quote is not SELECTED (no human selection = no draft)", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const orgId = await insertOrg(tx);
      const approver = await insertUser(tx, orgId);
      const solId = await insertSolicitation(tx, orgId, {
        status: "PRICING_PENDING",
        sourcingApprovedBy: approver,
        isServices: true,
        contractType: "FFP",
      });
      const prospectId = await insertProspect(tx, orgId);
      // SHORTLISTED, not SELECTED.
      const quoteId = await insertQuote(tx, orgId, {
        solicitationId: solId,
        prospectId,
        status: "SHORTLISTED",
      });

      const result = await draftProposalBid(tx, deps, {
        orgId,
        solicitationId: solId,
        quoteId,
        selectedBy: "00000000-0000-0000-0000-000000000000",
      });
      expect(result.status).toBe("REFUSED");

      const rows = await tx.select().from(proposals).where(eq(proposals.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "PROPOSAL_DRAFT_REFUSED_NO_WINNER")));
      expect(audits).toHaveLength(1);
    }));

  it("fails closed when the selected quote has no line items", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const { orgId, solId, quoteId } = await seedSelected(tx, { withLineItem: false });

      const result = await draftProposalBid(tx, deps, {
        orgId,
        solicitationId: solId,
        quoteId,
        selectedBy: "00000000-0000-0000-0000-000000000000",
      });
      expect(result.status).toBe("FAILED_CLOSED");
      const rows = await tx.select().from(proposals).where(eq(proposals.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "PROPOSAL_DRAFT_FAILED_CLOSED")));
      expect(audits[0]!.after).toMatchObject({ stage: "no_line_items" });
    }));

  it("is idempotent: a second event drafts no second row and returns ALREADY_DRAFTED", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const { orgId, solId, quoteId } = await seedSelected(tx);
      const args = {
        orgId,
        solicitationId: solId,
        quoteId,
        selectedBy: "00000000-0000-0000-0000-000000000000",
      };

      const first = await draftProposalBid(tx, deps, args);
      expect(first.status).toBe("DRAFTED");
      const second = await draftProposalBid(tx, deps, args);
      expect(second.status).toBe("ALREADY_DRAFTED");

      const rows = await tx.select().from(proposals).where(eq(proposals.solicitationId, solId));
      expect(rows).toHaveLength(1);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "PROPOSAL_DRAFT_SKIPPED_EXISTS")));
      expect(audits).toHaveLength(1);
    }));
});
