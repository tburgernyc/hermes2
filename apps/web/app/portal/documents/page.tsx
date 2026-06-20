import type { JSX } from "react";

import { desc, documents, eq, withVendorRole } from "@hermes/db";
import { getStorage } from "@hermes/core";

import { PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { humanizeStatus } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // getStorage() (Tigris/AWS SDK) is Node-only

interface DocRow {
  id: string;
  kind: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
}

/**
 * Best-effort signed URL: if storage is not configured (no Tigris bucket / no explicit memory opt-in)
 * or signing fails, return null and render the row WITHOUT a link rather than 500 the whole page. The
 * operator wires TIGRIS_* via `fly secrets` in production.
 */
async function signedUrlFor(storageKey: string): Promise<string | null> {
  try {
    return await getStorage().signedGetUrl(storageKey);
  } catch {
    return null;
  }
}

/**
 * "My Documents" — the documents this vendor owns: its VENDOR docs, the PDFs on its own quotes, and its
 * subcontract docs. The 0010 EXISTS-to-parent RESTRICTIVE policy is what makes the quote/contract docs
 * visible (0009 alone showed only vendor_id-owned docs); a competitor's document is never returned.
 */
export default async function MyDocumentsPage(): Promise<JSX.Element> {
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;

  const rows: DocRow[] = await withVendorRole(orgId, vendorId, async (tx) =>
    tx
      .select({
        id: documents.id,
        kind: documents.kind,
        contentType: documents.contentType,
        byteSize: documents.byteSize,
        storageKey: documents.storageKey,
      })
      .from(documents)
      .where(eq(documents.orgId, orgId))
      .orderBy(desc(documents.createdAt)),
  );

  const withUrls = await Promise.all(
    rows.map(async (d) => ({ ...d, url: await signedUrlFor(d.storageKey) })),
  );

  return (
    <main>
      <PageHeader title="My Documents" />
      {withUrls.length === 0 ? (
        <p className={c.empty} data-testid="documents-empty">
          You have no documents yet.
        </p>
      ) : (
        <div className={c.tableWrap}>
          <table className={c.table} data-testid="documents-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Type</th>
                <th>Size</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {withUrls.map((d) => (
                <tr key={d.id}>
                  <td>{humanizeStatus(d.kind)}</td>
                  <td>{d.contentType}</td>
                  <td>{d.byteSize} bytes</td>
                  <td>
                    {d.url ? (
                      <a href={d.url} rel="noopener noreferrer">
                        Download
                      </a>
                    ) : (
                      "Unavailable"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
