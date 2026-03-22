import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS } from "@/lib/meta/insights";
import { getCampaigns } from "@/lib/meta/campaigns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from") || new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

    // Fetch campaigns and insights LIVE from Meta API in parallel
    const [campaignsRaw, insightsData] = await Promise.all([
      getCampaigns(200),
      getInsights({
        level: "campaign",
        dateRange: { since: from, until: to },
        limit: 500,
      }),
    ]);

    // Build insights lookup by campaign_id
    const insightsMap = new Map<string, {
      spend: number;
      impressions: number;
      reach: number;
      clicks: number;
      linkClicks: number;
      purchases: number;
      purchaseValue: number;
      roas: number;
      ctr: number;
      cpc: number;
      cpm: number;
      videoViews3s: number;
    }>();

    for (const row of insightsData) {
      if (!row.campaign_id) continue;
      const spend = parseFloat(row.spend || "0");
      const impressions = parseInt(row.impressions || "0");
      const clicks = parseInt(row.clicks || "0");
      const reach = parseInt(row.reach || "0");
      const purchases = extractPurchases(row.actions);
      const purchaseValue = extractPurchaseValue(row.action_values);
      const roas = calculateROAS(purchaseValue, spend);
      const linkClicks = parseInt(
        row.actions?.find((a) => a.action_type === "link_click")?.value || "0",
        10
      );
      const videoViews3s = parseInt(
        row.actions?.find((a) => a.action_type === "video_view")?.value || "0",
        10
      );

      insightsMap.set(row.campaign_id, {
        spend, impressions, reach, clicks, linkClicks,
        purchases, purchaseValue, roas,
        ctr: parseFloat(row.ctr || "0"),
        cpc: parseFloat(row.cpc || "0"),
        cpm: parseFloat(row.cpm || "0"),
        videoViews3s,
      });
    }

    // Build campaign rows — ACTIVE sorted first, then by spend desc
    const campaigns = campaignsRaw
      .map((c) => {
        const metrics = insightsMap.get(c.id) || {
          spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0,
          purchases: 0, purchaseValue: 0, roas: 0,
          ctr: 0, cpc: 0, cpm: 0, videoViews3s: 0,
        };
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective || "",
          dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : 0,
          lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : 0,
          spend: metrics.spend,
          impressions: metrics.impressions,
          linkClicks: metrics.linkClicks,
          ctr: metrics.ctr,
          cpc: metrics.cpc,
          cpm: metrics.cpm,
          purchases: metrics.purchases,
          purchaseValue: metrics.purchaseValue,
          roas: metrics.roas,
          cpa: metrics.purchases > 0 ? metrics.spend / metrics.purchases : 0,
          hookRate: metrics.impressions > 0 ? (metrics.videoViews3s / metrics.impressions) * 100 : 0,
        };
      })
      .sort((a, b) => {
        if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
        if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
        return b.spend - a.spend;
      });

    // Summary
    const summary = {
      spend: campaigns.reduce((s, c) => s + c.spend, 0),
      impressions: campaigns.reduce((s, c) => s + c.impressions, 0),
      reach: 0,
      linkClicks: campaigns.reduce((s, c) => s + c.linkClicks, 0),
      ctr: 0,
      cpc: 0,
      cpm: 0,
      purchases: campaigns.reduce((s, c) => s + c.purchases, 0),
      purchaseValue: campaigns.reduce((s, c) => s + c.purchaseValue, 0),
      roas: 0,
      cpa: 0,
    };
    summary.ctr = summary.impressions > 0 ? (summary.linkClicks / summary.impressions) * 100 : 0;
    summary.cpc = summary.linkClicks > 0 ? summary.spend / summary.linkClicks : 0;
    summary.cpm = summary.impressions > 0 ? (summary.spend / summary.impressions) * 1000 : 0;
    summary.roas = summary.spend > 0 ? summary.purchaseValue / summary.spend : 0;
    summary.cpa = summary.purchases > 0 ? summary.spend / summary.purchases : 0;

    return NextResponse.json({ summary, campaigns });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
