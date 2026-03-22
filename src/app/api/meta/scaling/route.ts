import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdAccountId, metaApi } from "@/lib/meta/client";
import { getAdSets, updateAdSet } from "@/lib/meta/adsets";
import { getCampaigns } from "@/lib/meta/campaigns";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS } from "@/lib/meta/insights";
import { format, subDays } from "date-fns";

// ROAS thresholds
const BREAKEVEN_ROAS = 1.42;
const HOLD_ROAS = 1.7;
const TARGET_ROAS = 2.0;

type Zone = "scale" | "hold" | "watch" | "kill" | "new";

function classifyZone(roas: number, spend: number): Zone {
  if (spend < 50) return "new"; // Not enough data
  if (roas >= TARGET_ROAS) return "scale";
  if (roas >= HOLD_ROAS) return "hold";
  if (roas >= BREAKEVEN_ROAS) return "watch";
  return "kill";
}

function getSuggestion(zone: Zone, roas: number, spend: number): string {
  switch (zone) {
    case "scale":
      return `ROAS ${roas.toFixed(2)}x — above target. Scale budget +20-30%`;
    case "hold":
      return `ROAS ${roas.toFixed(2)}x — profitable, let it run. Monitor daily.`;
    case "watch":
      return `ROAS ${roas.toFixed(2)}x — above breakeven but below hold zone. Consider reducing budget or waiting for more data.`;
    case "kill":
      return `ROAS ${roas.toFixed(2)}x — below breakeven (1.42). Pause or cut budget significantly.`;
    case "new":
      return `Only ${spend.toFixed(0)} SEK spent — too early to judge. Let it run for more data.`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get("status") || "ACTIVE"; // ACTIVE, PAUSED, or ALL

    // Date range: custom since/until, or days preset (0 = today)
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

    // Fetch campaigns, adsets, and insights in parallel
    const [campaigns, allAdsets, insightsData] = await Promise.all([
      getCampaigns(200),
      getAdSets(undefined, 500),
      getInsights({
        level: "adset",
        dateRange: { since, until },
        limit: 500,
      }),
    ]);

    // Build campaign name lookup
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    // Build insights lookup by adset_id
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
    }>();

    for (const insight of insightsData) {
      if (!insight.adset_id) continue;
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

      insightsMap.set(insight.adset_id, {
        spend, impressions, reach, clicks,
        purchases, purchaseValue, roas,
        ctr, cpc, cpm,
      });
    }

    // Combine adsets with insights
    const enrichedAdsets = allAdsets
      .filter((adset) => statusFilter === "ALL" || adset.status === statusFilter)
      .map((adset) => {
        const metrics = insightsMap.get(adset.id) || {
          spend: 0, impressions: 0, reach: 0, clicks: 0,
          purchases: 0, purchaseValue: 0, roas: 0,
          ctr: 0, cpc: 0, cpm: 0,
        };
        const campaign = campaignMap.get(adset.campaign_id);
        const zone = classifyZone(metrics.roas, metrics.spend);
        const suggestion = getSuggestion(zone, metrics.roas, metrics.spend);
        const cpa = metrics.purchases > 0 ? metrics.spend / metrics.purchases : 0;

        return {
          id: adset.id,
          name: adset.name,
          status: adset.status,
          dailyBudget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : null,
          campaignId: adset.campaign_id,
          campaignName: campaign?.name || "Unknown",
          campaignStatus: campaign?.status || "UNKNOWN",
          ...metrics,
          cpa,
          zone,
          suggestion,
        };
      })
      .sort((a, b) => {
        // Sort: scale first, then hold, watch, kill, new
        const zoneOrder: Record<Zone, number> = { scale: 0, hold: 1, watch: 2, kill: 3, new: 4 };
        return (zoneOrder[a.zone] || 5) - (zoneOrder[b.zone] || 5) || b.spend - a.spend;
      });

    // Summary
    const totalSpend = enrichedAdsets.reduce((s, a) => s + a.spend, 0);
    const totalRevenue = enrichedAdsets.reduce((s, a) => s + a.purchaseValue, 0);
    const totalPurchases = enrichedAdsets.reduce((s, a) => s + a.purchases, 0);
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    const zoneCounts = {
      scale: enrichedAdsets.filter((a) => a.zone === "scale").length,
      hold: enrichedAdsets.filter((a) => a.zone === "hold").length,
      watch: enrichedAdsets.filter((a) => a.zone === "watch").length,
      kill: enrichedAdsets.filter((a) => a.zone === "kill").length,
      new: enrichedAdsets.filter((a) => a.zone === "new").length,
    };

    const totalDailyBudget = enrichedAdsets
      .filter((a) => a.status === "ACTIVE" && a.dailyBudget)
      .reduce((s, a) => s + (a.dailyBudget || 0), 0);

    return NextResponse.json({
      thresholds: { breakeven: BREAKEVEN_ROAS, hold: HOLD_ROAS, target: TARGET_ROAS },
      summary: {
        totalSpend,
        totalRevenue,
        totalPurchases,
        overallRoas,
        totalDailyBudget,
        totalAdsets: enrichedAdsets.length,
        zoneCounts,
      },
      adsets: enrichedAdsets,
      dateRange: { since, until },
    });
  } catch (error) {
    console.error("Scaling API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch scaling data" },
      { status: 500 }
    );
  }
}

// PATCH - bulk or single budget/status updates
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { actions } = body as {
      actions: Array<{
        adsetId: string;
        type: "adjust_budget" | "set_budget" | "pause" | "activate";
        value?: number; // percentage for adjust, cents for set
      }>;
    };

    const results: Array<{ adsetId: string; action: string; success: boolean; error?: string }> = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case "pause":
            await updateAdSet(action.adsetId, { status: "PAUSED" });
            results.push({ adsetId: action.adsetId, action: "paused", success: true });
            break;
          case "activate":
            await updateAdSet(action.adsetId, { status: "ACTIVE" });
            results.push({ adsetId: action.adsetId, action: "activated", success: true });
            break;
          case "adjust_budget": {
            // Get current budget first
            const adsetData = await metaApi<{ daily_budget: string }>(`/${action.adsetId}`, {
              params: { fields: "daily_budget" },
            });
            const currentBudget = parseInt(adsetData.daily_budget || "0");
            const newBudget = Math.round(currentBudget * (1 + (action.value || 0) / 100));
            await updateAdSet(action.adsetId, { daily_budget: newBudget });
            results.push({
              adsetId: action.adsetId,
              action: `budget ${action.value! > 0 ? "+" : ""}${action.value}% → ${(newBudget / 100).toFixed(0)} SEK`,
              success: true,
            });
            break;
          }
          case "set_budget":
            await updateAdSet(action.adsetId, { daily_budget: action.value });
            results.push({
              adsetId: action.adsetId,
              action: `budget set to ${((action.value || 0) / 100).toFixed(0)} SEK`,
              success: true,
            });
            break;
        }
      } catch (err) {
        results.push({
          adsetId: action.adsetId,
          action: action.type,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Scaling PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute actions" },
      { status: 500 }
    );
  }
}
