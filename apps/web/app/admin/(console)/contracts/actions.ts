"use server";

/**
 * /admin/contracts/[id] — the §3.3 financial-flow actions. Two DISTINCT record types, never one
 * ambiguous bucket (spec of record §3.3):
 *   - invoices: money coming IN from the government (or a teaming partner). `paidAt`, set here ONLY when
 *     an admin explicitly confirms the government has actually paid, is the revenue-recognition point AND
 *     the clock source for any linked subcontractor payable.
 *   - subcontractor_payables: money owed OUT to the firm's own sub. The Prompt-Payment due date is NEVER
 *     stored — it is derived at read time (see the contracts/[id] page) from the linked invoice's paidAt.
 * Every write re-checks the admin session, runs inside an org-scoped transaction, and writes an audit row
 * (CLAUDE.md §7). Nothing here contacts a third party or auto-advances state (§2) — these are internal
 * bookkeeping records the admin enters after confirming what actually happened.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  and,
  contracts,
  eq,
  invoices,
  pastPerformanceRecords,
  subcontractorPayables,
  withOrg,
} from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(formData: FormData, key: string): string {
  const id = String(formData.get(key) ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${key}`);
  return id;
}

function readOptionalId(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!UUID_RE.test(raw)) throw new Error(`Invalid ${key}`);
  return raw;
}

function revalidateContract(contractId: string): void {
  revalidatePath(`/admin/contracts/${contractId}`);
  revalidatePath("/admin/contracts");
  revalidatePath("/admin/financials");
  revalidatePath("/admin");
}

/* ------------------------------- Government invoices (receivables) ------------------------------- */

const recordInvoiceSchema = z.object({
  contractId: z.string().regex(UUID_RE),
  milestoneId: z.string().optional(),
  kind: z.enum(["PROGRESS", "FINAL"]),
  amount: z.coerce.number().nonnegative(),
  invoiceNumber: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(2000).optional(),
});

/** Record a NEW government invoice (DRAFT). Never auto-submitted — a separate explicit action does that. */
export async function recordInvoice(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const parsed = recordInvoiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const f = parsed.data;
  const milestoneId = f.milestoneId && UUID_RE.test(f.milestoneId) ? f.milestoneId : null;

  await withOrg(orgId, async (tx) => {
    const [contract] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, f.contractId)))
      .limit(1);
    if (!contract) return;

    const [row] = await tx
      .insert(invoices)
      .values({
        orgId,
        contractId: f.contractId,
        milestoneId,
        invoiceNumber: f.invoiceNumber,
        kind: f.kind,
        amount: f.amount.toFixed(2),
        status: "DRAFT",
        notes: f.notes || null,
      })
      .returning({ id: invoices.id });

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "INVOICE_RECORDED",
      entityType: "invoices",
      entityId: row!.id,
      after: { contractId: f.contractId, kind: f.kind, amount: f.amount },
    });
  });

  revalidateContract(f.contractId);
}

/** Confirm the invoice has actually been SUBMITTED to the government. Starts the government's own 14/30-day clock. */
export async function markInvoiceSubmitted(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const invoiceId = readId(formData, "invoiceId");
  const contractId = readId(formData, "contractId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(invoices)
      .set({ status: "SUBMITTED", submittedAt: new Date() })
      .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId), eq(invoices.status, "DRAFT")))
      .returning({ id: invoices.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "INVOICE_SUBMITTED",
      entityType: "invoices",
      entityId: invoiceId,
    });
  });

  revalidateContract(contractId);
}

/**
 * Confirm the government has ACTUALLY PAID this invoice. This is the load-bearing write of §3.3: paidAt
 * is the firm's revenue-recognition point and — via any linked subcontractor payable — the Prompt-Payment
 * clock source for what the firm now owes its own sub.
 */
export async function markInvoicePaid(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const invoiceId = readId(formData, "invoiceId");
  const contractId = readId(formData, "contractId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(invoices)
      .set({ status: "PAID", paidAt: new Date() })
      .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId), eq(invoices.status, "SUBMITTED")))
      .returning({ id: invoices.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "INVOICE_PAID",
      entityType: "invoices",
      entityId: invoiceId,
    });
  });

  revalidateContract(contractId);
}

/* ------------------------------- Subcontractor payables ------------------------------- */

const recordPayableSchema = z.object({
  contractId: z.string().regex(UUID_RE),
  milestoneId: z.string().optional(),
  governmentInvoiceId: z.string().optional(),
  amount: z.coerce.number().nonnegative(),
});

/** Record what's owed to the vendor per milestone. governmentInvoiceId is OPTIONAL at creation — leave
 *  it unset ("not yet linked") rather than guessing; link it once the actual invoice is known. */
export async function recordPayable(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const parsed = recordPayableSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const f = parsed.data;
  const milestoneId = f.milestoneId && UUID_RE.test(f.milestoneId) ? f.milestoneId : null;
  const governmentInvoiceId =
    f.governmentInvoiceId && UUID_RE.test(f.governmentInvoiceId) ? f.governmentInvoiceId : null;

  await withOrg(orgId, async (tx) => {
    const [contract] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, f.contractId)))
      .limit(1);
    if (!contract) return;

    const [row] = await tx
      .insert(subcontractorPayables)
      .values({
        orgId,
        contractId: f.contractId,
        milestoneId,
        governmentInvoiceId,
        amount: f.amount.toFixed(2),
        status: "PENDING",
      })
      .returning({ id: subcontractorPayables.id });

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "PAYABLE_RECORDED",
      entityType: "subcontractor_payables",
      entityId: row!.id,
      after: { contractId: f.contractId, amount: f.amount, governmentInvoiceId },
    });
  });

  revalidateContract(f.contractId);
}

/**
 * Link (or re-point, while still PENDING) the government invoice that starts this payable's Prompt-
 * Payment clock. Decision 8: this is the ONLY way a payable's deadline clock starts — never inferred.
 */
export async function linkPayableInvoice(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const payableId = readId(formData, "payableId");
  const contractId = readId(formData, "contractId");
  const governmentInvoiceId = readOptionalId(formData, "governmentInvoiceId");
  if (!governmentInvoiceId) return;

  await withOrg(orgId, async (tx) => {
    // The invoice must exist in this org (and belong to the same contract — the FK/CHECK backstop is on
    // the DB side; this keeps the UI honest without an extra round trip failure).
    const [invoiceRow] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(eq(invoices.orgId, orgId), eq(invoices.id, governmentInvoiceId), eq(invoices.contractId, contractId)),
      )
      .limit(1);
    if (!invoiceRow) return;

    const rows = await tx
      .update(subcontractorPayables)
      .set({ governmentInvoiceId })
      .where(
        and(
          eq(subcontractorPayables.orgId, orgId),
          eq(subcontractorPayables.id, payableId),
          eq(subcontractorPayables.status, "PENDING"),
        ),
      )
      .returning({ id: subcontractorPayables.id });
    if (rows.length === 0) return;

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "PAYABLE_INVOICE_LINKED",
      entityType: "subcontractor_payables",
      entityId: payableId,
      after: { governmentInvoiceId },
    });
  });

  revalidateContract(contractId);
}

/** Confirm the sub was ACTUALLY paid. */
export async function markPayablePaid(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const payableId = readId(formData, "payableId");
  const contractId = readId(formData, "contractId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(subcontractorPayables)
      .set({ status: "PAID", paidAt: new Date() })
      .where(
        and(
          eq(subcontractorPayables.orgId, orgId),
          eq(subcontractorPayables.id, payableId),
          eq(subcontractorPayables.status, "PENDING"),
        ),
      )
      .returning({ id: subcontractorPayables.id });
    if (rows.length === 0) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "PAYABLE_PAID",
      entityType: "subcontractor_payables",
      entityId: payableId,
    });
  });

  revalidateContract(contractId);
}

/* ------------------------------- CPARS / past-performance capture ------------------------------- */

const recordCparsSchema = z.object({
  contractId: z.string().regex(UUID_RE),
  rating: z.enum(["EXCEPTIONAL", "VERY_GOOD", "SATISFACTORY", "MARGINAL", "UNSATISFACTORY"]),
  narrative: z.string().trim().max(5000).optional(),
  ratingPeriodStart: z.string().optional(),
  ratingPeriodEnd: z.string().optional(),
  evaluatorName: z.string().trim().max(200).optional(),
  evaluatorEmail: z.string().trim().email().max(254).or(z.literal("")).optional(),
});

/**
 * Capture an actual past-performance rating/narrative — typically recorded at contract closeout, but not
 * hard-gated on contract status (an interim/annual CPARS-style evaluation can also be recorded). Feeds
 * the §5.1 win/loss-learning retrieval work: right now this is the ONLY performance-quality signal.
 */
export async function recordCparsRating(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const parsed = recordCparsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const f = parsed.data;

  await withOrg(orgId, async (tx) => {
    const [contract] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, f.contractId)))
      .limit(1);
    if (!contract) return;

    const [row] = await tx
      .insert(pastPerformanceRecords)
      .values({
        orgId,
        contractId: f.contractId,
        rating: f.rating,
        narrative: f.narrative || null,
        ratingPeriodStart: f.ratingPeriodStart ? new Date(f.ratingPeriodStart) : null,
        ratingPeriodEnd: f.ratingPeriodEnd ? new Date(f.ratingPeriodEnd) : null,
        evaluatorName: f.evaluatorName || null,
        evaluatorEmail: f.evaluatorEmail || null,
        recordedBy: session.user.id,
      })
      .returning({ id: pastPerformanceRecords.id });

    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "CPARS_RECORDED",
      entityType: "past_performance_records",
      entityId: row!.id,
      after: { contractId: f.contractId, rating: f.rating },
    });
  });

  revalidateContract(f.contractId);
}
