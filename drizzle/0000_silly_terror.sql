CREATE TABLE "ads_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"adset_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"creative_id" text,
	"preview_url" text,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adsets_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"daily_budget" real,
	"lifetime_budget" real,
	"targeting" jsonb DEFAULT '{}'::jsonb,
	"optimization_goal" text,
	"billing_event" text,
	"bid_strategy" text,
	"start_time" timestamp,
	"end_time" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "angles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "angles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"batch_number" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"format_id" text,
	"angle_id" text,
	"product_id" text,
	"country_id" text,
	"offer_type_id" text,
	"script_structure_id" text,
	"customer_avatar_ids" jsonb DEFAULT '[]'::jsonb,
	"landing_page" text,
	"assigned_to_id" text NOT NULL,
	"assigned_by_id" text NOT NULL,
	"creative_strategist_id" text,
	"creative_strategist_name" text,
	"status" text DEFAULT 'ready_for_editing' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"estimated_minutes" integer,
	"video_length_seconds" integer,
	"script_content" jsonb,
	"auto_name" text,
	"revision_feedback" text,
	"strategist_notes" text,
	"deliverable_url" text,
	"deliverable_r2_key" text,
	"meta_ad_id" text,
	"meta_adset_id" text,
	"meta_campaign_id" text,
	"meta_post_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"level" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"cooldown_hours" integer DEFAULT 24,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"objective" text,
	"daily_budget" real,
	"lifetime_budget" real,
	"budget_remaining" real,
	"buying_type" text,
	"start_time" timestamp,
	"stop_time" timestamp,
	"created_time" timestamp,
	"updated_time" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "countries_name_unique" UNIQUE("name"),
	CONSTRAINT "countries_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"meta_hash" text,
	"meta_video_id" text,
	"meta_image_hash" text,
	"thumbnail_url" text,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"duration" real,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"gdrive_file_id" text,
	"r2_key" text,
	"r2_url" text,
	"assignment_id" text,
	"editor_name" text,
	"batch_number" integer,
	"status" text DEFAULT 'uploaded',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_avatars" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_avatars_name_unique" UNIQUE("name"),
	CONSTRAINT "customer_avatars_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "editor_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"editor_id" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"ad_ids" jsonb DEFAULT '[]'::jsonb,
	"assignment_ids" jsonb DEFAULT '[]'::jsonb,
	"breakdown" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"paid_at" timestamp,
	"paid_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formats" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "formats_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"date_start" date NOT NULL,
	"date_stop" date NOT NULL,
	"spend" real DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"reach" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"link_clicks" integer DEFAULT 0,
	"ctr" real DEFAULT 0,
	"cpc" real DEFAULT 0,
	"cpm" real DEFAULT 0,
	"purchases" integer DEFAULT 0,
	"purchase_value" real DEFAULT 0,
	"roas" real DEFAULT 0,
	"video_views_3s" integer DEFAULT 0,
	"video_avg_watch_time" real DEFAULT 0,
	"video_length" real DEFAULT 0,
	"hook_rate" real DEFAULT 0,
	"hold_rate" real DEFAULT 0,
	"breakdown_key" text,
	"breakdown_value" text,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp,
	"facebook_user_id" text,
	"ad_accounts" jsonb DEFAULT '[]'::jsonb,
	"active_ad_account_id" text,
	"pages" jsonb DEFAULT '[]'::jsonb,
	"active_page_id" text,
	"pixel_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offer_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_unique" UNIQUE("name"),
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rule_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"action_taken" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_structures" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "script_structures_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"objective" text DEFAULT 'OUTCOME_SALES',
	"budget_type" text DEFAULT 'ABO',
	"daily_budget" real,
	"headlines" jsonb DEFAULT '[]'::jsonb,
	"primary_texts" jsonb DEFAULT '[]'::jsonb,
	"descriptions" jsonb DEFAULT '[]'::jsonb,
	"cta_type" text DEFAULT 'SHOP_NOW',
	"landing_pages" jsonb DEFAULT '[]'::jsonb,
	"target_countries" jsonb DEFAULT '["SE"]'::jsonb,
	"age_min" integer,
	"age_max" integer,
	"genders" jsonb,
	"optimization_goal" text DEFAULT 'OFFSITE_CONVERSIONS',
	"conversion_event" text DEFAULT 'PURCHASE',
	"bid_strategy" text DEFAULT 'LOWEST_COST_WITHOUT_CAP',
	"adset_name_template" text DEFAULT '{product} {angle} {country}',
	"ad_name_template" text DEFAULT '{country} {editor} {creative} {lp}',
	"product_name" text,
	"angle_name" text,
	"pixel_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"assignment_id" text,
	"task_type" text NOT NULL,
	"task_name" text NOT NULL,
	"notes" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_seconds" integer,
	"video_output_seconds" integer,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_steps" integer DEFAULT 5,
	"current_step" integer DEFAULT 0,
	"step_label" text,
	"campaign_id" text,
	"adset_id" text,
	"ad_id" text,
	"creative_id" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hourly_rate" real,
	"timezone" text DEFAULT 'Europe/Stockholm',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "assignments_assigned_to_id_idx" ON "assignments" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "assignments_status_idx" ON "assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "editor_payouts_editor_id_idx" ON "editor_payouts" USING btree ("editor_id");--> statement-breakpoint
CREATE INDEX "editor_payouts_status_idx" ON "editor_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "insights_entity_date_idx" ON "insights" USING btree ("entity_id","entity_type","date_start");--> statement-breakpoint
CREATE INDEX "time_entries_user_id_idx" ON "time_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "time_entries_assignment_id_idx" ON "time_entries" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "time_entries_status_idx" ON "time_entries" USING btree ("status");