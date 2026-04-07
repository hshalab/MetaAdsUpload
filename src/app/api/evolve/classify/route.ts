import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS } from "@/lib/meta/insights";
import { getAds } from "@/lib/meta/ads";
import { getCampaigns } from "@/lib/meta/campaigns";
import { getAdSets } from "@/lib/meta/adsets";
import { getEvolveSettings } from "@/lib/evolve/settings";
import { classifyAd } from "@/lib/evolve/classifier";
import { format, subDays, differenceInDays, parseISO } from "date-fns";

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

    // Fetch all data in parallel
    const [ads, campaigns, adsets, insightsData] = await Promise.all([
      getAds(undefined, 500),
      getCampaigns(200),
      getAdSets(undefined, 500),
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

    // Classify each ad
    const classifiedAds = ads
      .filter((ad) => activeCampaignIds.has(ad.campaign_id))
      .filter((ad) => !campaignFilter || ad.campaign_id === campaignFilter)
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

        const { classification, recommendation } = classifyAd(
          { spend: metrics.spend, roas: metrics.roas, cpa, purchases: metrics.purchases, ageDays },
          settings
        );

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
      },
      ads: classifiedAds,
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
