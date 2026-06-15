-- ============================================================================
-- 0008_line_item_trigger_definer.sql — run the line-item contract_type sync as SECURITY DEFINER
-- (idempotent). Runs last.
--
-- WHY: sync_line_item_contract_type (0003) denormalizes a line item's contract_type from its quote's
-- solicitation. It runs BEFORE INSERT and reads vendor_quotes + solicitations. The tokenized submission
-- path inserts line items as the low-trust hermes_token role, which deliberately has INSERT-but-not-SELECT
-- on vendor_quotes (the "blind write" — it must never read other prospects' quotes). So the trigger's own
-- SELECT was denied, and the whole prospect-scoped submission rolled back.
--
-- FIX: make this invariant-maintaining trigger SECURITY DEFINER so it runs with the (owner) definer's
-- rights for its internal read, independent of the inserting role — without widening hermes_token's
-- grants. search_path is pinned to a trusted, fixed value (defense against search_path hijacking, the
-- standard SECURITY DEFINER hardening). The function body is fixed SQL over fixed tables; it executes no
-- caller-supplied identifiers. Behavior is otherwise unchanged: it still authoritatively sets
-- contract_type from the solicitation.
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_line_item_contract_type() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
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
