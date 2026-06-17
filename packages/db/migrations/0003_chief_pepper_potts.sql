CREATE TYPE "public"."inquiry_intent" AS ENUM('TEAMING', 'AGENCY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('NEW', 'REVIEWED');--> statement-breakpoint
CREATE TABLE "contact_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"intent" "inquiry_intent" DEFAULT 'OTHER' NOT NULL,
	"message" text NOT NULL,
	"status" "inquiry_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_inquiries_text_present" CHECK (length(btrim("contact_inquiries"."name")) > 0 AND length(btrim("contact_inquiries"."message")) > 0)
);
--> statement-breakpoint
ALTER TABLE "contact_inquiries" ADD CONSTRAINT "contact_inquiries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_inquiries_org_idx" ON "contact_inquiries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contact_inquiries_status_idx" ON "contact_inquiries" USING btree ("status");