CREATE TABLE "creative_roadmap" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_number" integer,
	"concept_name" text NOT NULL,
	"author_id" text,
	"desire_id" text,
	"sub_avatar_id" text,
	"angle_id" text,
	"awareness_level" text,
	"file_type" text,
	"status" text DEFAULT 'ideation' NOT NULL,
	"hypothesis" text,
	"variable_tested" text,
	"what_happened" text,
	"what_we_learned" text,
	"meta_ad_id" text,
	"assignment_id" text,
	"ad_type" text,
	"breakthrough_memo" text,
	"link_to_brief" text,
	"link_to_ad" text,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"last_classification" text,
	"last_spend" real,
	"last_roas" real,
	"last_cpa" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopify_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_orders" integer DEFAULT 0,
	"total_revenue" real DEFAULT 0,
	"new_customer_orders" integer DEFAULT 0,
	"new_customer_revenue" real DEFAULT 0,
	"returning_customer_orders" integer DEFAULT 0,
	"returning_customer_revenue" real DEFAULT 0,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_daily_stats_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "shopify_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopify_order_id" text NOT NULL,
	"order_date" date NOT NULL,
	"total_price" real NOT NULL,
	"is_new_customer" boolean NOT NULL,
	"customer_id" text,
	"customer_email" text,
	"utm_campaign" text,
	"utm_adset" text,
	"utm_ad" text,
	"utm_source" text,
	"utm_medium" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_orders_shopify_order_id_unique" UNIQUE("shopify_order_id")
);
--> statement-breakpoint
CREATE TABLE "strategy_angles" (
	"id" text PRIMARY KEY NOT NULL,
	"sub_avatar_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_desires" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_sub_avatars" (
	"id" text PRIMARY KEY NOT NULL,
	"desire_id" text NOT NULL,
	"name" text NOT NULL,
	"behavior" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evolve_settings" ADD COLUMN "surf_mode_campaign_ids" text;--> statement-breakpoint
ALTER TABLE "evolve_settings" ADD COLUMN "graveyard_mappings" text;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "new_customer_revenue" real;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "nc_roas" real;--> statement-breakpoint
CREATE INDEX "creative_roadmap_status_idx" ON "creative_roadmap" USING btree ("status");--> statement-breakpoint
CREATE INDEX "creative_roadmap_author_id_idx" ON "creative_roadmap" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "creative_roadmap_meta_ad_id_idx" ON "creative_roadmap" USING btree ("meta_ad_id");--> statement-breakpoint
CREATE INDEX "creative_roadmap_desire_id_idx" ON "creative_roadmap" USING btree ("desire_id");--> statement-breakpoint
CREATE INDEX "shopify_orders_date_idx" ON "shopify_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "shopify_orders_adset_idx" ON "shopify_orders" USING btree ("utm_adset");--> statement-breakpoint
CREATE INDEX "shopify_orders_campaign_idx" ON "shopify_orders" USING btree ("utm_campaign");--> statement-breakpoint
CREATE INDEX "shopify_orders_date_adset_idx" ON "shopify_orders" USING btree ("order_date","utm_adset");--> statement-breakpoint
CREATE INDEX "strategy_angles_sub_avatar_id_idx" ON "strategy_angles" USING btree ("sub_avatar_id");--> statement-breakpoint
CREATE INDEX "strategy_sub_avatars_desire_id_idx" ON "strategy_sub_avatars" USING btree ("desire_id");--> statement-breakpoint
CREATE INDEX "ads_cache_adset_id_idx" ON "ads_cache" USING btree ("adset_id");--> statement-breakpoint
CREATE INDEX "ads_cache_campaign_id_idx" ON "ads_cache" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "adsets_cache_campaign_id_idx" ON "adsets_cache" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "adsets_cache_status_idx" ON "adsets_cache" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_rules_enabled_idx" ON "automation_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "campaigns_cache_status_idx" ON "campaigns_cache" USING btree ("status");