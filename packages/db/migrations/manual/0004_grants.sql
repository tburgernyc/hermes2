-- ============================================================================
-- 0004_grants.sql — table privileges (idempotent). Run last, after roles + RLS.
-- Table-level GRANTs (who may touch a table at all) compose with RLS (which rows).
-- ============================================================================

GRANT USAGE ON SCHEMA public TO hermes_app, hermes_token;

-- hermes_app: full CRUD on all current tables; RLS scopes it to its own org.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hermes_app;

-- audit_log is append-only for the app role: keep SELECT + INSERT, remove the rest.
-- (The immutability triggers are the belt; this REVOKE is the suspenders.)
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM hermes_app;

-- hermes_token: the minimal surface for the tokenized prospect/quote submission path.
-- NOTE: deliberately NO privilege on vendors / proposals / contracts / etc. — a token write
-- can never touch a vetted vendor or any firm-side row (CLAUDE.md §7).
GRANT SELECT ON orgs TO hermes_token;
GRANT SELECT ON solicitations TO hermes_token;
GRANT SELECT, INSERT, UPDATE ON vendor_prospects TO hermes_token;
GRANT INSERT ON vendor_quotes TO hermes_token;
GRANT INSERT ON vendor_quote_line_items TO hermes_token;
GRANT SELECT, INSERT ON documents TO hermes_token;
