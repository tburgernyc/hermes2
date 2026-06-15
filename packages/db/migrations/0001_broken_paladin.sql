ALTER TABLE "users" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
CREATE INDEX "users_vendor_idx" ON "users" USING btree ("vendor_id") WHERE "users"."vendor_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_vendor_link_role" CHECK ("users"."vendor_id" IS NULL OR "users"."role" = 'VENDOR');