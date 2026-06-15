"use server";

/**
 * The tokenized opt-out action — PUBLIC, no-account (CLAUDE.md §7). A distinct single-purpose token:
 * verifyToken(OPT_OUT) rejects a quote token here (and vice-versa), so a link minted for one purpose can
 * never be replayed for the other. The write runs under withTokenRole (hermes_token), so even this
 * narrow UPDATE is RLS-confined to the token's own org and can only touch a prospect row. Idempotent:
 * re-opting-out simply re-sets the status.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TokenError, verifyToken } from "@hermes/core";
import { and, eq, vendorProspects, withTokenRole } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function optOut(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const hdrs = await headers();
  let status = "done";

  if (!rateLimit(clientKey(hdrs.get("fly-client-ip"), hdrs.get("x-forwarded-for"), "optout"))) {
    redirect(`/optout/${encodeURIComponent(token)}?status=throttled`);
  }

  try {
    const payload = verifyToken(token, "OPT_OUT");
    await withTokenRole(payload.org, async (tx) => {
      const rows = await tx
        .update(vendorProspects)
        .set({ status: "OPTED_OUT" })
        .where(and(eq(vendorProspects.orgId, payload.org), eq(vendorProspects.id, payload.prospect)))
        .returning({ id: vendorProspects.id, email: vendorProspects.contactEmail });
      if (rows.length === 0) throw new Error("prospect not found for token");
      await writeAudit(tx, {
        orgId: payload.org,
        actorType: "TOKEN",
        // Attributable per the audit_log_attributable CHECK: prospect email when known, else the jti.
        actorEmail: rows[0]?.email ?? `token-jti:${payload.jti}`,
        action: "PROSPECT_OPTED_OUT",
        entityType: "vendor_prospects",
        entityId: payload.prospect,
      });
    });
  } catch (err) {
    if (err instanceof TokenError) {
      status = "invalid";
    } else {
      status = "error";
      // Don't silently swallow: log server-side (no details to the client); the opt-out did not apply.
      console.error("optOut failed", err instanceof Error ? err.message : String(err));
    }
  }

  redirect(`/optout/${encodeURIComponent(token)}?status=${status}`);
}
