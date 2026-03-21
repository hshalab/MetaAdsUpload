import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS, type InsightData } from "@/lib/meta/insights";
import { getCampaigns } from "@/lib/meta/campaigns";
import { getAds } from "@/lib/meta/ads";

async function upsertInsight(row: {
  entityId: string;
  entityType: string;
  dateStart: string;
  dateStop: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  videoViews3s: number;
}) {
  // Delete existing row for same entity+date, then insert fresh
  await db.delete(schema.insights).where(
    and(
      eq(schema.insights.entityId, row.entityId),
      eq(schema.insights.entityType, row.entityType),
      eq(schema.insights.dateStart, row.dateStart),
    )
  );

  await db.insert(schema.insights).values({
    entityId: row.entityId,
    entityType: row.entityType,
    dateStart: row.dateStart,
    dateStop: row.dateStop,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    linkClicks: row.linkClicks,
    ctr: row.ctr,
    cpc: row.cpc,
    cpm: row.cpm,
    purchases: row.purchases,
    purchaseValue: row.purchaseValue,
    roas: row.roas,
    videoViews3s: row.videoViews3s,
  });
}

function extractLinkClicks(actions?: Array<{ action_type: string; value: string }>): number {
  return parseInt(actions?.find((a) => a.action_type === "link_click")?.value || "0", 10);
}

function extractVideoViews3s(actions?: Array<{ action_type: string; value: string }>): number {
  return parseInt(actions?.find((a) => a.action_type === "video_view")?.value || "0", 10);
}

export async function POST(request: NextRequest) {
  // C5: Guard against unset CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    let syncedCount = 0;

    // 1. Sync campaign metadata
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

    // 2. Sync ad metadata (needed for editor name parsing)
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

    // 3. Sync campaign-level insights
    const campaignInsights = await getInsights({
      level: "campaign",
      dateRange: { since: thirtyDaysAgo, until: today },
    });

    for (const row of campaignInsights) {
      const spend = parseFloat(row.spend || "0");
      const purchases = extractPurchases(row.actions);
      const purchaseValue = extractPurchaseValue(row.action_values);

      const entityId = row.campaign_id || "";

      if (!entityId) continue;

      await upsertInsight({
        entityId,
        entityType: "campaign",
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
        purchases,
        purchaseValue,
        roas: calculateROAS(purchaseValue, spend),
        videoViews3s: extractVideoViews3s(row.actions),
      });
      syncedCount++;
    }

    // 4. Sync ad-level insights (critical for editor dashboard)
    const adInsights = await getInsights({
      level: "ad",
      dateRange: { since: thirtyDaysAgo, until: today },
    });

    for (const row of adInsights) {
      const spend = parseFloat(row.spend || "0");
      const purchases = extractPurchases(row.actions);
      const purchaseValue = extractPurchaseValue(row.action_values);
      const entityId = row.ad_id || "";

      if (!entityId) continue;

      await upsertInsight({
        entityId,
        entityType: "ad",
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
        purchases,
        purchaseValue,
        roas: calculateROAS(purchaseValue, spend),
        videoViews3s: extractVideoViews3s(row.actions),
      });
      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      synced: {
        campaigns: campaigns.length,
        ads: ads.length,
        campaignInsights: campaignInsights.length,
        adInsights: adInsights.length,
        totalRows: syncedCount,
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
