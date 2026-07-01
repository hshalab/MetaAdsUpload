ALTER TABLE "ads_cache" ADD COLUMN "video_id" text;--> statement-breakpoint
ALTER TABLE "ads_cache" ADD COLUMN "image_hash" text;--> statement-breakpoint
ALTER TABLE "adset_owners" ADD COLUMN "angle" text;--> statement-breakpoint
ALTER TABLE "adset_owners" ADD COLUMN "problem" text;--> statement-breakpoint
ALTER TABLE "adset_owners" ADD COLUMN "verdict" text;--> statement-breakpoint
ALTER TABLE "adset_owners" ADD COLUMN "verdict_at" timestamp;--> statement-breakpoint
ALTER TABLE "adset_owners" ADD COLUMN "backfilled_at" timestamp;--> statement-breakpoint
CREATE INDEX "ads_cache_video_id_idx" ON "ads_cache" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "ads_cache_image_hash_idx" ON "ads_cache" USING btree ("image_hash");