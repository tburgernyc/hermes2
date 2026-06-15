-- ============================================================================
-- 0006_token_role.sql — let the app role elevate to hermes_token (idempotent). Runs last.
--
-- The tokenized public-submission path (client.withTokenRole — /quote, /optout) connects as
-- hermes_app and then SET LOCAL ROLE hermes_token to write a prospect-scoped quote/document. That
-- requires hermes_app to be a MEMBER of hermes_token. As with hermes_auth (0005), membership is
-- WITH INHERIT FALSE (PG16 per-membership control): hermes_app does NOT ambiently gain hermes_token's
-- (deliberately narrower) grants on a normal query — only an explicit SET LOCAL ROLE switches into the
-- low-trust role for the duration of a tokenized write. (0001 already grants hermes_token to the
-- migration owner so the test suite can SET ROLE into it directly.)
-- ============================================================================

GRANT hermes_token TO hermes_app WITH INHERIT FALSE;
