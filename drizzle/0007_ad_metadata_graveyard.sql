ALTER TABLE "ad_owners" ADD COLUMN "angle" text;--> statement-breakpoint
ALTER TABLE "ad_owners" ADD COLUMN "problem" text;--> statement-breakpoint
ALTER TABLE "ad_owners" ADD COLUMN "template_id" integer;--> statement-breakpoint
ALTER TABLE "ad_owners" ADD COLUMN "template_name" text;--> statement-breakpoint
ALTER TABLE "ad_owners" ADD COLUMN "graveyard_outcome" text;--> statement-breakpoint
ALTER TABLE "ad_owners" ADD COLUMN "graveyard_at" timestamp;--> statement-breakpoint
CREATE INDEX "ad_owners_template_idx" ON "ad_owners" USING btree ("template_id");