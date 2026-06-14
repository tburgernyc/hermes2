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
import { describe, expect, it } from "vitest";

import { FailClosedError } from "@hermes/ai";
import { and, auditLog, eq, outreachCampaigns, solicitations, vendorQuotes } from "@hermes/db";

import { onSourcingApproved, rankQuotes, sendOutreach, triage } from "../src/logic.js";
import { HAS_DB, withRollbackTx } from "./helpers/db.js";
import {
  insertOrg,
  insertOutreach,
  insertProspect,
  insertQuote,
  insertSolicitation,
  insertUser,
} from "./helpers/fixtures.js";
import { makeDeps } from "./helpers/mocks.js";

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
