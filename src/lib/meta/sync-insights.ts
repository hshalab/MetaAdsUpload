// Shared insights sync — used by the cron route (GET/POST) and the admin
// "Sync now" button. Pulls daily campaign + ad insights (with video metrics)
// from Meta into the insights table, and refreshes campaign/ad metadata caches.

import { db, schema } from "@/db";
import { and, eq, gte, lte, inArray, isNotNull } from "drizzle-orm";
import {
  getInsights,
  getAdsetInsightsByAd,
  extractPurchases,
  extractPurchaseValue,
  calculateROAS,
  extractThruplays,
  type InsightData,
} from "./insights";
import { getCampaigns } from "./campaigns";
import { getAds } from "./ads";
import { metaApi } from "./client";

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

// The bonus is computed on LIFETIME spend/ROAS, so the very first sync of an ad
// set must pull its entire history — not just the rolling window. Meta caps
// daily-granularity insight queries, so long ranges are fetched in chunks.
const BACKFILL_CHUNK_DAYS = 90;
const MAX_BACKFILLS_PER_RUN = 8; // keep a single run within Hobby function limits
const MAX_HISTORY_DAYS = 1100; // Meta retains ~37 months of insights

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

/**
 * Targeted sync for the editor dashboard: pulls daily insights ONLY for the ad
 * sets that are assigned to an editor (adset_owners + published assignments).
 * For each owned ad set it refreshes ad metadata (names + ad→adset mapping) and
 * pulls per-ad daily insights. The first time an ad set is seen it backfills
 * the full lifetime (from the ad set's created_time) and records backfilledAt;
 * after that, only the rolling 30-day window is refreshed. Writes happen per ad
 * set so a timeout mid-run never loses completed work. Scales with owned ad
 * sets, not the whole (thousands-of-ads) account.
 */
export async function runEditorInsightsSync() {
  const today = new Date().toISOString().split("T")[0];
  const windowSince = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const oldestAllowed = new Date(Date.now() - MAX_HISTORY_DAYS * 86400000).toISOString().split("T")[0];

  // source='demo' rows are fabricated showcase data — they don't exist in Meta,
  // so they must never reach the API.
  const owners = (await db.select().from(schema.adsetOwners)).filter((o) => o.source !== "demo");
  const ownerByAdset = new Map(owners.map((o) => [o.adsetId, o]));
  const assigns = await db
    .select({ adsetId: schema.assignments.metaAdsetId })
    .from(schema.assignments)
    .where(isNotNull(schema.assignments.metaAdsetId));

  const adsetIds = [...new Set([...owners.map((o) => o.adsetId), ...(assigns.map((a) => a.adsetId).filter(Boolean) as string[])])];
  if (adsetIds.length === 0) return { adsets: 0, ads: 0, adInsightRows: 0, backfilled: 0, backfillsPending: 0 };

  // Backfill the never-backfilled ad sets first so repeated manual runs make progress.
  adsetIds.sort((a, b) => {
    const aPending = ownerByAdset.has(a) && !ownerByAdset.get(a)!.backfilledAt ? 0 : 1;
    const bPending = ownerByAdset.has(b) && !ownerByAdset.get(b)!.backfilledAt ? 0 : 1;
    return aPending - bPending;
  });

  const allAdIds = new Set<string>();
  const failed: string[] = [];
  let totalRows = 0;
  let backfillsDone = 0;

  for (const adsetId of adsetIds) {
    const ownerRow = ownerByAdset.get(adsetId);
    const wantsBackfill = !!ownerRow && !ownerRow.backfilledAt;
    const doBackfill = wantsBackfill && backfillsDone < MAX_BACKFILLS_PER_RUN;

    try {
      let since = windowSince;

      // Keep the ad set's display name fresh; created_time bounds the backfill.
      try {
        const info = await metaApi<{ name?: string; created_time?: string }>(`/${adsetId}`, { params: { fields: "name,created_time" } });
        if (info?.name && ownerRow) {
          await db.update(schema.adsetOwners).set({ adsetName: info.name, updatedAt: new Date() }).where(eq(schema.adsetOwners.adsetId, adsetId));
        }
        if (doBackfill) {
          const created = info?.created_time?.slice(0, 10);
          since = created && created > oldestAllowed ? created : oldestAllowed;
        }
      } catch {
        // Name/created_time are best-effort; a backfill without created_time
        // falls back to the full retention window.
        if (doBackfill) since = oldestAllowed;
      }

      // Refresh ad metadata (names + ad→adset mapping) for this ad set.
      const ads = await getAds(adsetId, 200);
      const adsetAdIds = new Set<string>();
      for (const ad of ads) {
        adsetAdIds.add(ad.id);
        await db.insert(schema.adsCache).values({
          id: ad.id,
          adsetId: ad.adset_id || adsetId,
          campaignId: ad.campaign_id || "",
          name: ad.name,
          status: ad.status,
          creativeId: ad.creative?.id || null,
        }).onConflictDoUpdate({
          target: schema.adsCache.id,
          set: { name: ad.name, status: ad.status, adsetId: ad.adset_id || adsetId, syncedAt: new Date() },
        });
      }

      // Per-ad daily insights, chunked so lifetime backfills stay within Meta's
      // limits on daily-granularity queries.
      const rows: InsightRow[] = [];
      let cursor = since;
      while (cursor <= today) {
        const chunkEnd = addDays(cursor, BACKFILL_CHUNK_DAYS - 1) < today ? addDays(cursor, BACKFILL_CHUNK_DAYS - 1) : today;
        const data = await getAdsetInsightsByAd(adsetId, { since: cursor, until: chunkEnd }, 1);
        for (const r of data) {
          if (r.ad_id) { rows.push(toRow(r, r.ad_id, "ad")); adsetAdIds.add(r.ad_id); }
        }
        cursor = addDays(chunkEnd, 1);
      }

      // Replace this ad set's rows within the fetched range, then persist
      // immediately — a later failure must not lose this ad set's data.
      const adIdArr = [...adsetAdIds];
      if (adIdArr.length) {
        await db.delete(schema.insights).where(
          and(
            eq(schema.insights.entityType, "ad"),
            inArray(schema.insights.entityId, adIdArr),
            gte(schema.insights.dateStart, since),
            lte(schema.insights.dateStop, today),
          )
        );
      }
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        if (slice.length) await db.insert(schema.insights).values(slice);
      }

      if (doBackfill) {
        await db.update(schema.adsetOwners).set({ backfilledAt: new Date(), updatedAt: new Date() }).where(eq(schema.adsetOwners.adsetId, adsetId));
        backfillsDone++;
      }

      totalRows += rows.length;
      adIdArr.forEach((id) => allAdIds.add(id));
    } catch (e) {
      failed.push(adsetId);
      console.error(`Insights fetch failed for ad set ${adsetId}:`, e instanceof Error ? e.message : e);
    }
  }

  const backfillsPending = owners.filter((o) => !o.backfilledAt).length - backfillsDone;
  return {
    adsets: adsetIds.length,
    ads: allAdIds.size,
    adInsightRows: totalRows,
    backfilled: backfillsDone,
    backfillsPending: Math.max(backfillsPending, 0),
    failed: failed.length,
  };
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
