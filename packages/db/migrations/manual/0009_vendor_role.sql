-- ============================================================================
-- 0009_vendor_role.sql — the users↔vendors vetting linkage + the logged-in vendor's
-- least-privilege role (idempotent). Runs last, after 0008. The Phase-6 prerequisite.
--
--   • users.vendor_id composite FK — a user may link only to a vendor in its OWN org
--     (cross-tenant linkage is structurally impossible). Declared here (not in the Drizzle
--     schema) because a users↔vendors reference would create a TS import cycle.
--
--   • hermes_vendor — the role a logged-in vendor's session connects through
--     (client.withVendorRole). Org-scoped RLS gives ZERO isolation between two vendors in the
--     same org, and their quote pricing is competitively sensitive — so a dedicated role +
--     per-vendor RESTRICTIVE RLS keyed on app.current_vendor_id is the structural backstop
--     (mirrors hermes_token / hermes_auth). A forgotten WHERE can never leak a competitor's row.
--     READ-only surface for now; the logged-in write paths (quote submit, doc upload) and their
--     INSERT grants + WITH CHECK policies land with the Phase-6 portal pages.
-- ============================================================================

-- ---- users → vendors composite FK (tenant-safe; idempotent) ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_vendor_fk') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_vendor_fk FOREIGN KEY (org_id, vendor_id)
      REFERENCES vendors (org_id, id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- ---- the logged-in vendor role ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_vendor') THEN
    CREATE ROLE hermes_vendor NOLOGIN;
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO hermes_vendor;

-- Read surface: ONLY the tables that get a per-vendor RLS policy below — so every grant is row-backed
-- and there is no DEAD grant that silently returns zero rows (RLS-enabled + no matching policy = 0 rows).
-- The rows are then narrowed per-vendor by the RESTRICTIVE policies below. DELIBERATELY no access to
-- users / vendor_prospects / outreach_campaigns / audit_log. The RFQ read surface (orgs + solicitations)
-- and vendor WRITES land in Phase 6, each with its OWN org-scoped policy + grant.
GRANT SELECT ON vendors TO hermes_vendor;
GRANT SELECT ON vendor_quotes TO hermes_vendor;
GRANT SELECT ON proposals TO hermes_vendor;
GRANT SELECT ON contracts TO hermes_vendor;
GRANT SELECT ON documents TO hermes_vendor;

-- Let the migration owner SET ROLE into hermes_vendor (tests exercise it via SET LOCAL ROLE),
-- and let the app role elevate WITHOUT ambient inheritance (PG16 per-membership INHERIT control) —
-- only an explicit client.withVendorRole switches in, never an accidental hermes_app query.
GRANT hermes_vendor TO CURRENT_USER;
GRANT hermes_vendor TO hermes_app WITH INHERIT FALSE;

-- ---- per-vendor Row-Level Security (the structural isolation) ----
-- For each vendor-facing table: a PERMISSIVE org policy (hermes_vendor is NOT named by the
-- hermes_app/hermes_token tenant_isolation policy, so it needs its own org grant) AND a RESTRICTIVE
-- policy that AND-narrows to the session's own vendor. RLS is already ENABLED on every table (0003).
-- The vendor key differs per table: vendors keys on its own id; quotes on vendor_id; proposals and
-- contracts on awarded_vendor_id; documents on vendor_id (entity_type='VENDOR' docs — the quote/
-- contract document EXISTS-to-parent cases land with the Phase-6 reads).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('vendors',       'id'),
      ('vendor_quotes', 'vendor_id'),
      ('proposals',     'awarded_vendor_id'),
      ('contracts',     'awarded_vendor_id'),
      ('documents',     'vendor_id')
    ) AS v(tbl, col)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.tbl || '_vendor_org', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO hermes_vendor '
      'USING (org_id = current_setting(''app.current_org_id'', true)::uuid) '
      'WITH CHECK (org_id = current_setting(''app.current_org_id'', true)::uuid)',
      r.tbl || '_vendor_org', r.tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.tbl || '_vendor_scope', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO hermes_vendor '
      'USING (%I = current_setting(''app.current_vendor_id'', true)::uuid) '
      'WITH CHECK (%I = current_setting(''app.current_vendor_id'', true)::uuid)',
      r.tbl || '_vendor_scope', r.tbl, r.col, r.col);
  END LOOP;
END;
$$;
