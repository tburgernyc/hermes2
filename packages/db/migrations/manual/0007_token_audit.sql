-- ============================================================================
-- 0007_token_audit.sql — let the token role APPEND its own audit rows (idempotent). Runs last.
--
-- The tokenized public-submission path (client.withTokenRole — /quote, /optout) must record an
-- audit_log row for every write (CLAUDE.md §7: "append-only audit_log on every autonomous write").
-- That row has to be written INSIDE the same hermes_token transaction as the prospect-scoped quote so
-- the two commit or roll back atomically (no orphan quote without its audit trail). hermes_token had no
-- audit_log privilege (0004 granted INSERT only to hermes_app), so grant INSERT — and ONLY INSERT.
--
-- Safety: audit_log is append-only for EVERY role via the BEFORE UPDATE/DELETE/TRUNCATE triggers
-- (0003), and the tenant_isolation RLS policy (also 0003, FOR ALL TO hermes_app, hermes_token) confines
-- the token to rows in its own org. INSERT-only + RLS + immutability triggers = the token can append an
-- org-scoped audit row and can never read, alter, or erase the log.
-- ============================================================================

GRANT INSERT ON audit_log TO hermes_token;
