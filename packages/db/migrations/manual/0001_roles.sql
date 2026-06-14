-- 0001_roles.sql — runtime roles (idempotent). Run before the table migration's RLS/grants.
--
--   hermes_app   : the application runtime role (NON-OWNER, so RLS binds to it automatically).
--   hermes_token : the low-trust public-submission role (tokenized prospect path).
--
-- Both are created NOLOGIN with no password here (no secrets in the repo). The operator sets
-- LOGIN + a password for hermes_app out-of-band when the app connects as it. Tests exercise the
-- roles via SET ROLE from the owner connection, so membership is granted to the current owner.
--
-- NOTE: the MIGRATION_DATABASE_URL role must have CREATEROLE for the CREATE ROLE / GRANT below. On
-- Neon this is satisfied by neondb_owner's neon_superuser membership; in CI's pgvector container the
-- owner is the postgres superuser. A least-privilege migration role WITHOUT CREATEROLE fails here (42501).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_app') THEN
    CREATE ROLE hermes_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_token') THEN
    CREATE ROLE hermes_token NOLOGIN;
  END IF;
END;
$$;

-- Allow the migration owner to SET ROLE into these roles (for tests/maintenance). Idempotent.
GRANT hermes_app TO CURRENT_USER;
GRANT hermes_token TO CURRENT_USER;
