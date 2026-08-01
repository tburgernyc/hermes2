-- ============================================================================
-- 0003_guards.sql — triggers + Row-Level Security (idempotent).
-- Run by migrate.ts as the OWNER, AFTER the table migration and 0001_roles.
-- RLS is ENABLED but NOT FORCED: the non-owner app/token roles are bound by RLS;
-- the owner (migrations/seed/maintenance only) is exempt, which avoids the bootstrap
-- deadlock of seeding the first org under a self-referential policy.
-- ============================================================================

-- ---- updated_at maintenance (authoritative; raw SQL / seed / Inngest can't bypass it) ----
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

-- (time_entry_corrections is EXCLUDED like audit_log: append-only, no updated_at by design.)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orgs','users','solicitations','award_intelligence','vendor_prospects','vendors',
    'vendor_invites','outreach_campaigns','vendor_quotes','vendor_quote_line_items','proposals',
    'contracts','contract_milestones','ar_followups','documents','contact_inquiries',
    'teaming_partners','teaming_agreements','invoices','subcontractor_payables',
    'past_performance_records','ai_usage_events','time_entries','timesheet_periods',
    'business_insurance_policies','compliance_events'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_set_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t);
  END LOOP;
END;
$$;

-- ---- audit_log immutability (append-only; the trigger blocks even the owner) ----
CREATE OR REPLACE FUNCTION audit_log_block_modify() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP;
END;
$fn$;
DROP TRIGGER IF EXISTS audit_log_no_update_delete ON audit_log;
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_modify();

CREATE OR REPLACE FUNCTION audit_log_block_truncate() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'audit_log cannot be truncated';
END;
$fn$;
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_truncate();

-- ---- time_entry_corrections immutability (§3.5.3 DCAA audit trail — mirrors audit_log) ----
-- A correction row IS the audit trail on a time-entry edit; if it could be rewritten or erased,
-- the trail is worthless. Triggers block even the owner; the 0004 REVOKE is the suspenders.
CREATE OR REPLACE FUNCTION time_entry_corrections_block_modify() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'time_entry_corrections is append-only (% blocked)', TG_OP;
END;
$fn$;
DROP TRIGGER IF EXISTS time_entry_corrections_no_update_delete ON time_entry_corrections;
CREATE TRIGGER time_entry_corrections_no_update_delete
  BEFORE UPDATE OR DELETE ON time_entry_corrections
  FOR EACH ROW EXECUTE FUNCTION time_entry_corrections_block_modify();

CREATE OR REPLACE FUNCTION time_entry_corrections_block_truncate() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'time_entry_corrections cannot be truncated';
END;
$fn$;
DROP TRIGGER IF EXISTS time_entry_corrections_no_truncate ON time_entry_corrections;
CREATE TRIGGER time_entry_corrections_no_truncate BEFORE TRUNCATE ON time_entry_corrections
  FOR EACH STATEMENT EXECUTE FUNCTION time_entry_corrections_block_truncate();

-- ---- line-item contract_type sync (denormalized from the quote's solicitation; drives §6.2) ----
CREATE OR REPLACE FUNCTION sync_line_item_contract_type() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
DECLARE ct contract_type;
BEGIN
  SELECT s.contract_type INTO ct
  FROM vendor_quotes q JOIN solicitations s ON s.id = q.solicitation_id
  WHERE q.id = NEW.quote_id;
  IF ct IS NOT NULL THEN
    NEW.contract_type = ct;  -- authoritative when the solicitation type is known
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS line_items_sync_ct ON vendor_quote_line_items;
CREATE TRIGGER line_items_sync_ct BEFORE INSERT OR UPDATE ON vendor_quote_line_items
  FOR EACH ROW EXECUTE FUNCTION sync_line_item_contract_type();

-- ---- solicitation no-auto-submit cross-table guard (CLAUDE.md §2 / §6.6) ----
CREATE OR REPLACE FUNCTION solicitation_submit_guard() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.status = 'SUBMITTED' AND OLD.status IS DISTINCT FROM 'SUBMITTED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM proposals p WHERE p.solicitation_id = NEW.id AND p.status = 'SUBMITTED'
    ) THEN
      RAISE EXCEPTION
        'solicitation % cannot be SUBMITTED without a SUBMITTED (human+counsel-gated) proposal', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS solicitations_submit_guard ON solicitations;
CREATE TRIGGER solicitations_submit_guard BEFORE UPDATE ON solicitations
  FOR EACH ROW EXECUTE FUNCTION solicitation_submit_guard();

-- ---- Row-Level Security: tenant isolation ----
-- orgs is keyed by id (a row IS a tenant).
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orgs_tenant_isolation ON orgs;
CREATE POLICY orgs_tenant_isolation ON orgs FOR ALL TO hermes_app, hermes_token
  USING (id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (id = current_setting('app.current_org_id', true)::uuid);

-- Every org_id-scoped business table: USING + WITH CHECK on the org context GUC.
-- Phase-A tables (teaming/finance/timekeeping/firm-compliance) get the SAME org-scoped policy.
-- hermes_token is NAMED by the policy but holds ZERO grants on them (0004), so the token path
-- stays fail-closed; hermes_vendor is not named at all (no read surface until a phase opens one).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','audit_log','solicitations','award_intelligence','vendor_prospects','vendors',
    'vendor_invites','outreach_campaigns','vendor_quotes','vendor_quote_line_items','proposals',
    'contracts','contract_milestones','ar_followups','documents','contact_inquiries',
    'teaming_partners','teaming_agreements','invoices','subcontractor_payables',
    'past_performance_records','ai_usage_events','time_entries','time_entry_corrections',
    'timesheet_periods','business_insurance_policies','compliance_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO hermes_app, hermes_token '
      'USING (org_id = current_setting(''app.current_org_id'', true)::uuid) '
      'WITH CHECK (org_id = current_setting(''app.current_org_id'', true)::uuid)',
      t || '_tenant_isolation', t);
  END LOOP;
END;
$$;

-- Token-role boundary (RESTRICTIVE = AND-ed, and only applies to hermes_token):
-- a tokenized submission may only ever create prospect-linked quotes and prospect documents.
DROP POLICY IF EXISTS vendor_quotes_token_prospect_only ON vendor_quotes;
CREATE POLICY vendor_quotes_token_prospect_only ON vendor_quotes
  AS RESTRICTIVE FOR ALL TO hermes_token
  USING (vendor_id IS NULL) WITH CHECK (vendor_id IS NULL);

DROP POLICY IF EXISTS documents_token_prospect_only ON documents;
CREATE POLICY documents_token_prospect_only ON documents
  AS RESTRICTIVE FOR ALL TO hermes_token
  USING (entity_type = 'VENDOR_PROSPECT')
  WITH CHECK (entity_type = 'VENDOR_PROSPECT' AND prospect_id IS NOT NULL);
