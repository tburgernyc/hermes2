/**
 * packages/inngest/src/safety.ts — security helpers shared by the autonomous jobs (CLAUDE.md §7):
 *  - assertSafeUrl / safeFetchDocument: SSRF-guarded fetch (https-only, host allowlist, no private IPs,
 *    no redirects, content-type + size caps). The URL-validation half is pure → unit-testable offline.
 *  - writeAudit: append a row to the immutable audit_log on EVERY autonomous write and every approval,
 *    reconciled to the current schema (actorType / actorUserId / actorEmail), inside the job's org tx.
 */
import { auditLog, type Tx } from "@hermes/db";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const PRIVATE_IP = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc00:|fe80:)/i;

/** The only hosts a server-side document fetch may reach. Keep it tight. */
function allowedHosts(): Set<string> {
  const hosts = new Set<string>(["api.sam.gov", "sam.gov", "api.usaspending.gov"]);
  const tigris = process.env.TIGRIS_ENDPOINT;
  if (tigris) {
    try {
      hosts.add(new URL(tigris).hostname);
    } catch {
      // ignore a malformed endpoint; the allowlist simply omits it.
    }
  }
  return hosts;
}

/** Pure SSRF URL validation (no network). Throws on any violation; returns the parsed URL. */
export function assertSafeUrl(url: string): URL {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("SSRF: https only");
  if (!allowedHosts().has(u.hostname)) throw new Error(`SSRF: host not allowlisted (${u.hostname})`);
  if (PRIVATE_IP.test(u.hostname)) throw new Error("SSRF: private address blocked");
  return u;
}

export async function safeFetchDocument(
  url: string,
  opts: { maxBytes?: number; allowedTypes?: string[] } = {},
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  assertSafeUrl(url);

  // redirect: "error" stops a 3xx from bouncing us off the allowlist toward an internal target.
  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  if (opts.allowedTypes && !opts.allowedTypes.some((t) => contentType.includes(t))) {
    throw new Error(`Disallowed content-type: ${contentType}`);
  }
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared && declared > maxBytes) throw new Error("Document exceeds size cap");

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("Document exceeds size cap (actual)");
  return { bytes, contentType };
}

export type ActorType = "SYSTEM" | "ADMIN" | "VENDOR" | "TOKEN";

export interface AuditRow {
  orgId: string;
  actorType: ActorType;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Append a row to the append-only audit_log within the caller's org-scoped transaction. */
export async function writeAudit(tx: Tx, row: AuditRow): Promise<void> {
  await tx.insert(auditLog).values({
    orgId: row.orgId,
    actorType: row.actorType,
    actorUserId: row.actorUserId ?? null,
    actorEmail: row.actorEmail ?? null,
    action: row.action,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    before: (row.before ?? null) as never,
    after: (row.after ?? null) as never,
  });
}
