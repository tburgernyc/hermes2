-- ============================================================================
-- 0012_phase_a_checks.sql — the documents owner-XOR rewrite (Phase A, O3). Runs after 0011,
-- AFTER the drizzle batch (0005) has COMMITTED. Every statement idempotent.
--
-- WHY MANUAL: the rewritten documents_owner_matches_type CHECK references the enum labels
-- TEAMING_AGREEMENT / INSURANCE_POLICY that 0005 ADDs to the pre-existing document_entity_type
-- via ALTER TYPE ADD VALUE. PostgreSQL forbids USING a value added to an existing enum inside the
-- same transaction (55P04), and the drizzle migrator runs every pending generated migration in ONE
-- transaction — so the CHECK rewrite cannot live in 0005. Here it runs in its own transaction,
-- after the new labels are committed. (CLAUDE.md Phase-6 PR-I ALTER TYPE note.)
--
-- IDEMPOTENCE: guarded on the constraint DEFINITION (does it mention teaming_agreement_id yet?),
-- so a re-run — every deploy's release_command — is a no-op instead of a table-rescanning
-- DROP+ADD. The drizzle 0005 snapshot already carries these exact expressions, so drizzle-kit
-- will never re-emit them; this file is their single point of application.
-- ============================================================================

-- ---- documents_owner_exactly_one: 7 owners → 9 (adds teaming_agreement_id, insurance_policy_id) ----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_owner_exactly_one'
      AND conrelid = 'documents'::regclass
      AND pg_get_constraintdef(oid) LIKE '%teaming_agreement_id%'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_owner_exactly_one;
    ALTER TABLE documents ADD CONSTRAINT documents_owner_exactly_one CHECK ((
        (CASE WHEN solicitation_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN vendor_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN prospect_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN quote_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN proposal_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN contract_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN milestone_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN teaming_agreement_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN insurance_policy_id IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1);
  END IF;
END;
$$;

-- ---- documents_owner_matches_type: + the TEAMING_AGREEMENT and INSURANCE_POLICY arms ----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_owner_matches_type'
      AND conrelid = 'documents'::regclass
      AND pg_get_constraintdef(oid) LIKE '%TEAMING_AGREEMENT%'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_owner_matches_type;
    ALTER TABLE documents ADD CONSTRAINT documents_owner_matches_type CHECK (
         (entity_type = 'SOLICITATION' AND solicitation_id IS NOT NULL)
      OR (entity_type = 'VENDOR' AND vendor_id IS NOT NULL)
      OR (entity_type = 'VENDOR_PROSPECT' AND prospect_id IS NOT NULL)
      OR (entity_type = 'VENDOR_QUOTE' AND quote_id IS NOT NULL)
      OR (entity_type = 'PROPOSAL' AND proposal_id IS NOT NULL)
      OR (entity_type = 'CONTRACT' AND contract_id IS NOT NULL)
      OR (entity_type = 'CONTRACT_MILESTONE' AND milestone_id IS NOT NULL)
      OR (entity_type = 'TEAMING_AGREEMENT' AND teaming_agreement_id IS NOT NULL)
      OR (entity_type = 'INSURANCE_POLICY' AND insurance_policy_id IS NOT NULL)
    );
  END IF;
END;
$$;
