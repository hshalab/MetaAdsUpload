import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS } from "@/lib/meta/insights";
import { getAds } from "@/lib/meta/ads";
import { getCampaigns } from "@/lib/meta/campaigns";
import { getAdSets } from "@/lib/meta/adsets";
import { getEvolveSettings } from "@/lib/evolve/settings";
import { classifyAd } from "@/lib/evolve/classifier";
import { format, subDays, differenceInDays, parseISO } from "date-fns";
import { getAdNcRoas, getTotalNcRoas } from "@/lib/shopify/ncroas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const campaignFilter = searchParams.get("campaign_id") || undefined;

    // Date range
    let since: string;
    let until: string;
    if (searchParams.has("since") && searchParams.has("until")) {
      since = searchParams.get("since")!;
      until = searchParams.get("until")!;
    } else {
      const days = parseInt(searchParams.get("days") || "7");
      since = format(days === 0 ? new Date() : subDays(new Date(), days), "yyyy-MM-dd");
      until = format(new Date(), "yyyy-MM-dd");
    }

    const settings = await getEvolveSettings();

    // Fetch only ACTIVE entities in parallel
    const [ads, campaigns, adsets, insightsData] = await Promise.all([
      getAds(undefined, 500, "ACTIVE"),
      getCampaigns(200, "ACTIVE"),
      getAdSets(undefined, 500, "ACTIVE"),
      getInsights({
        level: "ad",
        dateRange: { since, until },
        limit: 500,
      }),
    ]);

    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));
    const adsetMap = new Map(adsets.map((a) => [a.id, a]));

    // Build insights lookup by ad_id
    const insightsMap = new Map<string, {
      spend: number;
      impressions: number;
      reach: number;
      clicks: number;
      purchases: number;
      purchaseValue: number;
      roas: number;
      ctr: number;
      cpc: number;
      cpm: number;
      frequency: number;
      dateStart: string;
    }>();

    for (const insight of insightsData) {
      if (!insight.ad_id) continue;
      const spend = parseFloat(insight.spend || "0");
      const impressions = parseInt(insight.impressions || "0");
      const reach = parseInt(insight.reach || "0");
      const clicks = parseInt(insight.clicks || "0");
      const purchases = extractPurchases(insight.actions);
      const purchaseValue = extractPurchaseValue(insight.action_values);
      const roas = calculateROAS(purchaseValue, spend);
      const ctr = parseFloat(insight.ctr || "0");
      const cpc = parseFloat(insight.cpc || "0");
      const cpm = parseFloat(insight.cpm || "0");
      const frequency = reach > 0 ? impressions / reach : 0;

      insightsMap.set(insight.ad_id, {
        spend, impressions, reach, clicks,
        purchases, purchaseValue, roas,
        ctr, cpc, cpm, frequency,
        dateStart: insight.date_start,
      });
    }

    // Only include ads from active campaigns
    const activeCampaignIds = new Set(
      campaigns.filter((c) => c.status === "ACTIVE").map((c) => c.id)
    );

    // Find top spender per campaign (Evolve rule: never turn off top spender at KPI)
    const filteredAds = ads
      .filter((ad) => activeCampaignIds.has(ad.campaign_id))
      .filter((ad) => !campaignFilter || ad.campaign_id === campaignFilter);

    const topSpenderPerCampaign = new Map<string, string>();
    const totalSpendPerCampaign = new Map<string, number>();
    for (const ad of filteredAds) {
      const spend = insightsMap.get(ad.id)?.spend || 0;
      totalSpendPerCampaign.set(ad.campaign_id, (totalSpendPerCampaign.get(ad.campaign_id) || 0) + spend);
      const currentTopId = topSpenderPerCampaign.get(ad.campaign_id);
      const currentTopSpend = currentTopId ? (insightsMap.get(currentTopId)?.spend || 0) : 0;
      if (spend > currentTopSpend) {
        topSpenderPerCampaign.set(ad.campaign_id, ad.id);
      }
    }

    // Fetch per-ad + total ncROAS from Shopify orders
    const [ncRoasMap, totalNcData] = await Promise.all([
      getAdNcRoas(since, until),
      getTotalNcRoas(since, until),
    ]);

    // Classify each ad
    const classifiedAds = filteredAds
      .map((ad) => {
        const metrics = insightsMap.get(ad.id) || {
          spend: 0, impressions: 0, reach: 0, clicks: 0,
          purchases: 0, purchaseValue: 0, roas: 0,
          ctr: 0, cpc: 0, cpm: 0, frequency: 0,
          dateStart: since,
        };
        const campaign = campaignMap.get(ad.campaign_id);
        const adset = adsetMap.get(ad.adset_id);
        const cpa = metrics.purchases > 0 ? metrics.spend / metrics.purchases : 0;

        // Estimate ad age from date range
        const ageDays = differenceInDays(parseISO(until), parseISO(since)) + 1;

        // Hook rate: 3s views / impressions
        const hookRate = metrics.impressions > 0
          ? 0  // We don't have 3s data per ad in this response; will be 0
          : 0;

        const isTopSpender = topSpenderPerCampaign.get(ad.campaign_id) === ad.id;
        const campTotalSpend = totalSpendPerCampaign.get(ad.campaign_id) || 0;
        const spendShare = campTotalSpend > 0 ? metrics.spend / campTotalSpend : 0;

        const { classification, recommendation } = classifyAd(
          { spend: metrics.spend, roas: metrics.roas, cpa, purchases: metrics.purchases, ageDays, isTopSpender, spendShare },
          settings
        );

        // 3x CPA spend progress — Evolve rule: spend 3x your target CPA before judging an ad
        const spendThreshold = settings.targetCpa * 3;
        const spendProgress = spendThreshold > 0 ? Math.min(metrics.spend / spendThreshold, 1) : 0;

        // ncROAS: per-ad new customer revenue / ad spend (falls back to null if no UTM data)
        const ncData = ncRoasMap.get(ad.id);
        const ncRevenue = ncData?.newCustomerRevenue || 0;
        const ncRoas = metrics.spend > 0 && ncRevenue > 0 ? ncRevenue / metrics.spend : null;

        return {
          id: ad.id,
          name: ad.name,
          status: ad.status,
          campaignId: ad.campaign_id,
          campaignName: campaign?.name || "Unknown",
          adsetId: ad.adset_id,
          adsetName: adset?.name || "Unknown",
          ...metrics,
          cpa,
          hookRate,
          ageDays,
          classification,
          recommendation,
          spendProgress,
          spendThreshold,
          ncRoas,
          ncRevenue,
        };
      })
      .sort((a, b) => {
        const order: Record<string, number> = { breakthrough: 0, spend_winner: 1, kpi_winner: 2, loser: 3, new: 4 };
        return (order[a.classification] ?? 5) - (order[b.classification] ?? 5) || b.spend - a.spend;
      });

    // Summary stats
    const totalSpend = classifiedAds.reduce((s, a) => s + a.spend, 0);
    const totalRevenue = classifiedAds.reduce((s, a) => s + a.purchaseValue, 0);
    const totalPurchases = classifiedAds.reduce((s, a) => s + a.purchases, 0);
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    const classificationCounts = {
      breakthrough: classifiedAds.filter((a) => a.classification === "breakthrough").length,
      spend_winner: classifiedAds.filter((a) => a.classification === "spend_winner").length,
      kpi_winner: classifiedAds.filter((a) => a.classification === "kpi_winner").length,
      loser: classifiedAds.filter((a) => a.classification === "loser").length,
      new: classifiedAds.filter((a) => a.classification === "new").length,
    };

    // Per-campaign summary (CBO-level view)
    const campaignSummaries = campaigns
      .filter((c) => c.status === "ACTIVE")
      .map((c) => {
        const campAds = classifiedAds.filter((a) => a.campaignId === c.id);
        const campSpend = campAds.reduce((s, a) => s + a.spend, 0);
        const campRevenue = campAds.reduce((s, a) => s + a.purchaseValue, 0);
        const campPurchases = campAds.reduce((s, a) => s + a.purchases, 0);
        const campRoas = campSpend > 0 ? campRevenue / campSpend : 0;
        const campCpa = campPurchases > 0 ? campSpend / campPurchases : 0;
        const adsetCount = new Set(campAds.map((a) => a.adsetId)).size;
        const dailyBudget = c.daily_budget ? parseFloat(String(c.daily_budget)) : 0;

        return {
          id: c.id,
          name: c.name,
          spend: campSpend,
          revenue: campRevenue,
          purchases: campPurchases,
          roas: campRoas,
          cpa: campCpa,
          adCount: campAds.length,
          adsetCount,
          dailyBudget,
          maxAdSets: settings.maxAdSetsPerCampaign,
        };
      });

    // Total ncROAS for the period
    const totalNcRoas = totalSpend > 0 && totalNcData.newCustomerRevenue > 0
      ? totalNcData.newCustomerRevenue / totalSpend : null;

    return NextResponse.json({
      settings: {
        targetRoas: settings.targetRoas,
        breakevenRoas: settings.breakevenRoas,
        targetCpa: settings.targetCpa,
      },
      summary: {
        totalSpend,
        totalRevenue,
        totalPurchases,
        overallRoas,
        totalAds: classifiedAds.length,
        classificationCounts,
        ncRoas: totalNcRoas,
        newCustomerRevenue: totalNcData.newCustomerRevenue,
        newCustomerOrders: totalNcData.newCustomerOrders,
      },
      ads: classifiedAds,
      campaignSummaries,
      dateRange: { since, until },
      campaigns: campaigns.filter((c) => c.status === "ACTIVE").map((c) => ({ id: c.id, name: c.name })),
    });
  } catch (error) {
    console.error("Classify API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to classify ads" },
      { status: 500 }
    );
  }
}
