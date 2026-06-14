"use server";
/**
 * apps/web/app/quote/[token]/actions.ts
 *
 * Server Actions for the NO-ACCOUNT portal pages. The signed token IS the authorization — there is no
 * session here. Therefore the security rules are absolute:
 *
 *   1. The token is verified for the EXACT purpose of the route (quote vs optout). A wrong-purpose token throws.
 *   2. A tokenized submission may write ONLY a prospect-scoped row. It NEVER writes or updates a vetted
 *      `vendors` record, and it NEVER accepts a vendorId/orgId/prospectId from the client — all scope comes
 *      from the verified token payload.
 *   3. Uploads are validated by magic bytes and size before storage.
 *
 * These rules are what the Phase 5 negative tests assert (public quote can't mutate a vetted vendor;
 * opt-out token can't submit a quote; oversized/non-PDF rejected).
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@hermes/db";
import { vendorQuotes, vendorProspects, documents, auditLog } from "@hermes/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, TokenError } from "@hermes/core/tokens";
import { validateUpload, putToTigris, UploadError } from "@hermes/core/upload";
import { inngest } from "@/inngest/client";

const QuoteSubmission = z.object({
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        qty: z.number().positive(),
        unit: z.string().min(1),
        unitRate: z.string().min(1),
      })
    )
    .min(1),
  totalPrice: z.string().min(1),
  periodOfPerformance: z.string().optional(),
  payWhenPaidAccepted: z.literal(true), // submitter must accept pay-when-paid
  notes: z.string().max(5000).optional(), // UNTRUSTED — fenced as data wherever the AI later reads it
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Submit a quote against a /quote/[token] page.
 * NOTE: this is a public endpoint — apply rate limiting at the route/edge layer in addition to this logic.
 */
export async function submitQuote(token: string, formData: FormData): Promise<ActionResult> {
  // 1. Authorize via the signed, single-purpose token. Scope comes from the payload, not the client.
  let payload;
  try {
    payload = verifyToken(token, "quote");
  } catch (e) {
    if (e instanceof TokenError) return { ok: false, error: "This link is invalid or has expired." };
    throw e;
  }

  // 2. Validate the structured submission.
  const parsed = QuoteSubmission.safeParse({
    lineItems: JSON.parse(String(formData.get("lineItems") ?? "[]")),
    totalPrice: String(formData.get("totalPrice") ?? ""),
    periodOfPerformance: formData.get("periodOfPerformance")?.toString(),
    payWhenPaidAccepted: formData.get("payWhenPaidAccepted") === "true",
    notes: formData.get("notes")?.toString(),
  });
  if (!parsed.success) return { ok: false, error: "Please complete all required fields." };

  // 3. Validate + store the proposal document (magic-byte + size checked).
  let proposalDocId: string | undefined;
  const file = formData.get("proposalDoc");
  if (file && file instanceof File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { detectedType } = validateUpload(bytes);
      const key = `${payload.org}/prospects/${payload.prospect}/${randomUUID()}.${detectedType}`;
      const contentType = detectedType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      await putToTigris(key, bytes, contentType);
      const [doc] = await db
        .insert(documents)
        .values({ orgId: payload.org, tigrisKey: key, mimeType: contentType, sizeBytes: bytes.byteLength, kind: "proposal" })
        .returning({ id: documents.id });
      proposalDocId = doc.id;
    } catch (e) {
      if (e instanceof UploadError) return { ok: false, error: e.message };
      throw e;
    }
  }

  // 4. Write the quote — PROSPECT-SCOPED ONLY. vendorId stays null; orgId/prospect/solicitation come
  //    from the verified token, never from the request. No `vendors` row is read or written.
  const [quote] = await db
    .insert(vendorQuotes)
    .values({
      orgId: payload.org,
      solicitationId: payload.sol!, // quote tokens always carry the solicitation
      prospectId: payload.prospect,
      vendorId: null,
      lineItems: parsed.data.lineItems,
      totalPrice: parsed.data.totalPrice,
      periodOfPerformance: parsed.data.periodOfPerformance,
      payWhenPaid: true,
      notes: parsed.data.notes,
      proposalDocId,
    })
    .returning({ id: vendorQuotes.id });

  // 5. Hand off to the autonomous detector (extract + rank) and audit.
  await inngest.send({
    name: "hermes/quote.submitted",
    data: { orgId: payload.org, solicitationId: payload.sol!, quoteId: quote.id },
  });
  await db.insert(auditLog).values({
    orgId: payload.org,
    actor: `prospect:${payload.prospect}`,
    isAutonomous: false,
    action: "quote_submitted_via_token",
    entityTable: "vendor_quotes",
    entityId: quote.id,
  });

  return { ok: true };
}

/**
 * Opt out via /optout/[token]. A quote token cannot reach this (wrong purpose throws), and this token
 * cannot submit a quote. Requires a one-line schema add: `optedOut boolean` on vendor_prospects.
 */
export async function optOut(token: string): Promise<ActionResult> {
  let payload;
  try {
    payload = verifyToken(token, "optout");
  } catch (e) {
    if (e instanceof TokenError) return { ok: false, error: "This link is invalid or has expired." };
    throw e;
  }

  await db
    .update(vendorProspects)
    .set({ /* optedOut: true */ } as any) // add `optedOut` boolean to vendor_prospects
    .where(eq(vendorProspects.id, payload.prospect));

  await db.insert(auditLog).values({
    orgId: payload.org,
    actor: `prospect:${payload.prospect}`,
    isAutonomous: false,
    action: "prospect_opted_out",
    entityTable: "vendor_prospects",
    entityId: payload.prospect,
  });

  return { ok: true };
}
