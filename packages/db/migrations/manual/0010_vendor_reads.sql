-- ============================================================================
-- 0010_vendor_reads.sql — the logged-in vendor's READ surface for the portal
-- (Phase-6 PR J). Runs after 0009. Every statement idempotent.
--
--   • solicitations — a vendor browses ALL open in-org RFQs, so a PERMISSIVE org-scoped
--     SELECT policy (deliberately NO restrictive per-vendor scope: RFQs are shared within the
--     org; the page query filters to the quotable statuses, which is a presentation concern,
--     not a security boundary). hermes_vendor is not named by the hermes_app/hermes_token
--     tenant_isolation policy, so it needs its own org grant + policy (mirrors 0009).
--
--   • vendor_quote_line_items — the quote-detail page renders the lines a vendor submitted. Line
--     items carry no vendor_id of their own, so isolation is EXISTS-to-parent against vendor_quotes
--     (itself RLS-narrowed to the vendor's own quotes). SELECT only here; the INSERT grant that
--     activates the WITH CHECK arm lands with PR K (logged-in submit), so the policy is created in
--     its full read+write shape now and the write half stays dormant — mirroring documents below.
--
--   • documents — REPLACE the 0009 placeholder `documents_vendor_scope` (vendor_id = GUC only,
--     which hid every quote/contract PDF the vendor owns) with the EXISTS-to-parent form so a
--     vendor ALSO sees the documents hanging off ITS OWN quotes and subcontracts. This MUST
--     replace, not add: RESTRICTIVE policies AND together, so a second one would keep those
--     docs hidden. The PERMISSIVE documents_vendor_org (org gate, 0009) is untouched. The
--     WITH CHECK arm is dormant until PR K grants documents INSERT (it pre-authorizes exactly
--     the VENDOR_QUOTE docs the logged-in submit will write).
-- ============================================================================

-- ---- solicitations: browse all open in-org RFQs (read-only) ----
GRANT SELECT ON solicitations TO hermes_vendor;

DROP POLICY IF EXISTS solicitations_vendor_org ON solicitations;
CREATE POLICY solicitations_vendor_org ON solicitations
  FOR SELECT TO hermes_vendor
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---- vendor_quote_line_items: read the lines of one's OWN quotes (detail page) ----
-- No vendor_id column ⇒ isolation is EXISTS-to-parent against vendor_quotes (RLS-narrowed to the
-- vendor's own quotes under hermes_vendor, so `= app.current_vendor_id` is belt-and-suspenders).
-- SELECT is granted now; the INSERT that activates the WITH CHECK arm is PR K (logged-in submit).
GRANT SELECT ON vendor_quote_line_items TO hermes_vendor;

DROP POLICY IF EXISTS vendor_quote_line_items_vendor_org ON vendor_quote_line_items;
CREATE POLICY vendor_quote_line_items_vendor_org ON vendor_quote_line_items
  FOR ALL TO hermes_vendor
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS vendor_quote_line_items_vendor_scope ON vendor_quote_line_items;
CREATE POLICY vendor_quote_line_items_vendor_scope ON vendor_quote_line_items
  AS RESTRICTIVE FOR ALL TO hermes_vendor
  USING (
    EXISTS (
      SELECT 1 FROM vendor_quotes q
      WHERE q.id = vendor_quote_line_items.quote_id
        AND q.vendor_id = current_setting('app.current_vendor_id', true)::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_quotes q
      WHERE q.id = vendor_quote_line_items.quote_id
        AND q.vendor_id = current_setting('app.current_vendor_id', true)::uuid
    )
  );

-- ---- documents: own-vendor docs + own quote/contract docs (EXISTS-to-parent) ----
-- Replaces 0009's own-vendor-only RESTRICTIVE policy. The EXISTS subqueries read vendor_quotes /
-- contracts under the SAME hermes_vendor RLS (both GUCs are set by client.withVendorRole), so they
-- can only ever match the vendor's OWN quote/contract rows — the `= app.current_vendor_id` guard is
-- belt-and-suspenders. A NULL quote_id / contract_id makes its EXISTS arm false (non-owner docs stay
-- hidden). A SOLICITATION-owned doc is intentionally NOT visible here (the RFQ browse surface shows
-- solicitation metadata, not attachments — Phase-6 scope).
DROP POLICY IF EXISTS documents_vendor_scope ON documents;
CREATE POLICY documents_vendor_scope ON documents
  AS RESTRICTIVE FOR ALL TO hermes_vendor
  USING (
    vendor_id = current_setting('app.current_vendor_id', true)::uuid
    OR EXISTS (
      SELECT 1 FROM vendor_quotes q
      WHERE q.id = documents.quote_id
        AND q.vendor_id = current_setting('app.current_vendor_id', true)::uuid
    )
    OR EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = documents.contract_id
        AND c.awarded_vendor_id = current_setting('app.current_vendor_id', true)::uuid
    )
  )
  WITH CHECK (
    vendor_id = current_setting('app.current_vendor_id', true)::uuid
    OR EXISTS (
      SELECT 1 FROM vendor_quotes q
      WHERE q.id = documents.quote_id
        AND q.vendor_id = current_setting('app.current_vendor_id', true)::uuid
    )
    OR EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = documents.contract_id
        AND c.awarded_vendor_id = current_setting('app.current_vendor_id', true)::uuid
    )
  );
