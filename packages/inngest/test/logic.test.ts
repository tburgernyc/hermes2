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
  contractMilestones,
  contracts,
  documents,
  eq,
  outreachCampaigns,
  proposals,
  solicitations,
  vendorQuotes,
  type Tx,
} from "@hermes/db";

import {
  draftProposalBid,
  draftSubcontract,
  onSourcingApproved,
  rankQuotes,
  sendLossNotification,
  sendOutreach,
  triage,
} from "../src/logic.js";
import { HAS_DB, withRollbackTx } from "./helpers/db.js";
import {
  insertLineItem,
  insertOrg,
  insertOutreach,
  insertProposal,
  insertProspect,
  insertQuote,
  insertSolicitation,
  insertUser,
  insertVendor,
  insertVendorQuote,
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

/** Seed a fully-AWARDED solicitation with a WON proposal + a vendor-linked SELECTED quote — the honest
 *  precondition chain draftSubcontract requires before it will cascade a `contracts` row. */
async function seedAwarded(
  tx: Tx,
  opts: { withLineItem?: boolean; vendorSmallBusinessStatus?: string } = {},
): Promise<{
  orgId: string;
  solId: string;
  quoteId: string;
  vendorId: string;
  proposalId: string;
  adminId: string;
}> {
  const orgId = await insertOrg(tx);
  const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
  const vendorId = await insertVendor(tx, orgId, {
    smallBusinessStatus: opts.vendorSmallBusinessStatus ?? "SMALL",
  });
  const solId = await insertSolicitation(tx, orgId, {
    status: "AWARDED",
    sourcingApprovedBy: adminId,
    outcomeRecordedBy: adminId,
    awardDate: new Date("2026-07-01T00:00:00Z"),
    contractType: "FFP",
  });
  const quoteId = await insertVendorQuote(tx, orgId, {
    solicitationId: solId,
    vendorId,
    status: "SELECTED",
    totalPrice: "15000.00",
  });
  if (opts.withLineItem !== false) {
    await insertLineItem(tx, orgId, {
      quoteId,
      costType: "LABOR",
      contractType: "FFP",
      unitRate: "150",
      quantity: "100",
      extendedAmount: "15000.00",
    });
  }
  const proposalId = await insertProposal(tx, orgId, {
    solicitationId: solId,
    selectedQuoteId: quoteId,
    contractType: "FFP",
    status: "WON",
    submittedBy: adminId,
    counselReviewedBy: adminId,
  });
  return { orgId, solId, quoteId, vendorId, proposalId, adminId };
}

d("draftSubcontract (human-gated award cascade — creates the contract, never sends/e-signs)", () => {
  it("cascades a PENDING_SIGNATURE contract + one milestone per line item + a SUBCONTRACT_DRAFT document", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const { orgId, solId, quoteId, vendorId, adminId } = await seedAwarded(tx);

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("DRAFTED");
      if (result.status !== "DRAFTED") throw new Error("unreachable");

      const [contract] = await tx.select().from(contracts).where(eq(contracts.id, result.contractId));
      expect(contract).toBeTruthy();
      expect(contract!.solicitationId).toBe(solId);
      expect(contract!.awardedVendorId).toBe(vendorId);
      expect(contract!.status).toBe("PENDING_SIGNATURE");
      expect(contract!.esignStatus).toBe("NOT_STARTED"); // no auto-start of e-signature
      expect(contract!.agreementReviewedBy).toBeNull(); // no auto-review either
      expect(contract!.acceleratedPayments).toBe(true); // vendor is SMALL
      expect(Number(contract!.totalValue)).toBe(15000);

      const milestones = await tx
        .select()
        .from(contractMilestones)
        .where(eq(contractMilestones.contractId, result.contractId));
      expect(milestones).toHaveLength(1); // one quote line item
      expect(Number(milestones[0]!.amount)).toBe(15000);

      const docs = await tx.select().from(documents).where(eq(documents.contractId, result.contractId));
      expect(docs).toHaveLength(1);
      expect(docs[0]!.kind).toBe("SUBCONTRACT_DRAFT");
      expect(docs[0]!.entityType).toBe("CONTRACT");
      expect(docs[0]!.byteSize).toBeGreaterThan(0);

      // The winning quote's own party (vendorId) is untouched by the cascade.
      const [q] = await tx.select().from(vendorQuotes).where(eq(vendorQuotes.id, quoteId));
      expect(q!.status).toBe("SELECTED");

      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACT_DRAFTED")));
      expect(audits).toHaveLength(1);
      expect(audits[0]!.actorType).toBe("SYSTEM");
      const contractAudits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "CONTRACT_CREATED")));
      expect(contractAudits).toHaveLength(1);
    }));

  it("is idempotent: a second event drafts no second contract and returns ALREADY_DRAFTED", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const { orgId, solId, adminId } = await seedAwarded(tx);
      const args = { orgId, solicitationId: solId, awardedBy: adminId };

      const first = await draftSubcontract(tx, deps, args);
      expect(first.status).toBe("DRAFTED");
      const second = await draftSubcontract(tx, deps, args);
      expect(second.status).toBe("ALREADY_DRAFTED");

      const rows = await tx.select().from(contracts).where(eq(contracts.solicitationId, solId));
      expect(rows).toHaveLength(1);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACT_DRAFT_SKIPPED_EXISTS")));
      expect(audits).toHaveLength(1);
    }));

  it("refuses when the solicitation is not actually AWARDED (no recorded outcome = no cascade)", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, {
        status: "SUBMITTED",
        sourcingApprovedBy: adminId,
      });

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("REFUSED");

      const rows = await tx.select().from(contracts).where(eq(contracts.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(
          and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACT_DRAFT_REFUSED_NOT_AWARDED")),
        );
      expect(audits).toHaveLength(1);
    }));

  it("refuses when there is no WON proposal (award recorded out of band, no honest winner)", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, {
        status: "AWARDED",
        sourcingApprovedBy: adminId,
        outcomeRecordedBy: adminId,
      });

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("REFUSED");

      const rows = await tx.select().from(contracts).where(eq(contracts.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.orgId, orgId),
            eq(auditLog.action, "SUBCONTRACT_DRAFT_REFUSED_NO_WINNING_PROPOSAL"),
          ),
        );
      expect(audits).toHaveLength(1);
    }));

  it("refuses when the proposal's selected quote is not (or no longer) SELECTED", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const vendorId = await insertVendor(tx, orgId);
      const solId = await insertSolicitation(tx, orgId, {
        status: "AWARDED",
        sourcingApprovedBy: adminId,
        outcomeRecordedBy: adminId,
      });
      const quoteId = await insertVendorQuote(tx, orgId, {
        solicitationId: solId,
        vendorId,
        status: "SHORTLISTED", // not SELECTED
      });
      await insertProposal(tx, orgId, {
        solicitationId: solId,
        selectedQuoteId: quoteId,
        status: "WON",
        submittedBy: adminId,
        counselReviewedBy: adminId,
      });

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("REFUSED");
      const rows = await tx.select().from(contracts).where(eq(contracts.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACT_DRAFT_REFUSED_NO_WINNER")));
      expect(audits).toHaveLength(1);
    }));

  it("fails closed when the winning quote's party is a prospect never promoted to a vetted vendor", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, {
        status: "AWARDED",
        sourcingApprovedBy: adminId,
        outcomeRecordedBy: adminId,
        contractType: "FFP",
      });
      const prospectId = await insertProspect(tx, orgId);
      const quoteId = await insertQuote(tx, orgId, {
        solicitationId: solId,
        prospectId,
        status: "SELECTED",
      });
      await insertLineItem(tx, orgId, { quoteId, costType: "LABOR", contractType: "FFP" });
      await insertProposal(tx, orgId, {
        solicitationId: solId,
        selectedQuoteId: quoteId,
        contractType: "FFP",
        status: "WON",
        submittedBy: adminId,
        counselReviewedBy: adminId,
      });

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("FAILED_CLOSED");
      const rows = await tx.select().from(contracts).where(eq(contracts.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACT_DRAFT_FAILED_CLOSED")));
      expect(audits[0]!.after).toMatchObject({ stage: "vendor_not_vetted" });
    }));

  it("fails closed when the selected quote has no line items (no payment schedule to build)", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const { orgId, solId, adminId } = await seedAwarded(tx, { withLineItem: false });

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("FAILED_CLOSED");
      const rows = await tx.select().from(contracts).where(eq(contracts.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACT_DRAFT_FAILED_CLOSED")));
      expect(audits[0]!.after).toMatchObject({ stage: "no_line_items" });
    }));

  it("fails closed (no contract row) when the model output cannot be validated", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps({
        draftSubcontractAgreement: async () => {
          throw new FailClosedError("SubcontractNarrative", "schema mismatch");
        },
      });
      const { orgId, solId, adminId } = await seedAwarded(tx);

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("FAILED_CLOSED");
      const rows = await tx.select().from(contracts).where(eq(contracts.solicitationId, solId));
      expect(rows).toHaveLength(0);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACT_DRAFT_FAILED_CLOSED")));
      expect(audits[0]!.after).toMatchObject({ stage: "SubcontractNarrative" });
    }));

  it("accelerated payments defaults false only for a confirmed non-small vendor", () =>
    withRollbackTx(async (tx) => {
      const { deps } = makeDeps();
      const { orgId, solId, adminId } = await seedAwarded(tx, {
        vendorSmallBusinessStatus: "OTHER_THAN_SMALL",
      });

      const result = await draftSubcontract(tx, deps, { orgId, solicitationId: solId, awardedBy: adminId });
      expect(result.status).toBe("DRAFTED");
      if (result.status !== "DRAFTED") throw new Error("unreachable");
      const [contract] = await tx.select().from(contracts).where(eq(contracts.id, result.contractId));
      expect(contract!.acceleratedPayments).toBe(false);
    }));
});

d("sendLossNotification (§3.1 item 5 — sends only an admin-approved, previously-queued notice)", () => {
  it("REFUSES to send when nothing was queued for this quote", () =>
    withRollbackTx(async (tx) => {
      const { sendLossNotificationEmail } = makeDeps();
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });

      const result = await sendLossNotification(
        tx,
        { sendLossNotificationEmail },
        { orgId, quoteId: "00000000-0000-0000-0000-000000000000", approvedBy: adminId, approverEmail: null },
      );
      expect(result.status).toBe("SKIPPED");
      expect(sendLossNotificationEmail).not.toHaveBeenCalled();
    }));

  it("sends the queued notification once approved, and records LOSS_NOTIFICATION_SENT", () =>
    withRollbackTx(async (tx) => {
      const { sendLossNotificationEmail } = makeDeps();
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const vendorId = await insertVendor(tx, orgId);
      const solId = await insertSolicitation(tx, orgId, { sourcingApprovedBy: adminId });
      const quoteId = await insertVendorQuote(tx, orgId, {
        solicitationId: solId,
        vendorId,
        status: "REJECTED",
      });
      // Simulate the selectQuote cascade's queued audit row (a real one is written by the web action).
      await tx.insert(auditLog).values({
        orgId,
        actorType: "SYSTEM",
        action: "LOSS_NOTIFICATION_QUEUED",
        entityType: "vendor_quotes",
        entityId: quoteId,
        after: { to: "loser@example.test", companyName: "Loser Co", solicitationTitle: "Test RFQ" },
      });

      const result = await sendLossNotification(
        tx,
        { sendLossNotificationEmail },
        { orgId, quoteId, approvedBy: adminId, approverEmail: "admin@example.test" },
      );
      expect(result.status).toBe("SENT");
      expect(sendLossNotificationEmail).toHaveBeenCalledTimes(1);
      expect(sendLossNotificationEmail.mock.calls[0]![0]).toMatchObject({
        to: "loser@example.test",
        companyName: "Loser Co",
        solicitationTitle: "Test RFQ",
      });

      const sentAudits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "LOSS_NOTIFICATION_SENT")));
      expect(sentAudits).toHaveLength(1);
      expect(sentAudits[0]!.actorType).toBe("ADMIN");
      expect(sentAudits[0]!.actorUserId).toBe(adminId);
    }));

  it("is idempotent: a second approval click does NOT resend (already-sent guard)", () =>
    withRollbackTx(async (tx) => {
      const { sendLossNotificationEmail } = makeDeps();
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const vendorId = await insertVendor(tx, orgId);
      const solId = await insertSolicitation(tx, orgId, { sourcingApprovedBy: adminId });
      const quoteId = await insertVendorQuote(tx, orgId, {
        solicitationId: solId,
        vendorId,
        status: "REJECTED",
      });
      await tx.insert(auditLog).values({
        orgId,
        actorType: "SYSTEM",
        action: "LOSS_NOTIFICATION_QUEUED",
        entityType: "vendor_quotes",
        entityId: quoteId,
        after: { to: "loser@example.test", companyName: "Loser Co", solicitationTitle: "Test RFQ" },
      });

      const args = { orgId, quoteId, approvedBy: adminId, approverEmail: null };
      const first = await sendLossNotification(tx, { sendLossNotificationEmail }, args);
      expect(first.status).toBe("SENT");
      const second = await sendLossNotification(tx, { sendLossNotificationEmail }, args);
      expect(second.status).toBe("SKIPPED");
      expect(sendLossNotificationEmail).toHaveBeenCalledTimes(1);
    }));

  it("fails closed on a Resend error (e.g. no RESEND_API_KEY) without crashing the admin's click, and stays retryable", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const vendorId = await insertVendor(tx, orgId);
      const solId = await insertSolicitation(tx, orgId, { sourcingApprovedBy: adminId });
      const quoteId = await insertVendorQuote(tx, orgId, {
        solicitationId: solId,
        vendorId,
        status: "REJECTED",
      });
      await tx.insert(auditLog).values({
        orgId,
        actorType: "SYSTEM",
        action: "LOSS_NOTIFICATION_QUEUED",
        entityType: "vendor_quotes",
        entityId: quoteId,
        after: { to: "loser@example.test", companyName: "Loser Co", solicitationTitle: "Test RFQ" },
      });

      const args = { orgId, quoteId, approvedBy: adminId, approverEmail: null };
      const failing = vi.fn(async () => {
        throw new Error("RESEND_API_KEY is not configured.");
      });
      const failed = await sendLossNotification(tx, { sendLossNotificationEmail: failing }, args);
      expect(failed.status).toBe("FAILED");

      const failedAudits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "LOSS_NOTIFICATION_SEND_FAILED")));
      expect(failedAudits).toHaveLength(1);
      const sentAudits = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "LOSS_NOTIFICATION_SENT")));
      expect(sentAudits).toHaveLength(0); // never falsely marked sent

      // A later retry (e.g. once Resend is configured) still succeeds — the item was never consumed.
      const { sendLossNotificationEmail: succeeding } = makeDeps();
      const retried = await sendLossNotification(tx, { sendLossNotificationEmail: succeeding }, args);
      expect(retried.status).toBe("SENT");
    }));
});
