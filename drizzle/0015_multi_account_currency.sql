ALTER TABLE "ads_cache" ADD COLUMN "ad_account_id" text;--> statement-breakpoint
ALTER TABLE "adsets_cache" ADD COLUMN "ad_account_id" text;--> statement-breakpoint
ALTER TABLE "campaigns_cache" ADD COLUMN "ad_account_id" text;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "ad_account_id" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "currency" text DEFAULT 'SEK';