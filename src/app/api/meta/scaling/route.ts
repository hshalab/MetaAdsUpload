import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdAccountId, metaApi } from "@/lib/meta/client";
import { getAdSets, updateAdSet } from "@/lib/meta/adsets";
import { getCampaigns } from "@/lib/meta/campaigns";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS } from "@/lib/meta/insights";
import { getEvolveSettings } from "@/lib/evolve/settings";
import { evaluateScalingProtocol } from "@/lib/evolve/scaling-protocol";
import { format, subDays } from "date-fns";
import { getAdsetNcRoas } from "@/lib/shopify/ncroas";

export const dynamic = "force-dynamic";

type Zone = "scale" | "hold" | "watch" | "kill" | "new";

function classifyZone(roas: number, spend: number, thresholds: { target: number; hold: number; breakeven: number }, minSpend: number): Zone {
  if (spend < minSpend) return "new";
  if (roas >= thresholds.target) return "scale";
  if (roas >= thresholds.hold) return "hold";
  if (roas >= thresholds.breakeven) return "watch";
  return "kill";
}

function getSuggestion(zone: Zone, roas: number, spend: number, thresholds: { breakeven: number }): string {
  switch (zone) {
    case "scale":
      return `ROAS ${roas.toFixed(2)}x — above target. Scale budget +20-30%`;
    case "hold":
      return `ROAS ${roas.toFixed(2)}x — profitable, let it run. Monitor daily.`;
    case "watch":
      return `ROAS ${roas.toFixed(2)}x — above breakeven but below hold zone. Consider reducing budget or waiting for more data.`;
    case "kill":
      return `ROAS ${roas.toFixed(2)}x — below breakeven (${thresholds.breakeven}). Pause or cut budget significantly.`;
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
    const statusFilter = searchParams.get("status") || "ACTIVE";

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

    // Load dynamic settings
    const settings = await getEvolveSettings();
    const thresholds = {
      breakeven: settings.breakevenRoas,
      hold: settings.holdRoas,
      target: settings.targetRoas,
    };

    const [campaigns, allAdsets, insightsData] = await Promise.all([
      getCampaigns(200),
      getAdSets(undefined, 500),
      getInsights({
        level: "adset",
        dateRange: { since, until },
        limit: 500,
      }),
    ]);

    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

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

    // Fetch per-adset ncROAS from Shopify orders
    const ncRoasMap = await getAdsetNcRoas(since, until);

    const enrichedAdsets = allAdsets
      .filter((adset) => statusFilter === "ALL" || adset.status === statusFilter)
      .map((adset) => {
        const metrics = insightsMap.get(adset.id) || {
          spend: 0, impressions: 0, reach: 0, clicks: 0,
          purchases: 0, purchaseValue: 0, roas: 0,
          ctr: 0, cpc: 0, cpm: 0,
        };
        const campaign = campaignMap.get(adset.campaign_id);
        const zone = classifyZone(metrics.roas, metrics.spend, thresholds, settings.minDailySpend);
        const suggestion = getSuggestion(zone, metrics.roas, metrics.spend, thresholds);
        const cpa = metrics.purchases > 0 ? metrics.spend / metrics.purchases : 0;
        const dailyBudget = adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : 0;

        // Evaluate scaling protocol
        const protocol = evaluateScalingProtocol(
          {
            roas: metrics.roas,
            spend: metrics.spend,
            dailyBudget,
            consecutiveDaysAboveTarget: 0, // Would need historical tracking
            consecutiveDaysBelowBreakeven: 0,
            consecutiveDaysBelowTarget: 0,
          },
          settings
        );

        // ncROAS: per-adset new customer revenue / adset spend
        const ncData = ncRoasMap.get(adset.id);
        const ncRevenue = ncData?.newCustomerRevenue || 0;
        const ncRoas = metrics.spend > 0 && ncRevenue > 0 ? ncRevenue / metrics.spend : null;

        return {
          id: adset.id,
          name: adset.name,
          status: adset.status,
          dailyBudget: dailyBudget || null,
          campaignId: adset.campaign_id,
          campaignName: campaign?.name || "Unknown",
          campaignStatus: campaign?.status || "UNKNOWN",
          ...metrics,
          cpa,
          zone,
          suggestion,
          ncRoas,
          ncRevenue,
          protocol: {
            action: protocol.action,
            reason: protocol.reason,
            status: protocol.newStatus,
          },
        };
      })
      .sort((a, b) => {
        const zoneOrder: Record<Zone, number> = { scale: 0, hold: 1, watch: 2, kill: 3, new: 4 };
        return (zoneOrder[a.zone] || 5) - (zoneOrder[b.zone] || 5) || b.spend - a.spend;
      });

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
      thresholds,
      settings: {
        targetRoas: settings.targetRoas,
        holdRoas: settings.holdRoas,
        breakevenRoas: settings.breakevenRoas,
        targetCpa: settings.targetCpa,
        surfModeEnabled: settings.surfModeCampaignIds.length > 0,
        surfModeCampaignIds: settings.surfModeCampaignIds,
      },
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
        value?: number;
      }>;
    };

    // Process actions concurrently (throttle in metaApi handles rate limiting)
    const results = await Promise.all(
      actions.map(async (action): Promise<{ adsetId: string; action: string; success: boolean; error?: string }> => {
        try {
          switch (action.type) {
            case "pause":
              await updateAdSet(action.adsetId, { status: "PAUSED" });
              return { adsetId: action.adsetId, action: "paused", success: true };
            case "activate":
              await updateAdSet(action.adsetId, { status: "ACTIVE" });
              return { adsetId: action.adsetId, action: "activated", success: true };
            case "adjust_budget": {
              const adsetData = await metaApi<{ daily_budget: string }>(`/${action.adsetId}`, {
                params: { fields: "daily_budget" },
              });
              const currentBudget = parseInt(adsetData.daily_budget || "0");
              const newBudget = Math.round(currentBudget * (1 + (action.value || 0) / 100));
              await updateAdSet(action.adsetId, { daily_budget: newBudget });
              return {
                adsetId: action.adsetId,
                action: `budget ${action.value! > 0 ? "+" : ""}${action.value}% → ${(newBudget / 100).toFixed(0)} SEK`,
                success: true,
              };
            }
            case "set_budget":
              await updateAdSet(action.adsetId, { daily_budget: action.value });
              return {
                adsetId: action.adsetId,
                action: `budget set to ${((action.value || 0) / 100).toFixed(0)} SEK`,
                success: true,
              };
            default:
              return { adsetId: action.adsetId, action: action.type, success: false, error: "Unknown action" };
          }
        } catch (err) {
          return {
            adsetId: action.adsetId,
            action: action.type,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Scaling PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute actions" },
      { status: 500 }
    );
  }
}
