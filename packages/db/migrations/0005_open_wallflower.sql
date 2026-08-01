CREATE TYPE "public"."admin_role" AS ENUM('FULL', 'CAPTURE', 'FINANCE');--> statement-breakpoint
CREATE TYPE "public"."compliance_event_kind" AS ENUM('OPTION_YEAR_RECERT', 'SIZE_RECERT', 'MERGER_ACQUISITION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."cpars_rating" AS ENUM('EXCEPTIONAL', 'VERY_GOOD', 'SATISFACTORY', 'MARGINAL', 'UNSATISFACTORY');--> statement-breakpoint
CREATE TYPE "public"."deal_role" AS ENUM('PRIME', 'SUBCONTRACTOR');--> statement-breakpoint
CREATE TYPE "public"."insurance_policy_type" AS ENUM('GENERAL_LIABILITY', 'PROFESSIONAL_EO', 'CYBER', 'BOND', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('PROGRESS', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SUBMITTED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payable_status" AS ENUM('PENDING', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."protest_status" AS ENUM('NONE', 'CONSIDERING', 'FILED', 'RESOLVED_SUSTAINED', 'RESOLVED_DENIED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."rfi_track_status" AS ENUM('RECEIVED', 'CAPABILITY_DRAFTED', 'RESPONSE_SUBMITTED', 'CONVERTED', 'CLOSED_NO_ACTION');--> statement-breakpoint
CREATE TYPE "public"."teaming_agreement_status" AS ENUM('DRAFT', 'UNDER_NEGOTIATION', 'EXECUTED', 'TERMINATED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."time_charge_class" AS ENUM('DIRECT', 'INDIRECT');--> statement-breakpoint
CREATE TYPE "public"."timesheet_status" AS ENUM('OPEN', 'SUBMITTED', 'APPROVED');--> statement-breakpoint
ALTER TYPE "public"."document_entity_type" ADD VALUE 'TEAMING_AGREEMENT';--> statement-breakpoint
ALTER TYPE "public"."document_entity_type" ADD VALUE 'INSURANCE_POLICY';--> statement-breakpoint
ALTER TYPE "public"."document_kind" ADD VALUE 'SUBCONTRACT_DRAFT';--> statement-breakpoint
CREATE TABLE "teaming_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"solicitation_id" uuid,
	"our_scope_text" text,
	"our_pricing" numeric(14, 2),
	"pop_start" timestamp with time zone,
	"pop_end" timestamp with time zone,
	"prime_contract_piid" text,
	"status" "teaming_agreement_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teaming_agreements_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "teaming_agreements_pricing_nonneg" CHECK ("teaming_agreements"."our_pricing" IS NULL OR "teaming_agreements"."our_pricing" >= 0),
	CONSTRAINT "teaming_agreements_pop_order" CHECK ("teaming_agreements"."pop_start" IS NULL OR "teaming_agreements"."pop_end" IS NULL OR "teaming_agreements"."pop_end" >= "teaming_agreements"."pop_start")
);
--> statement-breakpoint
CREATE TABLE "teaming_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"uei" varchar(12),
	"cage_code" varchar(5),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teaming_partners_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "teaming_partners_name_present" CHECK (length(btrim("teaming_partners"."company_name")) > 0),
	CONSTRAINT "teaming_partners_uei_format" CHECK ("teaming_partners"."uei" IS NULL OR "teaming_partners"."uei" ~ '^[A-Z0-9]{12}$'),
	CONSTRAINT "teaming_partners_cage_format" CHECK ("teaming_partners"."cage_code" IS NULL OR "teaming_partners"."cage_code" ~ '^[A-Z0-9]{5}$')
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	"function_name" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(12, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_tokens_nonneg" CHECK ("ai_usage_events"."input_tokens" >= 0 AND "ai_usage_events"."output_tokens" >= 0
          AND "ai_usage_events"."cache_read_tokens" >= 0 AND "ai_usage_events"."cache_write_tokens" >= 0),
	CONSTRAINT "ai_usage_cost_nonneg" CHECK ("ai_usage_events"."estimated_cost_usd" IS NULL OR "ai_usage_events"."estimated_cost_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contract_id" uuid,
	"teaming_agreement_id" uuid,
	"milestone_id" uuid,
	"invoice_number" text NOT NULL,
	"kind" "invoice_kind" DEFAULT 'PROGRESS' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"submitted_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "invoices_link_xor" CHECK (("invoices"."contract_id" IS NOT NULL) <> ("invoices"."teaming_agreement_id" IS NOT NULL)),
	CONSTRAINT "invoices_amount_nonneg" CHECK ("invoices"."amount" >= 0),
	CONSTRAINT "invoices_number_present" CHECK (length(btrim("invoices"."invoice_number")) > 0),
	CONSTRAINT "invoices_milestone_requires_contract" CHECK ("invoices"."milestone_id" IS NULL OR "invoices"."contract_id" IS NOT NULL),
	CONSTRAINT "invoices_submitted_requires_timestamp" CHECK ("invoices"."status" NOT IN ('SUBMITTED','PAID') OR "invoices"."submitted_at" IS NOT NULL),
	CONSTRAINT "invoices_paid_requires_timestamp" CHECK ("invoices"."status" <> 'PAID' OR "invoices"."paid_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "past_performance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"rating_period_start" timestamp with time zone,
	"rating_period_end" timestamp with time zone,
	"rating" "cpars_rating" NOT NULL,
	"narrative" text,
	"evaluator_name" text,
	"evaluator_email" text,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "past_perf_period_order" CHECK ("past_performance_records"."rating_period_start" IS NULL OR "past_performance_records"."rating_period_end" IS NULL
          OR "past_performance_records"."rating_period_end" >= "past_performance_records"."rating_period_start")
);
--> statement-breakpoint
CREATE TABLE "subcontractor_payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"milestone_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"government_invoice_id" uuid,
	"paid_at" timestamp with time zone,
	"status" "payable_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payables_amount_nonneg" CHECK ("subcontractor_payables"."amount" >= 0),
	CONSTRAINT "payables_paid_requires_timestamp" CHECK ("subcontractor_payables"."status" <> 'PAID' OR "subcontractor_payables"."paid_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"charge_class" time_charge_class NOT NULL,
	"contract_id" uuid,
	"milestone_id" uuid,
	"description" text NOT NULL,
	"period_id" uuid,
	"invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "time_entries_hours_range" CHECK ("time_entries"."hours" > 0 AND "time_entries"."hours" <= 24),
	CONSTRAINT "time_entries_direct_requires_contract" CHECK ("time_entries"."charge_class" <> 'DIRECT' OR "time_entries"."contract_id" IS NOT NULL),
	CONSTRAINT "time_entries_milestone_requires_contract" CHECK ("time_entries"."milestone_id" IS NULL OR "time_entries"."contract_id" IS NOT NULL),
	CONSTRAINT "time_entries_description_present" CHECK (length(btrim("time_entries"."description")) > 0)
);
--> statement-breakpoint
CREATE TABLE "time_entry_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"time_entry_id" uuid NOT NULL,
	"corrected_by" uuid NOT NULL,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"old_values" jsonb NOT NULL,
	"new_values" jsonb NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "time_entry_corrections_reason_present" CHECK (length(btrim("time_entry_corrections"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "timesheet_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" timesheet_status DEFAULT 'OPEN' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timesheet_periods_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "timesheet_periods_period_order" CHECK ("timesheet_periods"."period_end" >= "timesheet_periods"."period_start"),
	CONSTRAINT "timesheet_periods_approval_gate" CHECK ("timesheet_periods"."status" <> 'APPROVED' OR ("timesheet_periods"."approved_by" IS NOT NULL AND "timesheet_periods"."approved_at" IS NOT NULL)),
	CONSTRAINT "timesheet_periods_submit_requires_timestamp" CHECK ("timesheet_periods"."status" NOT IN ('SUBMITTED','APPROVED') OR "timesheet_periods"."submitted_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "business_insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"policy_type" "insurance_policy_type" NOT NULL,
	"carrier" text,
	"policy_number" text,
	"coverage_amount" numeric(14, 2),
	"effective_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_insurance_policies_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "insurance_coverage_nonneg" CHECK ("business_insurance_policies"."coverage_amount" IS NULL OR "business_insurance_policies"."coverage_amount" >= 0),
	CONSTRAINT "insurance_effective_order" CHECK ("business_insurance_policies"."effective_at" IS NULL OR "business_insurance_policies"."expires_at" IS NULL OR "business_insurance_policies"."expires_at" >= "business_insurance_policies"."effective_at")
);
--> statement-breakpoint
CREATE TABLE "compliance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "compliance_event_kind" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- HAND-EDIT (PG16 enum hazard — CLAUDE.md Phase-6 PR-I note): drizzle-kit generated a DROP+ADD of
-- documents_owner_exactly_one / documents_owner_matches_type here, but the rewritten matches-type
-- CHECK references the enum labels TEAMING_AGREEMENT / INSURANCE_POLICY that the ALTER TYPE ADD
-- VALUE statements above add to the PRE-EXISTING document_entity_type — and a value added to an
-- existing enum cannot be USED in the same transaction (55P04), while the drizzle migrator runs
-- every pending migration in ONE transaction. Both statements were therefore MOVED to manual
-- migration 0012_phase_a_checks.sql, which migrate.ts runs in a separate transaction after this
-- batch commits. The old 7-owner CHECKs stay in force until 0012 replaces them (the new owner
-- columns are NULL-only in that window, so no valid write is rejected). The 0005 snapshot already
-- carries the rewritten expressions, so drizzle-kit will not try to re-emit this change.
ALTER TABLE "users" ADD COLUMN "admin_role" "admin_role";--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "deal_role" "deal_role" DEFAULT 'PRIME' NOT NULL;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "awarded_piid" text;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "awarded_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "award_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "co_contact" jsonb;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "debrief_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "debrief_notes" text;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "protest_status" "protest_status" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "protest_notes" text;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "outcome_notes" text;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "outcome_recorded_by" uuid;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "outcome_recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "rfi_track_status" "rfi_track_status";--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "converted_from_solicitation_id" uuid;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "lm_compliance_matrix" jsonb;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "lm_extracted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitations" ADD COLUMN "lm_extraction_model" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "agreement_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "agreement_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "accelerated_payments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "vendor_signed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "vendor_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "teaming_agreement_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "insurance_policy_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "retention_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "retention_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teaming_agreements" ADD CONSTRAINT "teaming_agreements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaming_agreements" ADD CONSTRAINT "teaming_agreements_partner_fk" FOREIGN KEY ("org_id","partner_id") REFERENCES "public"."teaming_partners"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaming_agreements" ADD CONSTRAINT "teaming_agreements_solicitation_fk" FOREIGN KEY ("org_id","solicitation_id") REFERENCES "public"."solicitations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaming_partners" ADD CONSTRAINT "teaming_partners_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_fk" FOREIGN KEY ("org_id","contract_id") REFERENCES "public"."contracts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_teaming_agreement_fk" FOREIGN KEY ("org_id","teaming_agreement_id") REFERENCES "public"."teaming_agreements"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_milestone_fk" FOREIGN KEY ("org_id","milestone_id") REFERENCES "public"."contract_milestones"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_performance_records" ADD CONSTRAINT "past_performance_records_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_performance_records" ADD CONSTRAINT "past_perf_contract_fk" FOREIGN KEY ("org_id","contract_id") REFERENCES "public"."contracts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_performance_records" ADD CONSTRAINT "past_perf_recorder_fk" FOREIGN KEY ("org_id","recorded_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_payables" ADD CONSTRAINT "subcontractor_payables_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_payables" ADD CONSTRAINT "payables_contract_fk" FOREIGN KEY ("org_id","contract_id") REFERENCES "public"."contracts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_payables" ADD CONSTRAINT "payables_milestone_fk" FOREIGN KEY ("org_id","milestone_id") REFERENCES "public"."contract_milestones"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_payables" ADD CONSTRAINT "payables_invoice_fk" FOREIGN KEY ("org_id","government_invoice_id") REFERENCES "public"."invoices"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_fk" FOREIGN KEY ("org_id","user_id") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_contract_fk" FOREIGN KEY ("org_id","contract_id") REFERENCES "public"."contracts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_milestone_fk" FOREIGN KEY ("org_id","milestone_id") REFERENCES "public"."contract_milestones"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_period_fk" FOREIGN KEY ("org_id","period_id") REFERENCES "public"."timesheet_periods"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_fk" FOREIGN KEY ("org_id","invoice_id") REFERENCES "public"."invoices"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_corrections" ADD CONSTRAINT "time_entry_corrections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_corrections" ADD CONSTRAINT "corrections_entry_fk" FOREIGN KEY ("org_id","time_entry_id") REFERENCES "public"."time_entries"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_corrections" ADD CONSTRAINT "corrections_user_fk" FOREIGN KEY ("org_id","corrected_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_periods" ADD CONSTRAINT "timesheet_periods_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_periods" ADD CONSTRAINT "timesheet_periods_user_fk" FOREIGN KEY ("org_id","user_id") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_periods" ADD CONSTRAINT "timesheet_periods_approver_fk" FOREIGN KEY ("org_id","approved_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_insurance_policies" ADD CONSTRAINT "business_insurance_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_recorder_fk" FOREIGN KEY ("org_id","recorded_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teaming_agreements_org_idx" ON "teaming_agreements" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "teaming_agreements_partner_idx" ON "teaming_agreements" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "teaming_partners_org_idx" ON "teaming_partners" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ai_usage_org_occurred_idx" ON "ai_usage_events" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number_key" ON "invoices" USING btree ("org_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_org_idx" ON "invoices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invoices_contract_idx" ON "invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "invoices_teaming_idx" ON "invoices" USING btree ("teaming_agreement_id");--> statement-breakpoint
CREATE INDEX "past_perf_org_idx" ON "past_performance_records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "past_perf_contract_idx" ON "past_performance_records" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "payables_org_idx" ON "subcontractor_payables" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "payables_contract_idx" ON "subcontractor_payables" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "time_entries_org_idx" ON "time_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "time_entries_user_date_idx" ON "time_entries" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_contract_idx" ON "time_entries" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "time_entries_period_idx" ON "time_entries" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "corrections_org_idx" ON "time_entry_corrections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "corrections_entry_idx" ON "time_entry_corrections" USING btree ("time_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_periods_user_start_key" ON "timesheet_periods" USING btree ("org_id","user_id","period_start");--> statement-breakpoint
CREATE INDEX "timesheet_periods_org_idx" ON "timesheet_periods" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "timesheet_periods_user_idx" ON "timesheet_periods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "insurance_org_idx" ON "business_insurance_policies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "compliance_events_org_idx" ON "compliance_events" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_outcome_recorder_fk" FOREIGN KEY ("org_id","outcome_recorded_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_converted_from_fk" FOREIGN KEY ("org_id","converted_from_solicitation_id") REFERENCES "public"."solicitations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_agreement_reviewer_fk" FOREIGN KEY ("org_id","agreement_reviewed_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vendor_signer_fk" FOREIGN KEY ("org_id","vendor_signed_by_user_id") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_teaming_agreement_fk" FOREIGN KEY ("org_id","teaming_agreement_id") REFERENCES "public"."teaming_agreements"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_insurance_policy_fk" FOREIGN KEY ("org_id","insurance_policy_id") REFERENCES "public"."business_insurance_policies"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_retention_reviewer_fk" FOREIGN KEY ("org_id","retention_reviewed_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- HAND-EDIT (§3.6 backfill, per the Phase-A brief): existing ADMIN rows (the seeded operator, the
-- e2e admin) predate admin_role and must carry FULL — current behavior, unchanged — BEFORE the
-- CHECK below lands, or this migration would fail on any database with an existing admin. Safe in
-- this transaction: admin_role is a type CREATED above (the 55P04 restriction applies only to
-- values ADDed to a pre-existing enum). Idempotent by shape (admin_role IS NULL guard).
UPDATE "users" SET "admin_role" = 'FULL' WHERE "role" = 'ADMIN' AND "admin_role" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_role_required" CHECK ("users"."role" <> 'ADMIN' OR "users"."admin_role" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_vendor_no_admin_role" CHECK ("users"."role" <> 'VENDOR' OR "users"."admin_role" IS NULL);--> statement-breakpoint
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_awarded_value_nonneg" CHECK ("solicitations"."awarded_value" IS NULL OR "solicitations"."awarded_value" >= 0);--> statement-breakpoint
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_outcome_gate" CHECK ("solicitations"."status" NOT IN ('AWARDED','REJECTED','CLOSED')
          OR ("solicitations"."outcome_recorded_by" IS NOT NULL AND "solicitations"."outcome_recorded_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_lm_provenance" CHECK ("solicitations"."lm_compliance_matrix" IS NULL
          OR ("solicitations"."lm_extracted_at" IS NOT NULL AND "solicitations"."lm_extraction_model" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_esign_requires_review" CHECK ("contracts"."esign_status" = 'NOT_STARTED'
          OR ("contracts"."agreement_reviewed_by" IS NOT NULL AND "contracts"."agreement_reviewed_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vendor_signed_pair" CHECK (("contracts"."vendor_signed_by_user_id" IS NULL) = ("contracts"."vendor_signed_at" IS NULL));--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_retention_review_pair" CHECK (("documents"."retention_reviewed_by" IS NULL) = ("documents"."retention_reviewed_at" IS NULL));
-- HAND-EDIT: the documents_owner_exactly_one / documents_owner_matches_type re-creates that
-- drizzle-kit generated here were MOVED to manual/0012_phase_a_checks.sql (see the note above the
-- users backfill — the matches-type CHECK uses enum labels added by ALTER TYPE in this same
-- transaction, which PostgreSQL rejects with 55P04).