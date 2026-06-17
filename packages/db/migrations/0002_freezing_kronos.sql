ALTER TYPE "public"."token_purpose" ADD VALUE 'VENDOR_INVITE';--> statement-breakpoint
CREATE TABLE "vendor_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"invited_email" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_jti" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_invites_accept_pair" CHECK (("vendor_invites"."accepted_at" IS NULL) = ("vendor_invites"."accepted_user_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD CONSTRAINT "vendor_invites_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD CONSTRAINT "vendor_invites_vendor_fk" FOREIGN KEY ("org_id","vendor_id") REFERENCES "public"."vendors"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD CONSTRAINT "vendor_invites_created_by_fk" FOREIGN KEY ("org_id","created_by") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD CONSTRAINT "vendor_invites_accepted_user_fk" FOREIGN KEY ("org_id","accepted_user_id") REFERENCES "public"."users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_invites_jti_key" ON "vendor_invites" USING btree ("org_id","token_jti");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_invites_token_hash_key" ON "vendor_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "vendor_invites_org_idx" ON "vendor_invites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendor_invites_vendor_idx" ON "vendor_invites" USING btree ("org_id","vendor_id");