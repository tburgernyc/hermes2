-- ============================================================================
-- 0005_auth.sql — the least-privilege AUTHENTICATION role (idempotent). Runs last,
-- after 0004_grants. Auth is a CROSS-TENANT operation by nature: login looks up a user
-- by email BEFORE any org context exists, which the RLS-bound hermes_app role
-- structurally cannot do (RLS is ENABLED on users + no policy for that role ⇒ 0 rows).
--
--   hermes_auth : may read the auth columns of ANY user (cross-tenant, by design) and
--                 write ONLY the DB-backed lockout columns. Nothing else — no INSERT/
--                 DELETE on users, no access to any other table.
--
-- hermes_app is granted membership WITH INHERIT FALSE: the app connection can elevate to
-- hermes_auth explicitly (SET LOCAL ROLE, via client.withAuthRole) for the login lookup,
-- but does NOT ambiently inherit the cross-tenant read on normal tenant-scoped queries.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_auth') THEN
    CREATE ROLE hermes_auth NOLOGIN;
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO hermes_auth;

-- Read every auth column (needed to verify password/TOTP and resolve org from email);
-- write ONLY the two lockout columns (column-scoped UPDATE).
GRANT SELECT ON users TO hermes_auth;
GRANT UPDATE (failed_login_count, locked_until) ON users TO hermes_auth;

-- users has RLS ENABLED; a non-owner role with no matching policy sees ZERO rows. Add
-- permissive policies scoped to hermes_auth so it can read any user row and update lockout
-- state. (The hermes_app/hermes_token tenant_isolation policy does NOT name hermes_auth, so
-- normal tenant queries are unaffected — these policies apply only when elevated.)
DROP POLICY IF EXISTS users_auth_select ON users;
CREATE POLICY users_auth_select ON users FOR SELECT TO hermes_auth USING (true);

DROP POLICY IF EXISTS users_auth_lockout ON users;
CREATE POLICY users_auth_lockout ON users FOR UPDATE TO hermes_auth
  USING (true) WITH CHECK (true);

-- Let the migration owner SET ROLE into hermes_auth (tests exercise it via SET LOCAL ROLE).
GRANT hermes_auth TO CURRENT_USER;

-- Let the app role elevate to hermes_auth for the login lookup, WITHOUT ambient inheritance
-- (PG16 per-membership INHERIT control) — defense in depth so only withAuthRole() reads
-- cross-tenant, never an accidental hermes_app query.
GRANT hermes_auth TO hermes_app WITH INHERIT FALSE;
