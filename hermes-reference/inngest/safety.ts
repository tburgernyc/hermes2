/**
 * inngest/safety.ts
 * Security helpers shared by the autonomous jobs.
 *  - safeFetchDocument: SSRF-guarded fetch (https-only, host allowlist, no redirects, size/type caps)
 *  - audit: append-only write to audit_log on EVERY autonomous action and approval
 */
import { db } from "@hermes/db";
import { auditLog } from "@hermes/db/schema";

/** Only these hosts may be fetched server-side. Extend as needed; keep it tight. */
const ALLOWED_HOSTS = new Set<string>([
  "api.sam.gov",
  "sam.gov",
  "api.usaspending.gov",
  // your Tigris/S3 endpoint host goes here
]);

const PRIVATE_IP = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc00:|fe80:)/i;

export async function safeFetchDocument(
  url: string,
  opts: { maxBytes?: number; allowedTypes?: string[] } = {}
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const maxBytes = opts.maxBytes ?? 25 * 1024 * 1024; // 25MB cap
  const u = new URL(url);

  if (u.protocol !== "https:") throw new Error("SSRF: https only");
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error(`SSRF: host not allowlisted (${u.hostname})`);
  if (PRIVATE_IP.test(u.hostname)) throw new Error("SSRF: private address blocked");

  // redirect: "error" prevents a 3xx from bouncing us off the allowlist to an internal target.
  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  if (opts.allowedTypes && !opts.allowedTypes.some((t) => contentType.includes(t))) {
    throw new Error(`Disallowed content-type: ${contentType}`);
  }
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared && declared > maxBytes) throw new Error("Document exceeds size cap");

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new Error("Document exceeds size cap (actual)");
  return { bytes: buf, contentType };
}

export async function audit(row: {
  orgId: string;
  actor: string; // userId | "system:<job>"
  isAutonomous: boolean;
  action: string;
  entityTable?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(auditLog).values({
    orgId: row.orgId,
    actor: row.actor,
    isAutonomous: row.isAutonomous,
    action: row.action,
    entityTable: row.entityTable,
    entityId: row.entityId,
    before: row.before as any,
    after: row.after as any,
  });
}
