import { pgTable, text, integer, real, boolean, timestamp, jsonb, serial, varchar, date, index } from "drizzle-orm/pg-core";

// ─── Users & Auth ────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // bcrypt hash
  name: text("name").notNull(),
  role: text("role").notNull().default("editor"), // "admin" | "editor"
  isActive: boolean("is_active").default(true).notNull(),
  hourlyRate: real("hourly_rate"),
  timezone: text("timezone").default("Europe/Stockholm"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Dynamic Option Tables ───────────────────────────────────────────────────

export const angles = pgTable("angles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const formats = pgTable("formats", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const countries = pgTable("countries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const offerTypes = pgTable("offer_types", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scriptStructures = pgTable("script_structures", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerAvatars = pgTable("customer_avatars", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Assignments ─────────────────────────────────────────────────────────────

export const assignments = pgTable("assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  batchNumber: integer("batch_number").notNull(),
  version: integer("version").default(1).notNull(),
  formatId: text("format_id"),
  angleId: text("angle_id"),
  productId: text("product_id"),
  countryId: text("country_id"),
  offerTypeId: text("offer_type_id"),
  scriptStructureId: text("script_structure_id"),
  customerAvatarIds: jsonb("customer_avatar_ids").$type<string[]>().default([]),
  landingPage: text("landing_page"),
  assignedToId: text("assigned_to_id").notNull(),
  assignedById: text("assigned_by_id").notNull(),
  creativeStrategistId: text("creative_strategist_id"),
  status: text("status").notNull().default("ready_for_editing"),
  // Statuses: ready_for_editing, editing_now, ready_for_review, revision, ready_for_posting, posted
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedMinutes: integer("estimated_minutes"),
  videoLengthSeconds: integer("video_length_seconds"),
  scriptContent: jsonb("script_content").$type<{ hooks: Array<{ id: string; label: string; eng: string; se: string }>; body: { eng: string; se: string } }>(),
  autoName: text("auto_name"),
  revisionFeedback: text("revision_feedback"),
  deliverableUrl: text("deliverable_url"),
  deliverableR2Key: text("deliverable_r2_key"),
  metaAdId: text("meta_ad_id"),
  metaAdsetId: text("meta_adset_id"),
  metaCampaignId: text("meta_campaign_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("assignments_assigned_to_id_idx").on(table.assignedToId),
  index("assignments_status_idx").on(table.status),
]);

// ─── Time Entries ────────────────────────────────────────────────────────────

export const timeEntries = pgTable("time_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  assignmentId: text("assignment_id"),
  taskType: text("task_type").notNull(), // new_video, revision, sourcing, static_ad, other
  taskName: text("task_name").notNull(),
  notes: text("notes"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds"),
  videoOutputSeconds: integer("video_output_seconds"),
  status: text("status").notNull().default("in_progress"), // in_progress, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("time_entries_user_id_idx").on(table.userId),
  index("time_entries_assignment_id_idx").on(table.assignmentId),
  index("time_entries_status_idx").on(table.status),
]);

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),

  // Campaign
  objective: text("objective").default("OUTCOME_SALES"),
  budgetType: text("budget_type").default("ABO"), // ABO or CBO
  dailyBudget: real("daily_budget"), // in SEK

  // Ad Copy
  headlines: jsonb("headlines").$type<string[]>().default([]),
  primaryTexts: jsonb("primary_texts").$type<string[]>().default([]),
  descriptions: jsonb("descriptions").$type<string[]>().default([]),
  ctaType: text("cta_type").default("SHOP_NOW"),

  // Landing Pages
  landingPages: jsonb("landing_pages").$type<string[]>().default([]),

  // Targeting
  targetCountries: jsonb("target_countries").$type<string[]>().default(["SE"]),
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  genders: jsonb("genders").$type<number[]>(), // [1]=female, [2]=male, [1,2]=all

  // Optimization
  optimizationGoal: text("optimization_goal").default("OFFSITE_CONVERSIONS"),
  conversionEvent: text("conversion_event").default("PURCHASE"),
  bidStrategy: text("bid_strategy").default("LOWEST_COST_WITHOUT_CAP"),

  // Naming Templates
  adsetNameTemplate: text("adset_name_template").default("{product} {angle} {country}"),
  adNameTemplate: text("ad_name_template").default("{country} {editor} {creative} {lp}"),

  // Product / Angle defaults
  productName: text("product_name"),
  angleName: text("angle_name"),

  // Pixel
  pixelId: text("pixel_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creatives = pgTable("creatives", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "video" | "image"
  source: text("source").notNull(), // "local" | "gdrive" | "meta"
  metaHash: text("meta_hash"),
  metaVideoId: text("meta_video_id"),
  metaImageHash: text("meta_image_hash"),
  thumbnailUrl: text("thumbnail_url"),
  fileSize: integer("file_size"),
  width: integer("width"),
  height: integer("height"),
  duration: real("duration"),
  tags: jsonb("tags").$type<string[]>().default([]),
  gdriveFileId: text("gdrive_file_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignsCache = pgTable("campaigns_cache", {
  id: text("id").primaryKey(), // Meta campaign ID
  name: text("name").notNull(),
  status: text("status").notNull(),
  objective: text("objective"),
  dailyBudget: real("daily_budget"),
  lifetimeBudget: real("lifetime_budget"),
  budgetRemaining: real("budget_remaining"),
  buyingType: text("buying_type"),
  startTime: timestamp("start_time"),
  stopTime: timestamp("stop_time"),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const adsetsCache = pgTable("adsets_cache", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  dailyBudget: real("daily_budget"),
  lifetimeBudget: real("lifetime_budget"),
  targeting: jsonb("targeting").$type<Record<string, unknown>>().default({}),
  optimizationGoal: text("optimization_goal"),
  billingEvent: text("billing_event"),
  bidStrategy: text("bid_strategy"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const adsCache = pgTable("ads_cache", {
  id: text("id").primaryKey(),
  adsetId: text("adset_id").notNull(),
  campaignId: text("campaign_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  creativeId: text("creative_id"),
  previewUrl: text("preview_url"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const insights = pgTable("insights", {
  id: serial("id").primaryKey(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(), // "campaign" | "adset" | "ad"
  dateStart: date("date_start").notNull(),
  dateStop: date("date_stop").notNull(),
  spend: real("spend").default(0),
  impressions: integer("impressions").default(0),
  reach: integer("reach").default(0),
  clicks: integer("clicks").default(0),
  linkClicks: integer("link_clicks").default(0),
  ctr: real("ctr").default(0),
  cpc: real("cpc").default(0),
  cpm: real("cpm").default(0),
  purchases: integer("purchases").default(0),
  purchaseValue: real("purchase_value").default(0),
  roas: real("roas").default(0),
  videoViews3s: integer("video_views_3s").default(0),
  videoAvgWatchTime: real("video_avg_watch_time").default(0),
  videoLength: real("video_length").default(0),
  hookRate: real("hook_rate").default(0),
  holdRate: real("hold_rate").default(0),
  breakdownKey: text("breakdown_key"), // e.g., "age:25-34" or "placement:feed"
  breakdownValue: text("breakdown_value"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
}, (table) => [
  index("insights_entity_date_idx").on(table.entityId, table.entityType, table.dateStart),
]);

export const automationRules = pgTable("automation_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  level: text("level").notNull(), // "campaign" | "adset" | "ad"
  conditions: jsonb("conditions").$type<Array<{ metric: string; operator: string; value: number; timeRange: string }>>().notNull(),
  action: jsonb("action").$type<{ type: string; value?: number }>().notNull(),
  cooldownHours: integer("cooldown_hours").default(24),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ruleExecutions = pgTable("rule_executions", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  actionTaken: text("action_taken").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export const uploadJobs = pgTable("upload_jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"), // "pending" | "uploading" | "completed" | "failed"
  totalSteps: integer("total_steps").default(5),
  currentStep: integer("current_step").default(0),
  stepLabel: text("step_label"),
  campaignId: text("campaign_id"),
  adsetId: text("adset_id"),
  adId: text("ad_id"),
  creativeId: text("creative_id"),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ─── Editor Payouts ─────────────────────────────────────────────────────────

export const editorPayouts = pgTable("editor_payouts", {
  id: serial("id").primaryKey(),
  editorId: text("editor_id").notNull(), // FK to users
  amount: real("amount").notNull(),
  currency: text("currency").default("USD").notNull(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  adIds: jsonb("ad_ids").$type<string[]>().default([]), // which Meta ad IDs earned the bonus
  assignmentIds: jsonb("assignment_ids").$type<string[]>().default([]), // which assignments
  breakdown: jsonb("breakdown").$type<Array<{ adId: string; adName: string; spend: number; roas: number; bonus: number }>>().default([]),
  status: text("status").notNull().default("pending"), // "pending" | "paid"
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  paidById: text("paid_by_id"), // admin who marked as paid
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("editor_payouts_editor_id_idx").on(table.editorId),
  index("editor_payouts_status_idx").on(table.status),
]);

export const metaConnections = pgTable("meta_connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "ApotekHunden"
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  facebookUserId: text("facebook_user_id"),
  adAccounts: jsonb("ad_accounts").$type<Array<{ id: string; name: string; currency: string; status: number }>>().default([]),
  activeAdAccountId: text("active_ad_account_id"),
  pages: jsonb("pages").$type<Array<{ id: string; name: string }>>().default([]),
  activePageId: text("active_page_id"),
  pixelId: text("pixel_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
