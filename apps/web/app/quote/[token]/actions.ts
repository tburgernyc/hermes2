"use server";

/**
 * The tokenized quote-submission action — a PUBLIC, no-account write (CLAUDE.md §7). It is safe ONLY
 * because of what it does NOT trust:
 *   • org / prospect / solicitation come from the SERVER-VERIFIED token, never from the form.
 *   • vendor_id is ALWAYS null — a tokenized write can never name (or become) a vetted vendor.
 *   • the write runs under withTokenRole → the low-trust hermes_token DB role, whose RESTRICTIVE RLS
 *     policy physically allows only prospect-scoped quotes + VENDOR_PROSPECT documents.
 *   • the file is validated by magic bytes BEFORE storage; the client-declared name/MIME is ignored.
 *   • the token's jti is recorded as token_jti → the (org_id, token_jti) unique index blocks replay.
 * Everything is one atomic transaction (quote + line items + document + audit); a replay or any failure
 * rolls the whole thing back. The result is surfaced via a redirect status (no JS required).
 */
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  TokenError,
  UploadError,
  getStorage,
  quoteDocumentKey,
  validateUpload,
  verifyToken,
} from "@hermes/core";
import {
  and,
  documents,
  eq,
  solicitations,
  vendorProspects,
  vendorQuoteLineItems,
  vendorQuotes,
  withTokenRole,
} from "@hermes/db";
import { inngest, writeAudit } from "@hermes/inngest";

import { clientKey, rateLimit } from "@/lib/rate-limit";

const MAX_LINE_ITEMS = 8;

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
  const token = String(formData.get("token") ?? "");
  const hdrs = await headers();
  let status = "submitted";

  if (!rateLimit(clientKey(hdrs.get("fly-client-ip"), hdrs.get("x-forwarded-for"), "quote"))) {
    redirect(`/quote/${encodeURIComponent(token)}?status=throttled`);
  }

  try {
    // 1. Authorize: re-verify the signed token server-side for THIS purpose. Never trust the client.
    const payload = verifyToken(token, "QUOTE_SUBMISSION");
    if (!payload.sol) throw new Error("token missing solicitation scope");

    // 2. Validate the upload by content (magic bytes + size), then parse the structured fields.
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

    const quoteId = randomUUID(); // app-side: hermes_token has INSERT but not SELECT (no RETURNING)
    const total = lineItems.reduce((sum, li) => sum + extendedAmount(li), 0).toFixed(2);

    // 3. Store the bytes FIRST (an orphan blob on a later failure is harmless; a doc row never dangles).
    const key = quoteDocumentKey(payload.org, payload.prospect, quoteId, upload.detectedType);
    await getStorage().put(key, bytes, upload.contentType);

    // 4. One atomic, prospect-scoped, low-trust transaction.
    await withTokenRole(payload.org, async (tx) => {
      const prospectRows = await tx
        .select({ email: vendorProspects.contactEmail })
        .from(vendorProspects)
        .where(and(eq(vendorProspects.orgId, payload.org), eq(vendorProspects.id, payload.prospect)))
        .limit(1);
      if (prospectRows.length === 0) throw new Error("prospect not found for token");

      const solRows = await tx
        .select({ contractType: solicitations.contractType })
        .from(solicitations)
        .where(and(eq(solicitations.orgId, payload.org), eq(solicitations.id, payload.sol!)))
        .limit(1);
      const contractType = solRows[0]?.contractType ?? "FFP"; // trigger overrides if the sol type is known

      await tx.insert(vendorQuotes).values({
        id: quoteId,
        orgId: payload.org,
        solicitationId: payload.sol!,
        vendorId: null, // NEVER from the client — the structural trust boundary
        prospectId: payload.prospect,
        tokenJti: payload.jti, // replay guard via the (org_id, token_jti) unique index
        status: "SUBMITTED",
        totalPrice: total,
        periodOfPerformance: details.periodOfPerformance ?? null,
        payWhenPaid: details.payWhenPaid,
        notes: details.notes ?? null, // UNTRUSTED free text — fenced as data downstream in @hermes/ai
      });

      for (const li of lineItems) {
        await tx.insert(vendorQuoteLineItems).values({
          orgId: payload.org,
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
        orgId: payload.org,
        entityType: "VENDOR_PROSPECT", // the only entity_type the token RLS policy permits
        prospectId: payload.prospect,
        kind: "QUOTE",
        storageKey: key,
        contentType: upload.contentType,
        byteSize: upload.byteSize,
        sha256: upload.sha256,
        magicByteValidated: true,
      });

      await writeAudit(tx, {
        orgId: payload.org,
        actorType: "TOKEN",
        // A TOKEN actor must be attributable (audit_log_attributable CHECK): use the prospect's email
        // when known, else the token's jti — never null, or the whole submission would roll back.
        actorEmail: prospectRows[0]?.email ?? `token-jti:${payload.jti}`,
        action: "QUOTE_SUBMITTED",
        entityType: "vendor_quotes",
        entityId: quoteId,
      });
    });

    // 5. Notify the pipeline (fire-and-forget). If this fails, the */15m quote-detector cron still
    //    picks up the unranked quote — so a transient Inngest outage must not 500 a saved submission.
    try {
      await inngest.send({
        name: "hermes/quote.submitted",
        data: { orgId: payload.org, solicitationId: payload.sol, quoteId },
      });
    } catch {
      // swallow: the quote is durably saved; ranking is driven by a cron fallback too.
    }
  } catch (err) {
    const code = pgErrorCode(err);
    if (code === "23505") status = "duplicate"; // (org_id, token_jti) replay guard
    else if (err instanceof UploadError) status = "badfile";
    else if (err instanceof TokenError || err instanceof z.ZodError) status = "invalid";
    else {
      status = "error";
      // Log server-side (never leak details to the vendor); the quote was NOT saved.
      console.error("submitQuote failed", err instanceof Error ? err.message : String(err), code ?? "");
    }
  }

  redirect(`/quote/${encodeURIComponent(token)}?status=${status}`);
}
