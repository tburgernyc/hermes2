/**
 * DB-backed §3.3 test suite — proves the two distinct money-flow records (invoices vs. subcontractor
 * payables), the payment-deadline calculation actually DERIVING from the recorded government-payment
 * date (Decision 10/8), the 60/30-day SAM registration reminder (Decision-of-record: same cron pattern
 * as monitorDeadlines/runArFollowups), CPARS capture, and the AI-usage rollup.
 */
import { describe, expect, it } from "vitest";

import { aiUsageEvents, eq, pastPerformanceRecords } from "@hermes/db";

import { monitorPayablesAtRisk, monitorSamRegistration, recordAiUsageEvent } from "../src/logic.js";
import { HAS_DB, withRollbackTx } from "./helpers/db.js";
import {
  insertContract,
  insertInvoice,
  insertOrg,
  insertPastPerformanceRecord,
  insertPayable,
  insertUser,
} from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;
const NOW = new Date("2026-08-01T12:00:00Z");

d("recordAiUsageEvent + AI-spend rollup (§3.3 AI cost observability)", () => {
  it("persists model/function/token counts and a non-negative estimated cost for a recognized model", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      await recordAiUsageEvent(tx, orgId, {
        model: "claude-sonnet-4-6",
        functionName: "TriageVerdict",
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 50,
        cacheWriteTokens: 10,
      });

      const rows = await tx.select().from(aiUsageEvents).where(eq(aiUsageEvents.orgId, orgId));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        model: "claude-sonnet-4-6",
        functionName: "TriageVerdict",
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 50,
        cacheWriteTokens: 10,
      });
      expect(Number(rows[0]!.estimatedCostUsd)).toBeGreaterThan(0);
    }));

  it("never fabricates a cost for an unrecognized model — estimatedCostUsd is null", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      await recordAiUsageEvent(tx, orgId, {
        model: "some-future-unpriced-model",
        functionName: "TriageVerdict",
        inputTokens: 10,
        outputTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      const [row] = await tx.select().from(aiUsageEvents).where(eq(aiUsageEvents.orgId, orgId));
      expect(row!.estimatedCostUsd).toBeNull();
    }));

  it("rolls up to a daily total across multiple calls (the admin-dashboard query shape)", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      for (let i = 0; i < 3; i++) {
        await recordAiUsageEvent(tx, orgId, {
          model: "claude-haiku-4-5",
          functionName: `call-${i}`,
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        });
      }
      const rows = await tx.select().from(aiUsageEvents).where(eq(aiUsageEvents.orgId, orgId));
      expect(rows).toHaveLength(3);
      const total = rows.reduce((sum, r) => sum + Number(r.estimatedCostUsd ?? 0), 0);
      expect(total).toBeGreaterThan(0);
    }));
});

d("monitorSamRegistration (§3.3 — SAM.gov 60/30-day reminder cadence)", () => {
  it("no registration dates set ⇒ nothing surfaced (never a fabricated countdown)", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const items = await monitorSamRegistration(tx, { orgId, now: NOW });
      expect(items).toEqual([]);
    }));

  it("an expiry 45 days out is inside the 60-day window and IS surfaced", () =>
    withRollbackTx(async (tx) => {
      const expiresAt = new Date(NOW.getTime() + 45 * 86_400_000).toISOString().slice(0, 10);
      const orgId = await insertOrg(tx, {
        registration: {
          samRegistrationActive: true,
          cageAssigned: true,
          samRegistrationExpiresAt: expiresAt,
        },
      });
      const items = await monitorSamRegistration(tx, { orgId, now: NOW });
      expect(items).toHaveLength(1);
      expect(items[0]!.label).toBe("SAM.gov registration");
      expect(items[0]!.detail).toContain("45");
    }));

  it("an expiry 90 days out is OUTSIDE the reminder window and is NOT surfaced", () =>
    withRollbackTx(async (tx) => {
      const expiresAt = new Date(NOW.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
      const orgId = await insertOrg(tx, {
        registration: {
          samRegistrationActive: true,
          cageAssigned: true,
          samRegistrationExpiresAt: expiresAt,
        },
      });
      const items = await monitorSamRegistration(tx, { orgId, now: NOW });
      expect(items).toEqual([]);
    }));

  it("an already-expired registration is surfaced as EXPIRED", () =>
    withRollbackTx(async (tx) => {
      const expiresAt = new Date(NOW.getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
      const orgId = await insertOrg(tx, {
        registration: {
          samRegistrationActive: true,
          cageAssigned: true,
          samRegistrationExpiresAt: expiresAt,
        },
      });
      const items = await monitorSamRegistration(tx, { orgId, now: NOW });
      expect(items[0]!.detail).toContain("EXPIRED");
    }));

  it("reps/certs recert due date fires independently of the SAM registration date", () =>
    withRollbackTx(async (tx) => {
      const dueAt = new Date(NOW.getTime() + 20 * 86_400_000).toISOString().slice(0, 10);
      const orgId = await insertOrg(tx, {
        registration: { samRegistrationActive: true, cageAssigned: true, repsCertsRecertDueAt: dueAt },
      });
      const items = await monitorSamRegistration(tx, { orgId, now: NOW });
      expect(items).toHaveLength(1);
      expect(items[0]!.label).toBe("Reps & certs recertification");
    }));
});

d("monitorPayablesAtRisk (§3.3 — the deadline DERIVES from the recorded government-payment date)", () => {
  it("Decision 8: a payable with NO linked government invoice is 'unknown' — never surfaced as at-risk", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const contractId = await insertContract(tx, orgId);
      await insertPayable(tx, orgId, { contractId, governmentInvoiceId: null });

      const items = await monitorPayablesAtRisk(tx, { orgId, now: NOW });
      expect(items).toEqual([]); // unknown clock — correctly excluded, not fabricated
    }));

  it("a linked invoice that has not been PAID yet also has not started its clock — excluded", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const contractId = await insertContract(tx, orgId);
      const invoiceId = await insertInvoice(tx, orgId, { contractId, paidAt: null });
      await insertPayable(tx, orgId, { contractId, governmentInvoiceId: invoiceId });

      const items = await monitorPayablesAtRisk(tx, { orgId, now: NOW });
      expect(items).toEqual([]);
    }));

  it("a recent government payment (well inside the 7-day clock) is ON_TRACK — not surfaced", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const contractId = await insertContract(tx, orgId, { acceleratedPayments: false });
      const paidAt = NOW; // due in 7 days
      const invoiceId = await insertInvoice(tx, orgId, { contractId, paidAt });
      await insertPayable(tx, orgId, { contractId, governmentInvoiceId: invoiceId });

      const items = await monitorPayablesAtRisk(tx, { orgId, now: NOW });
      expect(items).toEqual([]);
    }));

  it("DERIVES the due date from paid_at: a payment 6 days ago (7-day clock) is AT_RISK", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const contractId = await insertContract(tx, orgId, { acceleratedPayments: false });
      const paidAt = new Date(NOW.getTime() - 6 * 86_400_000); // due tomorrow
      const invoiceId = await insertInvoice(tx, orgId, { contractId, paidAt });
      await insertPayable(tx, orgId, { contractId, governmentInvoiceId: invoiceId, amount: "5000.00" });

      const items = await monitorPayablesAtRisk(tx, { orgId, now: NOW });
      expect(items).toHaveLength(1);
      expect(items[0]!.detail).toContain("at_risk");
      expect(items[0]!.detail).toContain("5000");
    }));

  it("DERIVES the due date from paid_at: a payment 10 days ago (7-day clock) is MISSED", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const contractId = await insertContract(tx, orgId, { acceleratedPayments: false });
      const paidAt = new Date(NOW.getTime() - 10 * 86_400_000);
      const invoiceId = await insertInvoice(tx, orgId, { contractId, paidAt });
      await insertPayable(tx, orgId, { contractId, governmentInvoiceId: invoiceId });

      const items = await monitorPayablesAtRisk(tx, { orgId, now: NOW });
      expect(items).toHaveLength(1);
      expect(items[0]!.detail).toContain("missed");
    }));

  it("the accelerated (15-day) clock keeps the SAME payment ON_TRACK when the 7-day clock would flag it", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const contractId = await insertContract(tx, orgId, { acceleratedPayments: true });
      const paidAt = new Date(NOW.getTime() - 6 * 86_400_000); // would be AT_RISK on the 7-day clock
      const invoiceId = await insertInvoice(tx, orgId, { contractId, paidAt });
      await insertPayable(tx, orgId, { contractId, governmentInvoiceId: invoiceId });

      const items = await monitorPayablesAtRisk(tx, { orgId, now: NOW });
      expect(items).toEqual([]); // 15-day accelerated clock: due in 9 days, well ON_TRACK
    }));

  it("a payable already marked PAID is excluded regardless of how late the underlying dates look", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const contractId = await insertContract(tx, orgId, { acceleratedPayments: false });
      const paidAt = new Date(NOW.getTime() - 30 * 86_400_000);
      const invoiceId = await insertInvoice(tx, orgId, { contractId, paidAt });
      await insertPayable(tx, orgId, {
        contractId,
        governmentInvoiceId: invoiceId,
        status: "PAID",
        paidAt: NOW,
      });

      const items = await monitorPayablesAtRisk(tx, { orgId, now: NOW });
      expect(items).toEqual([]);
    }));
});

d("CPARS past-performance capture (§3.3 — feeds the §5.1 win/loss-learning retrieval)", () => {
  it("records a rating + narrative at contract closeout and reads it back", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const contractId = await insertContract(tx, orgId, { status: "CLOSED_OUT" });

      const recordId = await insertPastPerformanceRecord(tx, orgId, {
        contractId,
        recordedBy: adminId,
        rating: "VERY_GOOD",
        narrative: "Delivered on time and under budget; strong technical execution.",
      });

      const [row] = await tx
        .select()
        .from(pastPerformanceRecords)
        .where(eq(pastPerformanceRecords.id, recordId));
      expect(row).toMatchObject({
        orgId,
        contractId,
        rating: "VERY_GOOD",
        recordedBy: adminId,
      });
      expect(row!.narrative).toContain("under budget");
    }));

  it("supports multiple ratings on the same contract over time (period-scoped rows, not a single field)", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const adminId = await insertUser(tx, orgId, { role: "ADMIN" });
      const contractId = await insertContract(tx, orgId);

      await insertPastPerformanceRecord(tx, orgId, { contractId, recordedBy: adminId, rating: "SATISFACTORY" });
      await insertPastPerformanceRecord(tx, orgId, { contractId, recordedBy: adminId, rating: "EXCEPTIONAL" });

      const rows = await tx
        .select()
        .from(pastPerformanceRecords)
        .where(eq(pastPerformanceRecords.contractId, contractId));
      expect(rows).toHaveLength(2);
    }));
});
