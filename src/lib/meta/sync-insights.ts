// Shared insights sync — used by the cron route (GET/POST) and the admin
// "Sync now" button. Pulls daily campaign + ad insights (with video metrics)
// from Meta into the insights table, and refreshes campaign/ad metadata caches.

import { db, schema } from "@/db";
import { and, eq, gte, lte, inArray, isNotNull } from "drizzle-orm";
import {
  getInsights,
  getAdInsightsById,
  extractPurchases,
  extractPurchaseValue,
  calculateROAS,
  extractThruplays,
  type InsightData,
} from "./insights";
import { getCampaigns } from "./campaigns";
import { getAds } from "./ads";

function extractLinkClicks(actions?: Array<{ action_type: string; value: string }>): number {
  return parseInt(actions?.find((a) => a.action_type === "link_click")?.value || "0", 10);
}

function extractVideoViews3s(actions?: Array<{ action_type: string; value: string }>): number {
  return parseInt(actions?.find((a) => a.action_type === "video_view")?.value || "0", 10);
}

type InsightRow = typeof schema.insights.$inferInsert;

function toRow(row: InsightData, entityId: string, entityType: string): InsightRow {
  const spend = parseFloat(row.spend || "0");
  const purchaseValue = extractPurchaseValue(row.action_values);
  return {
    entityId,
    entityType,
    dateStart: row.date_start,
    dateStop: row.date_stop,
    spend,
    impressions: parseInt(row.impressions || "0"),
    reach: parseInt(row.reach || "0"),
    clicks: parseInt(row.clicks || "0"),
    linkClicks: extractLinkClicks(row.actions),
    ctr: parseFloat(row.ctr || "0"),
    cpc: parseFloat(row.cpc || "0"),
    cpm: parseFloat(row.cpm || "0"),
    purchases: extractPurchases(row.actions),
    purchaseValue,
    roas: calculateROAS(purchaseValue, spend),
    videoViews3s: extractVideoViews3s(row.actions),
    videoThruplays: extractThruplays(row.video_thruplay_watched_actions),
  };
}

/** Replace all rows of an entityType within [since, until] with fresh data (bulk). */
async function replaceInsights(entityType: string, since: string, until: string, rows: InsightRow[]) {
  await db.delete(schema.insights).where(
    and(
      eq(schema.insights.entityType, entityType),
      gte(schema.insights.dateStart, since),
      lte(schema.insights.dateStop, until),
    )
  );
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    if (slice.length) await db.insert(schema.insights).values(slice);
  }
}

/**
 * Targeted sync for the editor dashboard: pulls daily insights ONLY for ads that
 * are assigned to an editor (ad_owners + published assignments). This stays well
 * within Hobby-plan function limits even though the ad account has thousands of
 * ads, because it scales with the number of owned ads, not the whole account.
 */
export async function runEditorInsightsSync() {
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const owners = await db.select({ adId: schema.adOwners.adId }).from(schema.adOwners);
  const assigns = await db
    .select({ adId: schema.assignments.metaAdId })
    .from(schema.assignments)
    .where(isNotNull(schema.assignments.metaAdId));

  const adIds = [...new Set([...owners.map((o) => o.adId), ...assigns.map((a) => a.adId).filter(Boolean) as string[]])];
  if (adIds.length === 0) return { ads: 0, adInsightRows: 0 };

  const rows: InsightRow[] = [];
  const failed: string[] = [];
  for (const adId of adIds) {
    try {
      const data = await getAdInsightsById(adId, { since, until: today }, 1);
      for (const r of data) rows.push(toRow(r, adId, "ad"));
    } catch (e) {
      failed.push(adId);
      console.error(`Insights fetch failed for ad ${adId}:`, e instanceof Error ? e.message : e);
    }
  }

  // Replace only these ads' insights in the window.
  await db.delete(schema.insights).where(
    and(
      eq(schema.insights.entityType, "ad"),
      inArray(schema.insights.entityId, adIds),
      gte(schema.insights.dateStart, since),
      lte(schema.insights.dateStop, today),
    )
  );
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    if (slice.length) await db.insert(schema.insights).values(slice);
  }

  return { ads: adIds.length, adInsightRows: rows.length, failed: failed.length };
}

export async function runSync() {
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  // 1. Campaign metadata
  const campaigns = await getCampaigns();
  for (const c of campaigns) {
    await db.insert(schema.campaignsCache).values({
      id: c.id, name: c.name, status: c.status, objective: c.objective,
      dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
    }).onConflictDoUpdate({
      target: schema.campaignsCache.id,
      set: { name: c.name, status: c.status, syncedAt: new Date() },
    });
  }

  // 2. Ad metadata → ads_cache (for ad names on the editor dashboard)
  const ads = await getAds();
  for (const ad of ads) {
    await db.insert(schema.adsCache).values({
      id: ad.id,
      adsetId: ad.adset_id,
      campaignId: ad.campaign_id,
      name: ad.name,
      status: ad.status,
      creativeId: ad.creative?.id || null,
    }).onConflictDoUpdate({
      target: schema.adsCache.id,
      set: { name: ad.name, status: ad.status, syncedAt: new Date() },
    });
  }

  // 3. Campaign-level daily insights
  const campaignInsights = await getInsights({
    level: "campaign",
    dateRange: { since, until: today },
    timeIncrement: 1,
  });
  const campaignRows = campaignInsights.filter((r) => r.campaign_id).map((r) => toRow(r, r.campaign_id!, "campaign"));
  await replaceInsights("campaign", since, today, campaignRows);

  // 4. Ad-level daily insights (powers the editor dashboard) — with video metrics
  const adInsights = await getInsights({
    level: "ad",
    dateRange: { since, until: today },
    timeIncrement: 1,
    includeVideoMetrics: true,
  });
  const adRows = adInsights.filter((r) => r.ad_id).map((r) => toRow(r, r.ad_id!, "ad"));
  await replaceInsights("ad", since, today, adRows);

  return {
    campaigns: campaigns.length,
    ads: ads.length,
    campaignInsightRows: campaignRows.length,
    adInsightRows: adRows.length,
  };
}
