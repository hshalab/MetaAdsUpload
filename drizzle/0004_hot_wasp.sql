ALTER TABLE "evolve_settings" ALTER COLUMN "max_ad_sets_per_campaign" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "evolve_settings" ADD COLUMN "graveyard_campaign_id" text;