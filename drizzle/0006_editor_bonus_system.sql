CREATE TABLE "ad_bonuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_id" text NOT NULL,
	"editor_id" text NOT NULL,
	"earned_bonus" real DEFAULT 0 NOT NULL,
	"earned_tier" integer DEFAULT 0 NOT NULL,
	"paid_amount" real DEFAULT 0 NOT NULL,
	"peak_spend" real DEFAULT 0 NOT NULL,
	"peak_roas" real DEFAULT 0 NOT NULL,
	"first_qualified_at" timestamp,
	"last_evaluated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_bonuses_ad_id_unique" UNIQUE("ad_id")
);
--> statement-breakpoint
CREATE TABLE "ad_owners" (
	"ad_id" text PRIMARY KEY NOT NULL,
	"video_editor_id" text,
	"creative_strategist_id" text,
	"campaign_id" text,
	"adset_id" text,
	"ad_name" text,
	"source" text DEFAULT 'analyzer',
	"assigned_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "public_page_password" text;--> statement-breakpoint
CREATE INDEX "ad_bonuses_editor_idx" ON "ad_bonuses" USING btree ("editor_id");--> statement-breakpoint
CREATE INDEX "ad_bonuses_status_idx" ON "ad_bonuses" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "ad_owners_video_editor_idx" ON "ad_owners" USING btree ("video_editor_id");--> statement-breakpoint
CREATE INDEX "ad_owners_strategist_idx" ON "ad_owners" USING btree ("creative_strategist_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_slug_unique" UNIQUE("slug");