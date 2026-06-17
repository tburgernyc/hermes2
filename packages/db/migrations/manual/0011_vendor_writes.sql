-- ============================================================================
-- 0011_vendor_writes.sql — activate the logged-in vendor's WRITE surface (Phase-6 PR K, the
-- authenticated quote submit that closes Phase 6). Runs after 0010. Every statement idempotent.
--
-- This is the mirror of the tokenized public path's write enablement (0004 grants + 0007 audit), but
-- for the LOGGED-IN vendor role. The structural isolation already exists (0009 per-vendor RESTRICTIVE
-- RLS + 0010 EXISTS-to-parent WITH CHECK arms); this migration only grants the INSERT privileges that
-- ACTIVATE those dormant WITH CHECK arms, adds the audit-append capability, and adds the
-- one-active-quote uniqueness backstop. No new policy logic for quotes/line-items/documents — the
-- WITH CHECK arms authored read-shaped in 0009/0010 become enforceable the moment INSERT is granted.
--
--   • vendor_quotes        — INSERT. The PERMISSIVE _vendor_org (org, 0009) + RESTRICTIVE _vendor_scope
--                            (vendor_id = app.current_vendor_id, 0009) WITH CHECK arms together force a
--                            submitted quote to carry vendor_id = the session's own vendor; combined
--                            with the party-XOR CHECK that forces prospect_id = NULL. A vendor can
--                            neither name another vendor nor impersonate a prospect.
--   • vendor_quote_line_items — INSERT. The EXISTS-to-parent _vendor_scope WITH CHECK (0010) ties every
--                            line to a quote the vendor owns; the line is visible to the same-tx
--                            subquery because the just-inserted quote matches the vendor's own RLS.
--   • documents            — INSERT. Activates the 0010 documents EXISTS-to-parent WITH CHECK for the
--                            VENDOR_QUOTE PDF hanging off the vendor's own quote.
--   • audit_log            — INSERT + a dedicated org-scoped policy. UNLIKE the token path (0007, which
--                            needed only a grant because the audit_log tenant_isolation policy already
--                            names hermes_token), the tenant_isolation policy (0003) names only
--                            hermes_app/hermes_token — so hermes_vendor needs its OWN INSERT policy too,
--                            or the in-transaction audit write would fail RLS. INSERT-only grant +
--                            INSERT-only PERMISSIVE policy + the immutability triggers (0003) = a vendor
--                            can append an org-scoped audit row for its own submit and can never read,
--                            alter, or erase the log (no SELECT/UPDATE/DELETE grant).
--
-- Quotes stay INSERT-only for the vendor (no UPDATE/DELETE grant): a submitted quote is immutable from
-- the vendor side; the firm advances it (shortlist/select/reject) under hermes_app. The model never
-- advances state here — a logged-in human submits their OWN quote, exactly as the public token path does
-- (CLAUDE.md §2 untouched: SUBMITTED is the vendor's own submission, not a firm-workflow advance).
-- ============================================================================

-- ---- INSERT grants that activate the dormant WITH CHECK arms (0009/0010) ----
GRANT INSERT ON vendor_quotes TO hermes_vendor;
GRANT INSERT ON vendor_quote_line_items TO hermes_vendor;
GRANT INSERT ON documents TO hermes_vendor;

-- ---- audit_log: append-only for the vendor (grant + the missing org-scoped INSERT policy) ----
GRANT INSERT ON audit_log TO hermes_vendor;

DROP POLICY IF EXISTS audit_log_vendor_append ON audit_log;
CREATE POLICY audit_log_vendor_append ON audit_log
  FOR INSERT TO hermes_vendor
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---- one ACTIVE quote per (vendor, solicitation): a partial UNIQUE index (structural, race-free) ----
-- A read-then-write app-side pre-check has a TOCTOU window under READ COMMITTED (two concurrent submits
-- both pass the check and both insert — the same class of race fixed in the PR-G selectQuote guard). A
-- partial unique index is the only race-free enforcement: the second concurrent insert blocks on the
-- index and then fails 23505. `vendor_id IS NOT NULL` keeps tokenized prospect quotes (vendor_id NULL)
-- out of the index entirely; the status predicate excludes terminal WITHDRAWN/REJECTED so a vendor may
-- resubmit after the firm rejects a prior quote. Lives here (manual SQL) rather than the Drizzle schema
-- to co-locate it with the write-enablement RLS it pairs with — like every other vendor-write object,
-- it is invisible to drizzle-kit (no drift). The drift guard (schema.constraints EXPECTED_PARTIAL_UNIQUE)
-- asserts its presence.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_quotes_one_active_per_vendor
  ON vendor_quotes (org_id, solicitation_id, vendor_id)
  WHERE vendor_id IS NOT NULL AND status NOT IN ('WITHDRAWN', 'REJECTED');
