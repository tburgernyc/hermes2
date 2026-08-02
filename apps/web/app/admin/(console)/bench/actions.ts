"use server";

/**
 * §3.8.2 proactive vendor-bench building. Vendors currently enter the system reactively (invited per
 * opportunity, via the prospect → promote → vet pipeline). This adds a direct "add to bench" admin
 * capability that creates a `vendors` row DIRECTLY (no prospect, no solicitation reference anywhere in
 * this file) tagged by NAICS + capability, so the firm can proactively build a roster of vetting-ready
 * subs BEFORE a specific opportunity exists. A bench-added vendor starts PENDING_REVIEW — it flows through
 * the SAME existing vetting queue as a promoted prospect (/admin/vendors); this file adds NO new vetting
 * state machine. See apps/web/lib/bench.ts for the NAICS-tagging convention (a `packages/db` schema
 * deviation this unit documents rather than silently working around).
 */
import { revalidatePath } from "next/cache";

import { vendors, withOrg } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";
import { parseNaics, tagNaicsIntoCapabilities } from "@/lib/bench";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UEI_RE = /^[A-Z0-9]{12}$/i;
const MAX_NAME = 200;
const MAX_CAPS = 5000;

/**
 * Add a vendor to the bench: a trusted admin write, completely independent of any solicitation or
 * outreach campaign. Validates at the boundary exactly like the existing manual-prospect-add action.
 */
export async function addVendorToBench(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const userId = session.user.id;

  const companyName = String(formData.get("companyName") ?? "").trim();
  if (companyName.length === 0 || companyName.length > MAX_NAME) {
    throw new Error("Company name is required (max 200 chars)");
  }
  const emailRaw = String(formData.get("contactEmail") ?? "").trim();
  if (emailRaw.length > 0 && !EMAIL_RE.test(emailRaw)) throw new Error("Invalid contact email");
  const contactEmail = emailRaw.length > 0 ? emailRaw : null;
  const ueiRaw = String(formData.get("uei") ?? "").trim().toUpperCase();
  if (ueiRaw.length > 0 && !UEI_RE.test(ueiRaw)) throw new Error("Invalid UEI (12 alphanumeric characters)");
  const uei = ueiRaw.length > 0 ? ueiRaw : null;
  const naicsCodes = parseNaics(String(formData.get("naicsCodes") ?? ""));
  const capsRaw = String(formData.get("capabilitiesText") ?? "").trim().slice(0, MAX_CAPS);
  const capabilitiesText = tagNaicsIntoCapabilities(naicsCodes, capsRaw.length > 0 ? capsRaw : null);

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .insert(vendors)
      .values({
        orgId,
        companyName,
        contactEmail,
        uei,
        capabilitiesText: capabilitiesText.length > 0 ? capabilitiesText : null,
        status: "PENDING_REVIEW", // feeds the EXISTING /admin/vendors vetting queue — no new state machine
      })
      .returning({ id: vendors.id });
    const created = rows[0];
    if (!created) return;
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: userId,
      actorEmail: session.user.email ?? null,
      action: "VENDOR_ADDED_TO_BENCH",
      entityType: "vendors",
      entityId: created.id,
      after: { companyName, naicsCodes },
    });
  });

  revalidatePath("/admin/bench");
  revalidatePath("/admin/vendors");
}
