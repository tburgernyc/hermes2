/**
 * Resolve the firm's own org id for the PUBLIC contact path (single-tenant). The /contact form has no
 * session or token to carry an org, so the org is resolved SERVER-SIDE from configuration, never from
 * the client (§7). Reuses HERMES_ACTIVE_ORG_IDS — the same single-tenant org the Inngest crons act on;
 * the first entry is the firm. Fails closed (throws) when unset, so a misconfigured deploy refuses to
 * write an unscoped inquiry rather than guessing an org.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function firmOrgId(): string {
  const first = (process.env.HERMES_ACTIVE_ORG_IDS ?? "").split(",")[0]?.trim() ?? "";
  if (!UUID_RE.test(first)) {
    throw new Error("HERMES_ACTIVE_ORG_IDS must be set to the firm org id for the public contact form.");
  }
  return first;
}
