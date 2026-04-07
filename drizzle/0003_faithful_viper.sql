CREATE TABLE "ad_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_id" text NOT NULL,
	"classification" text NOT NULL,
	"spend" real DEFAULT 0,
	"roas" real DEFAULT 0,
	"cpa" real DEFAULT 0,
	"purchases" integer DEFAULT 0,
	"recommendation" text,
	"action_taken" text,
	"action_taken_at" timestamp,
	"campaign_id" text,
	"adset_id" text,
	"date_range_start" text,
	"date_range_end" text,
	"classified_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"entity_id" text,
	"entity_type" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"audited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolve_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_roas" real DEFAULT 2 NOT NULL,
	"hold_roas" real DEFAULT 1.7 NOT NULL,
	"breakeven_roas" real DEFAULT 1.42 NOT NULL,
	"target_cpa" real DEFAULT 30 NOT NULL,
	"min_daily_spend" real DEFAULT 50 NOT NULL,
	"learning_period_days" integer DEFAULT 7 NOT NULL,
	"scaling_protocol_days" integer DEFAULT 3 NOT NULL,
	"zombie_cost_cap_discount" real DEFAULT 0.2 NOT NULL,
	"max_ad_sets_per_campaign" integer DEFAULT 10 NOT NULL,
	"surf_mode_enabled" boolean DEFAULT false NOT NULL,
	"surf_interval_hours" integer DEFAULT 4 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scaling_protocol_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"status" text DEFAULT 'monitoring' NOT NULL,
	"consecutive_days_above_target" integer DEFAULT 0 NOT NULL,
	"consecutive_days_below_breakeven" integer DEFAULT 0 NOT NULL,
	"last_action" text,
	"last_action_at" timestamp,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"exited_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "creatives" ALTER COLUMN "batch_number" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "upload_jobs" ALTER COLUMN "total_steps" SET DEFAULT 4;--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD COLUMN "filename" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD COLUMN "media_type" text DEFAULT 'video';--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD COLUMN "r2_key" text;--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD COLUMN "r2_url" text;--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD COLUMN "video_id" text;--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD COLUMN "image_hash" text;--> statement-breakpoint
CREATE INDEX "ad_classifications_ad_id_idx" ON "ad_classifications" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "ad_classifications_classification_idx" ON "ad_classifications" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "scaling_protocol_entity_idx" ON "scaling_protocol_log" USING btree ("entity_id","entity_type");