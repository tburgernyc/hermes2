-- Idempotent by hand (drizzle-kit doesn't generate this): every object below was already created
-- directly against the live Neon default branch on a machine that's no longer accessible, without
-- ever going through a tracked drizzle migration. db-acceptance clones that live branch, so a plain
-- CREATE TYPE / ADD CONSTRAINT here would fail "already exists" the moment this migration actually
-- runs there (and would equally fail a real `fly deploy` release_command against production) — the
-- DO-block duplicate_object guards make this migration a safe no-op wherever the objects already
-- exist, and a normal create everywhere else (e.g. the `db` job's clean pgvector container).
DO $$ BEGIN
  CREATE TYPE "public"."ai_recommendation" AS ENUM('PURSUE', 'REJECT', 'HUMAN_REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN IF NOT EXISTS "quote_injection_attempts" jsonb;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN IF NOT EXISTS "triage_summary" text;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN IF NOT EXISTS "triage_recommendation" "ai_recommendation";--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN IF NOT EXISTS "ai_match_score" integer;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN IF NOT EXISTS "ai_capability_match" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN IF NOT EXISTS "ai_strengths" jsonb;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN IF NOT EXISTS "ai_gaps" jsonb;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN IF NOT EXISTS "ai_recommendation" "ai_recommendation";--> statement-breakpoint
ALTER TABLE "vendor_prospects" ADD COLUMN IF NOT EXISTS "discovery_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "narrative" jsonb;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD COLUMN IF NOT EXISTS "ai_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD COLUMN IF NOT EXISTS "ai_risks" jsonb;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_ai_match_score_range" CHECK ("outreach_campaigns"."ai_match_score" IS NULL OR ("outreach_campaigns"."ai_match_score" >= 1 AND "outreach_campaigns"."ai_match_score" <= 100));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_ai_capability_match_range" CHECK ("outreach_campaigns"."ai_capability_match" IS NULL OR ("outreach_campaigns"."ai_capability_match" >= 0 AND "outreach_campaigns"."ai_capability_match" <= 1));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_ai_score_range" CHECK ("vendor_quotes"."ai_score" IS NULL OR ("vendor_quotes"."ai_score" >= 0 AND "vendor_quotes"."ai_score" <= 100));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
