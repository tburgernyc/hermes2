"use server";

/**
 * Contact-inquiry review action. Admin-only (requireAdmin), org-scoped, audited. Flipping NEW → REVIEWED
 * is a human bookkeeping step — it sends nothing and advances no firm workflow (CLAUDE.md §2). The
 * conditional WHERE status='NEW' makes a double-submit a no-op.
 */
import { revalidatePath } from "next/cache";

import { and, contactInquiries, eq, withOrg } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireAdmin } from "@/lib/auth-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markInquiryReviewed(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const id = String(formData.get("inquiryId") ?? "");
  if (!UUID_RE.test(id)) throw new Error("Invalid inquiryId");

  await withOrg(orgId, async (tx) => {
    const rows = await tx
      .update(contactInquiries)
      .set({ status: "REVIEWED" })
      .where(
        and(
          eq(contactInquiries.orgId, orgId),
          eq(contactInquiries.id, id),
          eq(contactInquiries.status, "NEW"),
        ),
      )
      .returning({ id: contactInquiries.id });
    if (rows.length === 0) return; // already reviewed or not found — no-op
    await writeAudit(tx, {
      orgId,
      actorType: "ADMIN",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      action: "INQUIRY_REVIEWED",
      entityType: "contact_inquiries",
      entityId: id,
    });
  });

  revalidatePath("/admin/inquiries");
}
