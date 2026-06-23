-- ============================================================================
-- 0012_ai_field_grants.sql — withhold operator-only AI fields from the low-trust roles
-- (runs LAST, after 0011). Every statement idempotent.
--
-- Persisting AI outputs onto tables the vendor/token roles can already SELECT would otherwise
-- LEAK them: hermes_token + hermes_vendor hold table-wide SELECT on solicitations (0004/0010),
-- and hermes_vendor holds it on vendor_quotes + proposals (0009). A column-level REVOKE cannot
-- restrict a role that has table-level SELECT (the table grant dominates), so the only correct
-- enforcement is to REVOKE the table-wide SELECT and re-GRANT SELECT on exactly the non-operator
-- columns. This runs after 0004/0010 (which re-grant table-wide each run), so the END STATE is
-- always column-level; re-running is safe.
--
-- FAIL-CLOSED BY DESIGN: a future column added to one of these tables is NOT readable by the
-- low-trust roles until it is explicitly added to the grant below — operator-only is the default.
-- The matching negative test (negative.ai-field-isolation) + the schema.guards column-priv drift
-- guard assert this holds.
--
-- outreach_campaigns carries NO vendor/token grant at all (0004/0009 deliberately exclude it), so
-- its new ai_match_score / ai_capability_match / ai_strengths / ai_gaps / ai_recommendation columns
-- are already unreachable by those roles — nothing to do here for that table.
-- ============================================================================

-- ---- solicitations: hermes_token + hermes_vendor browse, MINUS the operator-only triage AI fields ----
-- Withheld: triage_summary, triage_recommendation, quote_injection_attempts.
REVOKE SELECT ON solicitations FROM hermes_token, hermes_vendor;
GRANT SELECT (
  id, org_id, notice_id, title, agency, naics_code, psc_code, notice_type, set_aside_type,
  contract_type, is_services, is_services_source, is_defense, response_deadline, scope_text,
  scope_embedding, status, feasibility_score, zero_float_fit, rejection_reasons, triage_model,
  triaged_at, sourcing_approved_by, sourcing_approved_at, created_at, updated_at
) ON solicitations TO hermes_token, hermes_vendor;

-- ---- vendor_quotes: hermes_vendor reads its OWN quotes, MINUS the operator-only AI evaluation ----
-- Withheld: ai_score, ai_risks. (hermes_token has INSERT-only on vendor_quotes — no SELECT to touch.)
REVOKE SELECT ON vendor_quotes FROM hermes_vendor;
GRANT SELECT (
  id, org_id, solicitation_id, vendor_id, prospect_id, token_jti, status, total_price,
  period_of_performance, pay_when_paid, notes, ai_rank, ai_rationale, evaluated_at,
  created_at, updated_at
) ON vendor_quotes TO hermes_vendor;

-- ---- proposals: hermes_vendor reads its OWN awarded proposals, MINUS the AI narrative ----
-- Withheld: narrative. (hermes_token has no proposals grant.)
REVOKE SELECT ON proposals FROM hermes_vendor;
GRANT SELECT (
  id, org_id, solicitation_id, selected_quote_id, awarded_vendor_id, supersedes_proposal_id,
  contract_type, status, pricing_scenarios, compliance_checklist, prime_qualifying_status,
  prime_qualifying_naics, government_payment_basis, non_similarly_situated_subs_total,
  total_cost_of_work, adequate_price_competition, pass_through_justification, submitted_by,
  submitted_at, counsel_reviewed_by, counsel_reviewed_at, created_at, updated_at
) ON proposals TO hermes_vendor;

-- ---- vendor_prospects (Phase B 0005): hermes_token writes + browses prospects, MINUS the sourcing intel ----
-- Withheld: discovery_metadata — the firm's internal assessment of a subcontractor (vet flags, AI capability
-- match, strengths/gaps, past-performance) must NEVER reach that subcontractor's token session. hermes_token
-- has table-wide SELECT on vendor_prospects (0004), so a column REVOKE alone can't restrict it; REVOKE the
-- table SELECT and re-GRANT SELECT on every column EXCEPT discovery_metadata. Its INSERT/UPDATE (the tokenized
-- prospect/opt-out write path) are separate privileges and untouched. hermes_vendor has NO grant on
-- vendor_prospects (0004/0009), so only hermes_token is adjusted here. Fail-closed for future columns.
REVOKE SELECT ON vendor_prospects FROM hermes_token;
GRANT SELECT (
  id, org_id, company_name, contact_email, uei, naics_codes, capabilities_text,
  capability_embedding, discovery_score, prospect_source, status, created_at, updated_at
) ON vendor_prospects TO hermes_token;
