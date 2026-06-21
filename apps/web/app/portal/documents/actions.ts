"use server";

/**
 * uploadVendorDocument (Slice 5) — the first standalone vendor WRITE path. It is the document sibling of
 * the quote-submit action (app/portal/solicitations/[id]/quote/actions.ts) and reuses the SAME security
 * primitives from @hermes/core: validateUpload (magic-byte + 25 MB gate) and getStorage(). It is safe
 * because of what it does NOT trust:
 *   • vendorId + orgId come from the SERVER session (requireVendorWithVendorId), NEVER the form — a vendor
 *     can only ever create a document it owns (§7). The RESTRICTIVE documents_vendor_scope WITH CHECK
 *     (migration 0010, vendor_id = GUC) is the structural backstop even if this code were wrong.
 *   • the file is validated by MAGIC BYTES; the client filename/MIME is ignored.
 *   • the storageKey is generated SERVER-SIDE (vendorDocumentKey) — never user-controlled.
 * There is no document-scan worker in the system, so the only substantiated validation is magicByteValidated
 * (no fabricated "scanned"/"malware-clean" status — truthfulness contract §5/§6). Returns a typed result so
 * the client can router.refresh() to re-read the real list (no optimistic row).
 */
import { randomUUID } from "node:crypto";

import { UploadError, getStorage, validateUpload, vendorDocumentKey } from "@hermes/core";
import { documents, withVendorRole } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export interface UploadResult {
  ok: boolean;
  error?: string;
}

/** Vendor-uploadable document kinds (the user-facing subset of document_kind). Server is the gate. */
const ALLOWED_KINDS = ["CAPABILITY_STATEMENT", "COI", "W9", "OTHER"] as const;
type VendorDocKind = (typeof ALLOWED_KINDS)[number];

function parseKind(raw: FormDataEntryValue | null): VendorDocKind {
  const value = String(raw ?? "");
  return (ALLOWED_KINDS as readonly string[]).includes(value) ? (value as VendorDocKind) : "OTHER";
}

export async function uploadVendorDocument(formData: FormData): Promise<UploadResult> {
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;

  if (!rateLimit(`vendor-doc:${session.user.id}`)) {
    return { ok: false, error: "Too many uploads. Please wait a minute and try again." };
  }

  try {
    const kind = parseKind(formData.get("kind"));

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a file to upload." };
    }

    // Validate by CONTENT (magic bytes + 25 MB cap), never the client name/MIME. Throws UploadError.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = validateUpload(bytes);

    const docId = randomUUID(); // app-side: pairs the row id with the server-generated storage key
    const key = vendorDocumentKey(orgId, vendorId, docId, upload.detectedType);

    // Store the bytes FIRST (an orphan blob on a later failure is harmless; a doc row never dangles).
    await getStorage().put(key, bytes, upload.contentType);

    await withVendorRole(orgId, vendorId, async (tx) => {
      await tx.insert(documents).values({
        id: docId,
        orgId,
        entityType: "VENDOR", // VENDOR-owned: vendorId set, every other owner FK null (owner XOR CHECK)
        vendorId, // the SERVER-resolved session vendor — never the form
        kind,
        storageKey: key,
        contentType: upload.contentType,
        byteSize: upload.byteSize,
        sha256: upload.sha256,
        magicByteValidated: true,
      });

      await writeAudit(tx, {
        orgId,
        actorType: "VENDOR",
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? null,
        action: "DOCUMENT_UPLOADED",
        entityType: "documents",
        entityId: docId,
      });
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message };
    console.error(
      "uploadVendorDocument failed",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false, error: "Something went wrong saving your document. Please try again." };
  }
}
