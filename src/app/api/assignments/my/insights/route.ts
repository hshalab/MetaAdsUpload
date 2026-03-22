import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { metaApi, getAdAccountId } from "@/lib/meta/client";

interface MetaInsight {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  reach?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  video_thruplay_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p25_watched_actions?: Array<{ action_type: string; value: string }>;
}

interface MetaInsightsResponse {
  data: MetaInsight[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    // Get editor's posted assignments that have metaAdId
    const postedAssignments = await db
      .select()
      .from(schema.assignments)
      .where(
        and(
          eq(schema.assignments.assignedToId, userId),
          eq(schema.assignments.status, "posted")
        )
      );

    const assignmentsWithAds = postedAssignments.filter(a => a.metaAdId);

    if (assignmentsWithAds.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    // Fetch insights for each ad from Meta API
    const adAccountId = await getAdAccountId();
    const insightFields = [
      "spend", "impressions", "reach", "clicks",
      "actions", "action_values", "cost_per_action_type",
      "video_thruplay_watched_actions", "video_p25_watched_actions",
    ].join(",");

    const results = await Promise.allSettled(
      assignmentsWithAds.map(async (assignment) => {
        const timeRange = from && to
          ? `&time_range=${encodeURIComponent(JSON.stringify({ since: from, until: to }))}`
          : "";

        const data = await metaApi<MetaInsightsResponse>(
          `/${assignment.metaAdId}/insights?fields=${insightFields}&date_preset=${!from ? "last_7d" : ""}${timeRange}`
        );

        const insight = data.data?.[0];
        if (!insight) {
          return {
            assignmentId: assignment.id,
            adId: assignment.metaAdId,
            adsetId: assignment.metaAdsetId,
            campaignId: assignment.metaCampaignId,
            autoName: assignment.autoName || assignment.title,
            spend: 0,
            impressions: 0,
            reach: 0,
            clicks: 0,
            purchases: 0,
            purchaseValue: 0,
            roas: 0,
            cpa: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0,
          };
        }

        const spend = parseFloat(insight.spend) || 0;
        const impressions = parseInt(insight.impressions) || 0;
        const reach = parseInt(insight.reach || "0") || 0;
        const clicks = parseInt(insight.clicks || "0") || 0;

        const purchases = insight.actions?.find(
          a => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
        );
        const purchaseValue = insight.action_values?.find(
          a => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
        );

        const purchaseCount = parseInt(purchases?.value || "0") || 0;
        const purchaseVal = parseFloat(purchaseValue?.value || "0") || 0;
        const roas = spend > 0 ? purchaseVal / spend : 0;
        const cpa = purchaseCount > 0 ? spend / purchaseCount : 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

        return {
          assignmentId: assignment.id,
          adId: assignment.metaAdId,
          adsetId: assignment.metaAdsetId,
          campaignId: assignment.metaCampaignId,
          autoName: assignment.autoName || assignment.title,
          spend,
          impressions,
          reach,
          clicks,
          purchases: purchaseCount,
          purchaseValue: purchaseVal,
          roas,
          cpa,
          ctr,
          cpc,
          cpm,
        };
      })
    );

    const insights = results
      .filter((r) => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<typeof results extends PromiseSettledResult<infer U>[] ? U : never>).value);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Editor insights error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
