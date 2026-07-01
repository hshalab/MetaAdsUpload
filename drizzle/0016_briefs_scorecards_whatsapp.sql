CREATE TABLE "brief_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brief_content" text,
	"format_id" text,
	"angle_id" text,
	"product_id" text,
	"country_id" text,
	"offer_type_id" text,
	"script_structure_id" text,
	"customer_avatar_ids" jsonb DEFAULT '[]'::jsonb,
	"estimated_minutes" integer,
	"priority" text DEFAULT 'medium',
	"references" jsonb DEFAULT '[]'::jsonb,
	"script_content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "brief_content" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "references" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;