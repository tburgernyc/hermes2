"use server";

/**
 * The LOGGED-IN vendor quote-submission action (Phase-6 PR K) — the authenticated mirror of the public
 * tokenized path (app/quote/[token]/actions.ts). It is safe because of what it does NOT trust:
 *   • vendorId comes from the SERVER session linkage (requireVendorWithVendorId), NEVER from the form —
 *     a vendor can only ever submit AS ITSELF (§7). The RESTRICTIVE _vendor_scope WITH CHECK (0009) is
 *     the structural backstop even if this code were wrong.
 *   • orgId comes from the session; the solicitation is re-validated in-tx to be an OPEN in-org RFQ
 *     (RLS confines it to the org; OPEN_RFQ_STATUSES — the same window the browse page filters on — is
 *     the status gate). A spoofed solicitationId can at worst name another in-org RFQ the vendor is
 *     already allowed to quote; cross-org is impossible (the hermes_vendor org policy).
 *   • the file is validated by MAGIC BYTES before storage; the client name/MIME is ignored.
 * Everything is ONE atomic withVendorRole transaction (quote + lines + document + audit). This is NOT a
 * Prime-Directive (§2) action: a logged-in human submits their OWN quote (status SUBMITTED) — it does
 * not advance the firm's workflow or commit the firm; the admin still shortlists/selects. No model runs.
 */
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { UploadError, getStorage, validateUpload, vendorQuoteDocumentKey } from "@hermes/core";
import {
  and,
  documents,
  eq,
  solicitations,
  vendorQuoteLineItems,
  vendorQuotes,
  withVendorRole,
} from "@hermes/db";
import { inngest, writeAudit } from "@hermes/inngest";

import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { OPEN_RFQ_STATUSES, type SolicitationStatus } from "@/lib/portal";
import { rateLimit } from "@/lib/rate-limit";

const MAX_LINE_ITEMS = 8;

/** The solicitation is not currently accepting quotes (not found in-org, or past the sourcing window). */
class SubmitClosedError extends Error {}

const lineItemSchema = z.object({
  costType: z.enum(["LABOR", "MATERIAL", "ODC", "SUBCONTRACT", "TRAVEL"]),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().finite(),
  unitRate: z.coerce.number().nonnegative().finite(),
});
type LineItem = z.infer<typeof lineItemSchema>;

const detailsSchema = z.object({
  periodOfPerformance: z.string().trim().max(200).optional(),
  payWhenPaid: z.boolean(),
  notes: z.string().trim().max(5000).optional(),
});

/** Parse up to MAX_LINE_ITEMS fixed indexed rows; blank rows (no description) are skipped. */
function parseLineItems(formData: FormData): LineItem[] {
  const items: LineItem[] = [];
  for (let i = 0; i < MAX_LINE_ITEMS; i++) {
    const description = String(formData.get(`description_${i}`) ?? "").trim();
    if (!description) continue;
    items.push(
      lineItemSchema.parse({
        costType: formData.get(`costType_${i}`),
        description,
        quantity: formData.get(`quantity_${i}`),
        unitRate: formData.get(`unitRate_${i}`),
      }),
    );
  }
  if (items.length === 0) throw new z.ZodError([]);
  return items;
}

function extendedAmount(item: LineItem): number {
  return item.quantity * item.unitRate;
}

/** Extract a Postgres SQLSTATE, unwrapping drizzle's DrizzleQueryError (the pg error is on `.cause`). */
function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = (err as { code?: string }).code;
  if (typeof direct === "string") return direct;
  const cause = (err as { cause?: { code?: string } }).cause;
  return typeof cause?.code === "string" ? cause.code : undefined;
}

export async function submitQuote(formData: FormData): Promise<void> {
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;
  const rawSolId = String(formData.get("solicitationId") ?? "");
  const redirectTo = (status: string): never =>
    redirect(`/portal/solicitations/${encodeURIComponent(rawSolId)}/quote?status=${status}`);

  // Throttle by the authenticated user (the public path keys by IP; here we have a session).
  if (!rateLimit(`vendor-submit:${session.user.id}`)) redirectTo("throttled");

  let status = "submitted";
  try {
    const solId = z.string().uuid().parse(rawSolId);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new UploadError("A quote document is required");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = validateUpload(bytes);
    const lineItems = parseLineItems(formData);
    const details = detailsSchema.parse({
      periodOfPerformance: formData.get("periodOfPerformance") || undefined,
      payWhenPaid: formData.get("payWhenPaid") === "on",
      notes: formData.get("notes") || undefined,
    });

    const quoteId = randomUUID(); // app-side (uniform with the tokenized path; no RLS-on-RETURNING edge)
    const total = lineItems.reduce((sum, li) => sum + extendedAmount(li), 0).toFixed(2);

    // Store the bytes FIRST (an orphan blob on a later failure is harmless; a doc row never dangles).
    const key = vendorQuoteDocumentKey(orgId, vendorId, quoteId, upload.detectedType);
    await getStorage().put(key, bytes, upload.contentType);

    // ONE atomic, vendor-scoped, low-trust transaction (the GUC-empty-string footgun fails closed).
    await withVendorRole(orgId, vendorId, async (tx) => {
      const solRows = await tx
        .select({ contractType: solicitations.contractType, status: solicitations.status })
        .from(solicitations)
        .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solId)))
        .limit(1);
      const sol = solRows[0];
      // Not found (or cross-org, hidden by RLS) OR not in the quotable window ⇒ refuse.
      if (!sol) throw new SubmitClosedError("solicitation not available");
      if (!OPEN_RFQ_STATUSES.includes(sol.status as SolicitationStatus))
        throw new SubmitClosedError("solicitation is not accepting quotes");
      const contractType = sol.contractType ?? "FFP"; // the line-item trigger overrides when known

      await tx.insert(vendorQuotes).values({
        id: quoteId,
        orgId,
        solicitationId: solId,
        vendorId, // the SERVER-resolved session vendor — never the form
        prospectId: null, // a logged-in submit is vendor-scoped (party XOR + RLS WITH CHECK)
        tokenJti: null, // no token in the logged-in path
        status: "SUBMITTED",
        totalPrice: total,
        periodOfPerformance: details.periodOfPerformance ?? null,
        payWhenPaid: details.payWhenPaid,
        notes: details.notes ?? null, // UNTRUSTED free text — fenced as data downstream in @hermes/ai
      });

      for (const li of lineItems) {
        await tx.insert(vendorQuoteLineItems).values({
          orgId,
          quoteId,
          costType: li.costType,
          contractType, // BEFORE-INSERT trigger re-syncs this from the solicitation authoritatively
          description: li.description,
          quantity: String(li.quantity),
          unitRate: li.unitRate.toFixed(2),
          extendedAmount: extendedAmount(li).toFixed(2),
        });
      }

      await tx.insert(documents).values({
        orgId,
        entityType: "VENDOR_QUOTE", // owned by the quote (documents_owner_matches_type)
        quoteId,
        kind: "QUOTE",
        storageKey: key,
        contentType: upload.contentType,
        byteSize: upload.byteSize,
        sha256: upload.sha256,
        magicByteValidated: true,
      });

      await writeAudit(tx, {
        orgId,
        actorType: "VENDOR",
        actorUserId: session.user.id, // a known logged-in user (non-repudiation)
        actorEmail: session.user.email ?? null,
        action: "QUOTE_SUBMITTED",
        entityType: "vendor_quotes",
        entityId: quoteId,
      });
    });

    // Notify the pipeline (fire-and-forget). The */15m quote-detector cron is the ranking fallback, so a
    // transient Inngest outage must never 500 a durably-saved submission.
    try {
      await inngest.send({
        name: "hermes/quote.submitted",
        data: { orgId, solicitationId: solId, quoteId },
      });
    } catch {
      // swallow: the quote is committed; ranking is also driven by the cron fallback.
    }
  } catch (err) {
    const code = pgErrorCode(err);
    if (code === "23505")
      status = "duplicate"; // one-active-quote partial unique index (already submitted)
    else if (err instanceof SubmitClosedError) status = "closed";
    else if (err instanceof UploadError) status = "badfile";
    else if (err instanceof z.ZodError) status = "invalid";
    else {
      status = "error";
      console.error(
        "vendor submitQuote failed",
        err instanceof Error ? err.message : String(err),
        code ?? "",
      );
    }
  }

  redirectTo(status);
}
