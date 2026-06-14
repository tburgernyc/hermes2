CREATE TYPE "public"."actor_type" AS ENUM('SYSTEM', 'ADMIN', 'VENDOR', 'TOKEN');--> statement-breakpoint
CREATE TYPE "public"."ar_followup_status" AS ENUM('SCHEDULED', 'SENT', 'PAID', 'ESCALATED', 'WRITTEN_OFF');--> statement-breakpoint
CREATE TYPE "public"."award_amount_kind" AS ENUM('EXACT', 'ESTIMATED', 'CEILING', 'OBLIGATED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."classification_source" AS ENUM('AI_TRIAGE', 'HUMAN', 'SAM_GOV', 'HEURISTIC');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('PENDING_SIGNATURE', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'CLOSED_OUT');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('FFP', 'TM', 'FFP_MILESTONE');--> statement-breakpoint
CREATE TYPE "public"."cost_type" AS ENUM('LABOR', 'MATERIAL', 'ODC', 'SUBCONTRACT', 'TRAVEL');--> statement-breakpoint
CREATE TYPE "public"."document_entity_type" AS ENUM('SOLICITATION', 'VENDOR', 'VENDOR_PROSPECT', 'VENDOR_QUOTE', 'PROPOSAL', 'CONTRACT', 'CONTRACT_MILESTONE');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('SOLICITATION_ATTACHMENT', 'CAPABILITY_STATEMENT', 'COI', 'W9', 'QUOTE', 'PROPOSAL_DRAFT', 'PROPOSAL_FINAL', 'SIGNED_CONTRACT', 'DELIVERABLE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."esign_status" AS ENUM('NOT_STARTED', 'SENT', 'SIGNED', 'DECLINED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."notice_type" AS ENUM('SOLICITATION', 'COMBINED_SYNOPSIS_SOLICITATION', 'PRESOLICITATION', 'SOURCES_SOUGHT', 'RFI', 'SPECIAL_NOTICE', 'AWARD_NOTICE', 'JUSTIFICATION');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'BOUNCED', 'RESPONDED', 'OPTED_OUT', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."outreach_step" AS ENUM('DAY_0', 'DAY_3', 'DAY_7');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('DRAFT', 'PRICING_REVIEW', 'COMPLIANCE_REVIEW', 'COUNSEL_REVIEW', 'READY_TO_SUBMIT', 'SUBMITTED', 'WON', 'LOST', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."prospect_source" AS ENUM('DISCOVERY', 'TOKENIZED_SUBMISSION', 'MANUAL', 'REFERRAL');--> statement-breakpoint
CREATE TYPE "public"."prospect_status" AS ENUM('NEW', 'SCREENED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'PROMOTED', 'DECLINED', 'OPTED_OUT');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('INVITED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN', 'SELECTED');--> statement-breakpoint
CREATE TYPE "public"."set_aside_type" AS ENUM('NONE', 'TOTAL_SMALL_BUSINESS', 'EIGHT_A', 'HUBZONE', 'SDVOSB', 'WOSB', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."small_business_status" AS ENUM('SMALL', 'OTHER_THAN_SMALL', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."solicitation_status" AS ENUM('PENDING_TRIAGE', 'TRIAGE_COMPLETE', 'NO_GO', 'READY_FOR_SOURCING', 'AWAITING_APPROVAL', 'SOURCING_IN_PROGRESS', 'PRICING_PENDING', 'PROPOSAL_DRAFT', 'SUBMITTED', 'AWARDED', 'CLOSED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('QUOTE_SUBMISSION', 'OPT_OUT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'VENDOR');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('PENDING_REVIEW', 'VETTED', 'NON_COMPLIANT', 'EXCLUDED');--> statement-breakpoint
CREATE TYPE "public"."zero_float_fit" AS ENUM('STRONG', 'MODERATE', 'WEAK', 'NONE');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"actor_email" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_attributable" CHECK ("audit_log"."actor_type" = 'SYSTEM' OR "audit_log"."actor_user_id" IS NOT NULL OR "audit_log"."actor_email" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ein" varchar(10),
	"uei" varchar(12),
	"cage_code" varchar(5),
	"primary_domain" text,
	"directives" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_uei_format" CHECK ("orgs"."uei" IS NULL OR "orgs"."uei" ~ '^[A-Z0-9]{12}$'),
	CONSTRAINT "orgs_cage_format" CHECK ("orgs"."cage_code" IS NULL OR "orgs"."cage_code" ~ '^[A-Z0-9]{5}$'),
	CONSTRAINT "orgs_ein_format" CHECK ("orgs"."ein" IS NULL OR "orgs"."ein" ~ '^[0-9]{2}-?[0-9]{7}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'VENDOR' NOT NULL,
	"totp_secret_ciphertext" text,
	"totp_enrolled_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "users_admin_requires_password" CHECK ("users"."role" <> 'ADMIN' OR "users"."password_hash" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "award_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"piid" text,
	"award_unique_key" text NOT NULL,
	"naics_code" varchar(6),
	"agency" text,
	"recipient" text,
	"award_amount" numeric(14, 2),
	"award_amount_kind" "award_amount_kind" DEFAULT 'UNKNOWN' NOT NULL,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_intel_amount_nonneg" CHECK ("award_intelligence"."award_amount" IS NULL OR "award_intelligence"."award_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "solicitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"notice_id" text NOT NULL,
	"title" text NOT NULL,
	"agency" text,
	"naics_code" varchar(6),
	"psc_code" varchar(4),
	"notice_type" "notice_type",
	"set_aside_type" "set_aside_type" DEFAULT 'NONE' NOT NULL,
	"contract_type" "contract_type",
	"is_services" boolean,
	"is_services_source" "classification_source",
	"is_defense" boolean DEFAULT false NOT NULL,
	"response_deadline" timestamp with time zone,
	"scope_text" text,
	"scope_embedding" vector(1024),
	"status" "solicitation_status" DEFAULT 'PENDING_TRIAGE' NOT NULL,
	"feasibility_score" integer,
	"zero_float_fit" "zero_float_fit",
	"rejection_reasons" jsonb,
	"triage_model" text,
	"triaged_at" timestamp with time zone,
	"sourcing_approved_by" uuid,
	"sourcing_approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitations_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "solicitations_feasibility_range" CHECK ("solicitations"."feasibility_score" IS NULL OR ("solicitations"."feasibility_score" BETWEEN 1 AND 10)),
	CONSTRAINT "solicitations_naics_format" CHECK ("solicitations"."naics_code" IS NULL OR "solicitations"."naics_code" ~ '^[0-9]{6}$'),
	CONSTRAINT "solicitations_sourcing_gate" CHECK ("solicitations"."status" NOT IN ('READY_FOR_SOURCING','AWAITING_APPROVAL','SOURCING_IN_PROGRESS','PRICING_PENDING','PROPOSAL_DRAFT','SUBMITTED','AWARDED')
          OR ("solicitations"."sourcing_approved_by" IS NOT NULL AND "solicitations"."sourcing_approved_at" IS NOT NULL)),
	CONSTRAINT "solicitations_is_services_provenance" CHECK ("solicitations"."is_services" IS NULL OR "solicitations"."is_services_source" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"solicitation_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"step" "outreach_step" DEFAULT 'DAY_0' NOT NULL,
	"status" "outreach_status" DEFAULT 'DRAFT' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"quote_token_hash" text,
	"quote_token_expires_at" timestamp with time zone,
	"optout_token_hash" text,
	"optout_token_expires_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_approval_gate" CHECK ("outreach_campaigns"."status" NOT IN ('APPROVED','SENT','RESPONDED','OPTED_OUT') OR ("outreach_campaigns"."approved_by" IS NOT NULL AND "outreach_campaigns"."approved_at" IS NOT NULL)),
	CONSTRAINT "outreach_sent_requires_timestamp" CHECK ("outreach_campaigns"."status" <> 'SENT' OR "outreach_campaigns"."sent_at" IS NOT NULL),
	CONSTRAINT "outreach_quote_token_expiry" CHECK (("outreach_campaigns"."quote_token_hash" IS NULL) = ("outreach_campaigns"."quote_token_expires_at" IS NULL)),
	CONSTRAINT "outreach_optout_token_expiry" CHECK (("outreach_campaigns"."optout_token_hash" IS NULL) = ("outreach_campaigns"."optout_token_expires_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "vendor_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"contact_email" text,
	"uei" varchar(12),
	"naics_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities_text" text,
	"capability_embedding" vector(1024),
	"discovery_score" integer,
	"prospect_source" "prospect_source" DEFAULT 'DISCOVERY' NOT NULL,
	"status" "prospect_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_prospects_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "vendor_prospects_score_range" CHECK ("vendor_prospects"."discovery_score" IS NULL OR ("vendor_prospects"."discovery_score" BETWEEN 1 AND 100)),
	CONSTRAINT "vendor_prospects_uei_format" CHECK ("vendor_prospects"."uei" IS NULL OR "vendor_prospects"."uei" ~ '^[A-Z0-9]{12}$')
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"promoted_from_prospect_id" uuid,
	"company_name" text NOT NULL,
	"contact_email" text,
	"uei" varchar(12),
	"cage_code" varchar(5),
	"small_business_status" "small_business_status" DEFAULT 'UNKNOWN' NOT NULL,
	"similarly_situated" boolean,
	"small_under_naics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities_text" text,
	"capability_embedding" vector(1024),
	"status" "vendor_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"vetted_by" uuid,
	"vetted_at" timestamp with time zone,
	"insurance_expiry" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "vendors_uei_format" CHECK ("vendors"."uei" IS NULL OR "vendors"."uei" ~ '^[A-Z0-9]{12}$'),
	CONSTRAINT "vendors_cage_format" CHECK ("vendors"."cage_code" IS NULL OR "vendors"."cage_code" ~ '^[A-Z0-9]{5}$'),
	CONSTRAINT "vendors_vetted_requires_vetter" CHECK ("vendors"."status" <> 'VETTED' OR ("vendors"."vetted_by" IS NOT NULL AND "vendors"."vetted_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"solicitation_id" uuid NOT NULL,
	"selected_quote_id" uuid,
	"awarded_vendor_id" uuid,
	"supersedes_proposal_id" uuid,
	"contract_type" "contract_type" NOT NULL,
	"status" "proposal_status" DEFAULT 'DRAFT' NOT NULL,
	"pricing_scenarios" jsonb,
	"compliance_checklist" jsonb,
	"prime_qualifying_status" "small_business_status",
	"prime_qualifying_naics" varchar(6),
	"government_payment_basis" numeric(14, 2),
	"non_similarly_situated_subs_total" numeric(14, 2),
	"total_cost_of_work" numeric(14, 2),
	"adequate_price_competition" boolean,
	"pass_through_justification" text,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"counsel_reviewed_by" uuid,
	"counsel_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "proposals_submit_requires_human" CHECK ("proposals"."status" NOT IN ('SUBMITTED','WON','LOST') OR ("proposals"."submitted_by" IS NOT NULL AND "proposals"."submitted_at" IS NOT NULL)),
	CONSTRAINT "proposals_submit_requires_counsel" CHECK ("proposals"."status" NOT IN ('SUBMITTED','WON','LOST') OR ("proposals"."counsel_reviewed_by" IS NOT NULL AND "proposals"."counsel_reviewed_at" IS NOT NULL)),
	CONSTRAINT "proposals_gov_payment_nonneg" CHECK ("proposals"."government_payment_basis" IS NULL OR "proposals"."government_payment_basis" >= 0),
	CONSTRAINT "proposals_non_sim_subs_nonneg" CHECK ("proposals"."non_similarly_situated_subs_total" IS NULL OR "proposals"."non_similarly_situated_subs_total" >= 0),
	CONSTRAINT "proposals_total_cost_nonneg" CHECK ("proposals"."total_cost_of_work" IS NULL OR "proposals"."total_cost_of_work" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_quote_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"cost_type" "cost_type" NOT NULL,
	"contract_type" "contract_type" NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '1' NOT NULL,
	"unit_rate" numeric(14, 2) NOT NULL,
	"markup_pct" numeric(6, 4) DEFAULT '0' NOT NULL,
	"extended_amount" numeric(14, 2),
	"similarly_situated" boolean,
	"sub_small_business_status" "small_business_status",
	"sub_subcontract_naics" varchar(6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_items_tm_markup_lock" CHECK (NOT ("vendor_quote_line_items"."contract_type" = 'TM' AND "vendor_quote_line_items"."cost_type" IN ('MATERIAL','SUBCONTRACT') AND "vendor_quote_line_items"."markup_pct" <> 0)),
	CONSTRAINT "line_items_qty_pos" CHECK ("vendor_quote_line_items"."quantity" > 0),
	CONSTRAINT "line_items_rate_nonneg" CHECK ("vendor_quote_line_items"."unit_rate" >= 0),
	CONSTRAINT "line_items_markup_nonneg" CHECK ("vendor_quote_line_items"."markup_pct" >= 0),
	CONSTRAINT "line_items_sub_naics_format" CHECK ("vendor_quote_line_items"."sub_subcontract_naics" IS NULL OR "vendor_quote_line_items"."sub_subcontract_naics" ~ '^[0-9]{6}$'),
	CONSTRAINT "line_items_sim_situated_consistency" CHECK (NOT ("vendor_quote_line_items"."similarly_situated" IS TRUE AND "vendor_quote_line_items"."sub_small_business_status" IS DISTINCT FROM 'SMALL'))
);
--> statement-breakpoint
CREATE TABLE "vendor_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"solicitation_id" uuid NOT NULL,
	"vendor_id" uuid,
	"prospect_id" uuid,
	"token_jti" text,
	"status" "quote_status" DEFAULT 'INVITED' NOT NULL,
	"total_price" numeric(14, 2),
	"period_of_performance" text,
	"pay_when_paid" boolean DEFAULT true NOT NULL,
	"notes" text,
	"ai_rank" integer,
	"ai_rationale" text,
	"evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_quotes_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "vendor_quotes_party_xor" CHECK (("vendor_quotes"."vendor_id" IS NOT NULL) <> ("vendor_quotes"."prospect_id" IS NOT NULL)),
	CONSTRAINT "vendor_quotes_total_nonneg" CHECK ("vendor_quotes"."total_price" IS NULL OR "vendor_quotes"."total_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ar_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"milestone_id" uuid,
	"amount_due" numeric(14, 2),
	"due_date" timestamp with time zone,
	"status" "ar_followup_status" DEFAULT 'SCHEDULED' NOT NULL,
	"next_followup_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ar_amount_nonneg" CHECK ("ar_followups"."amount_due" IS NULL OR "ar_followups"."amount_due" >= 0)
);
--> statement-breakpoint
CREATE TABLE "contract_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2),
	"due_date" timestamp with time zone,
	"status" "milestone_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "milestones_amount_nonneg" CHECK ("contract_milestones"."amount" IS NULL OR "contract_milestones"."amount" >= 0),
	CONSTRAINT "milestones_sequence_pos" CHECK ("contract_milestones"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"solicitation_id" uuid,
	"proposal_id" uuid,
	"awarded_vendor_id" uuid,
	"contract_type" "contract_type" NOT NULL,
	"total_value" numeric(14, 2),
	"pop_start" timestamp with time zone,
	"pop_end" timestamp with time zone,
	"status" "contract_status" DEFAULT 'PENDING_SIGNATURE' NOT NULL,
	"esign_status" "esign_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "contracts_value_nonneg" CHECK ("contracts"."total_value" IS NULL OR "contracts"."total_value" >= 0),
	CONSTRAINT "contracts_pop_order" CHECK ("contracts"."pop_start" IS NULL OR "contracts"."pop_end" IS NULL OR "contracts"."pop_end" >= "contracts"."pop_start")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity_type" "document_entity_type" NOT NULL,
	"solicitation_id" uuid,
	"vendor_id" uuid,
	"prospect_id" uuid,
	"quote_id" uuid,
	"proposal_id" uuid,
	"contract_id" uuid,
	"milestone_id" uuid,
	"kind" "document_kind" DEFAULT 'OTHER' NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" varchar(64),
	"magic_byte_validated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_byte_size_pos" CHECK ("documents"."byte_size" > 0),
	CONSTRAINT "documents_sha256_format" CHECK ("documents"."sha256" IS NULL OR "documents"."sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "documents_owner_exactly_one" CHECK ((
        (CASE WHEN "documents"."solicitation_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "documents"."vendor_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "documents"."prospect_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "documents"."quote_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "documents"."proposal_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "documents"."contract_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "documents"."milestone_id" IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1),
	CONSTRAINT "documents_owner_matches_type" CHECK (("documents"."entity_type" = 'SOLICITATION' AND "documents"."solicitation_id" IS NOT NULL)
        OR ("documents"."entity_type" = 'VENDOR' AND "documents"."vendor_id" IS NOT NULL)
        OR ("documents"."entity_type" = 'VENDOR_PROSPECT' AND "documents"."prospect_id" IS NOT NULL)
        OR ("documents"."entity_type" = 'VENDOR_QUOTE' AND "documents"."quote_id" IS NOT NULL)
        OR ("documents"."entity_type" = 'PROPOSAL' AND "documents"."proposal_id" IS NOT NULL)
        OR ("documents"."entity_type" = 'CONTRACT' AND "documents"."contract_id" IS NOT NULL)
        OR ("documents"."entity_type" = 'CONTRACT_MILESTONE' AND "documents"."milestone_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_fk" FOREIGN KEY ("org_id","actor_user_id") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_intelligence" ADD CONSTRAINT "award_intelligence_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitations" ADD CONSTRAINT "solicitations_sourcing_approver_fk" FOREIGN KEY ("org_id","sourcing_approved_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_solicitation_fk" FOREIGN KEY ("org_id","solicitation_id") REFERENCES "public"."solicitations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_prospect_fk" FOREIGN KEY ("org_id","prospect_id") REFERENCES "public"."vendor_prospects"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_approved_by_fk" FOREIGN KEY ("org_id","approved_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_prospects" ADD CONSTRAINT "vendor_prospects_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_prospect_fk" FOREIGN KEY ("org_id","promoted_from_prospect_id") REFERENCES "public"."vendor_prospects"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_vetted_by_fk" FOREIGN KEY ("org_id","vetted_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_solicitation_fk" FOREIGN KEY ("org_id","solicitation_id") REFERENCES "public"."solicitations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_selected_quote_fk" FOREIGN KEY ("org_id","selected_quote_id") REFERENCES "public"."vendor_quotes"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_awarded_vendor_fk" FOREIGN KEY ("org_id","awarded_vendor_id") REFERENCES "public"."vendors"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_supersedes_fk" FOREIGN KEY ("org_id","supersedes_proposal_id") REFERENCES "public"."proposals"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_submitted_by_fk" FOREIGN KEY ("org_id","submitted_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_counsel_by_fk" FOREIGN KEY ("org_id","counsel_reviewed_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quote_line_items" ADD CONSTRAINT "vendor_quote_line_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quote_line_items" ADD CONSTRAINT "line_items_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."vendor_quotes"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_solicitation_fk" FOREIGN KEY ("org_id","solicitation_id") REFERENCES "public"."solicitations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_vendor_fk" FOREIGN KEY ("org_id","vendor_id") REFERENCES "public"."vendors"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_prospect_fk" FOREIGN KEY ("org_id","prospect_id") REFERENCES "public"."vendor_prospects"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_followups" ADD CONSTRAINT "ar_followups_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_followups" ADD CONSTRAINT "ar_contract_fk" FOREIGN KEY ("org_id","contract_id") REFERENCES "public"."contracts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_followups" ADD CONSTRAINT "ar_milestone_fk" FOREIGN KEY ("org_id","milestone_id") REFERENCES "public"."contract_milestones"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_milestones" ADD CONSTRAINT "milestones_contract_fk" FOREIGN KEY ("org_id","contract_id") REFERENCES "public"."contracts"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_solicitation_fk" FOREIGN KEY ("org_id","solicitation_id") REFERENCES "public"."solicitations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_fk" FOREIGN KEY ("org_id","proposal_id") REFERENCES "public"."proposals"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vendor_fk" FOREIGN KEY ("org_id","awarded_vendor_id") REFERENCES "public"."vendors"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_solicitation_fk" FOREIGN KEY ("org_id","solicitation_id") REFERENCES "public"."solicitations"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vendor_fk" FOREIGN KEY ("org_id","vendor_id") REFERENCES "public"."vendors"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_prospect_fk" FOREIGN KEY ("org_id","prospect_id") REFERENCES "public"."vendor_prospects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."vendor_quotes"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_proposal_fk" FOREIGN KEY ("org_id","proposal_id") REFERENCES "public"."proposals"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_fk" FOREIGN KEY ("org_id","contract_id") REFERENCES "public"."contracts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_milestone_fk" FOREIGN KEY ("org_id","milestone_id") REFERENCES "public"."contract_milestones"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_org_idx" ON "audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_slug_key" ON "orgs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "award_intel_unique_key" ON "award_intelligence" USING btree ("org_id","award_unique_key");--> statement-breakpoint
CREATE INDEX "award_intel_naics_idx" ON "award_intelligence" USING btree ("naics_code");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitations_notice_key" ON "solicitations" USING btree ("org_id","notice_id");--> statement-breakpoint
CREATE INDEX "solicitations_org_idx" ON "solicitations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "solicitations_status_idx" ON "solicitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "solicitations_scope_vec_idx" ON "solicitations" USING hnsw ("scope_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_quote_token_key" ON "outreach_campaigns" USING btree ("quote_token_hash") WHERE "outreach_campaigns"."quote_token_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_optout_token_key" ON "outreach_campaigns" USING btree ("optout_token_hash") WHERE "outreach_campaigns"."optout_token_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "outreach_org_idx" ON "outreach_campaigns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "outreach_solicitation_idx" ON "outreach_campaigns" USING btree ("solicitation_id");--> statement-breakpoint
CREATE INDEX "outreach_prospect_idx" ON "outreach_campaigns" USING btree ("prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_prospects_email_key" ON "vendor_prospects" USING btree ("org_id",lower("contact_email")) WHERE "vendor_prospects"."contact_email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendor_prospects_org_idx" ON "vendor_prospects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendor_prospects_cap_vec_idx" ON "vendor_prospects" USING hnsw ("capability_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_promoted_from_key" ON "vendors" USING btree ("org_id","promoted_from_prospect_id") WHERE "vendors"."promoted_from_prospect_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendors_org_idx" ON "vendors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendors_status_idx" ON "vendors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendors_cap_vec_idx" ON "vendors" USING hnsw ("capability_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "proposals_org_idx" ON "proposals" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "proposals_solicitation_idx" ON "proposals" USING btree ("solicitation_id");--> statement-breakpoint
CREATE INDEX "line_items_quote_idx" ON "vendor_quote_line_items" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_quotes_jti_key" ON "vendor_quotes" USING btree ("org_id","token_jti") WHERE "vendor_quotes"."token_jti" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendor_quotes_org_idx" ON "vendor_quotes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendor_quotes_solicitation_idx" ON "vendor_quotes" USING btree ("solicitation_id");--> statement-breakpoint
CREATE INDEX "vendor_quotes_vendor_idx" ON "vendor_quotes" USING btree ("vendor_id") WHERE "vendor_quotes"."vendor_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendor_quotes_prospect_idx" ON "vendor_quotes" USING btree ("prospect_id") WHERE "vendor_quotes"."prospect_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ar_org_idx" ON "ar_followups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ar_contract_idx" ON "ar_followups" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "milestones_contract_seq_key" ON "contract_milestones" USING btree ("contract_id","sequence");--> statement-breakpoint
CREATE INDEX "milestones_contract_idx" ON "contract_milestones" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contracts_org_idx" ON "contracts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contracts_solicitation_idx" ON "contracts" USING btree ("solicitation_id");--> statement-breakpoint
CREATE INDEX "contracts_proposal_idx" ON "contracts" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "contracts_vendor_idx" ON "contracts" USING btree ("awarded_vendor_id");--> statement-breakpoint
CREATE INDEX "documents_org_idx" ON "documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "documents_entity_idx" ON "documents" USING btree ("entity_type");