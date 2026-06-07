CREATE TABLE "adset_owners" (
	"adset_id" text PRIMARY KEY NOT NULL,
	"video_editor_id" text,
	"creative_strategist_id" text,
	"campaign_id" text,
	"adset_name" text,
	"graveyard_outcome" text,
	"graveyard_at" timestamp,
	"source" text DEFAULT 'analyzer',
	"assigned_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "adset_owners_video_editor_idx" ON "adset_owners" USING btree ("video_editor_id");--> statement-breakpoint
CREATE INDEX "adset_owners_strategist_idx" ON "adset_owners" USING btree ("creative_strategist_id");