"use server";

/**
 * Public contact-inquiry submission (Phase 7a). A visitor's inbound message — NOT a workflow event.
 * Safe because of what it does NOT trust:
 *   • the firm org is resolved SERVER-SIDE (firmOrgId from HERMES_ACTIVE_ORG_IDS), never from the form.
 *   • input is Zod-validated at the boundary; the row's text-present CHECK is the DB belt.
 *   • IP-throttled (best-effort) like the other public endpoints.
 * It writes ONE contact_inquiries row at status NEW and does NOTHING else — no email, no Inngest, no
 * state advance (Prime Directive §2). The operator reviews + follows up by hand in /admin/inquiries.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { contactInquiries, withOrg } from "@hermes/db";

import { clientKey, rateLimit } from "@/lib/rate-limit";
import { firmOrgId } from "@/lib/firm";

const INTENTS = ["TEAMING", "AGENCY", "OTHER"] as const;

const inquirySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  company: z.string().trim().max(200).optional(),
  intent: z.enum(INTENTS),
  message: z.string().trim().min(1).max(5000),
});

function normalizeIntent(raw: unknown): (typeof INTENTS)[number] {
  const v = String(raw ?? "").toUpperCase();
  return (INTENTS as readonly string[]).includes(v) ? (v as (typeof INTENTS)[number]) : "OTHER";
}

export async function submitInquiry(formData: FormData): Promise<void> {
  const hdrs = await headers();
  let status = "sent";

  // Throttle BEFORE any work (redirect is outside the try — NEXT_REDIRECT must not be swallowed).
  if (!rateLimit(clientKey(hdrs.get("fly-client-ip"), hdrs.get("x-forwarded-for"), "contact"))) {
    redirect("/contact?status=throttled");
  }

  try {
    const parsed = inquirySchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      company: formData.get("company") || undefined,
      intent: normalizeIntent(formData.get("intent")),
      message: formData.get("message"),
    });

    const orgId = firmOrgId(); // server-resolved single-tenant firm org — never from the client (§7)

    await withOrg(orgId, async (tx) => {
      await tx.insert(contactInquiries).values({
        orgId,
        name: parsed.name,
        email: parsed.email,
        company: parsed.company ?? null,
        intent: parsed.intent,
        message: parsed.message, // UNTRUSTED free text — rendered as data (JSX autoescape) in the admin UI
        status: "NEW",
      });
    });
    // Intentionally NO outbound and NO event: the firm follows up manually (CLAUDE.md §2).
  } catch (err) {
    if (err instanceof z.ZodError) {
      status = "invalid";
    } else {
      status = "error";
      // Log server-side only; never leak details to the visitor.
      console.error("submitInquiry failed", err instanceof Error ? err.message : String(err));
    }
  }

  redirect(`/contact?status=${status}`);
}
