CREATE TABLE "deliverable_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"r2_key" text NOT NULL,
	"r2_url" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"duration" real,
	"thumbnail_r2_key" text,
	"thumbnail_url" text,
	"uploaded_by_id" text NOT NULL,
	"review_status" text DEFAULT 'no_status' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"deliverable_version_id" text NOT NULL,
	"parent_comment_id" text,
	"author_id" text,
	"guest_name" text,
	"body" text NOT NULL,
	"timecode_seconds" real,
	"annotation" jsonb,
	"is_internal" boolean DEFAULT true NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"reactions" jsonb DEFAULT '{}'::jsonb,
	"mentioned_user_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"token" text NOT NULL,
	"password" text,
	"expires_at" timestamp,
	"created_by_id" text NOT NULL,
	"allow_comments" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "current_version_id" text;--> statement-breakpoint
CREATE INDEX "dv_assignment_idx" ON "deliverable_versions" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "dv_version_idx" ON "deliverable_versions" USING btree ("assignment_id","version_number");--> statement-breakpoint
CREATE INDEX "rc_version_idx" ON "review_comments" USING btree ("deliverable_version_id");--> statement-breakpoint
CREATE INDEX "rc_parent_idx" ON "review_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "sl_token_idx" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sl_assignment_idx" ON "share_links" USING btree ("assignment_id");