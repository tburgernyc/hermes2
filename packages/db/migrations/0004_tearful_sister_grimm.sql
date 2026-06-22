CREATE TYPE "public"."ai_recommendation" AS ENUM('PURSUE', 'REJECT', 'HUMAN_REVIEW');--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "triage_summary" text;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "triage_recommendation" "ai_recommendation";--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "quote_injection_attempts" jsonb;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "ai_match_score" integer;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "ai_capability_match" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "ai_strengths" jsonb;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "ai_gaps" jsonb;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD COLUMN "ai_recommendation" "ai_recommendation";--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "narrative" jsonb;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD COLUMN "ai_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD COLUMN "ai_risks" jsonb;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_ai_match_score_range" CHECK ("outreach_campaigns"."ai_match_score" IS NULL OR ("outreach_campaigns"."ai_match_score" BETWEEN 1 AND 100));--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_ai_capability_match_range" CHECK ("outreach_campaigns"."ai_capability_match" IS NULL OR ("outreach_campaigns"."ai_capability_match" BETWEEN 0 AND 1));--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_ai_score_range" CHECK ("vendor_quotes"."ai_score" IS NULL OR ("vendor_quotes"."ai_score" BETWEEN 0 AND 100));