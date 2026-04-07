import { metaApi, getAdAccountId } from "./client";

export interface InsightData {
  date_start: string;
  date_stop: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  video_30_sec_watched_actions?: Array<{ action_type: string; value: string }>;
  video_avg_time_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p25_watched_actions?: Array<{ action_type: string; value: string }>;
}

const INSIGHT_FIELDS = [
  "campaign_id", "adset_id", "ad_id",
  "spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm",
  "actions", "action_values",
  "video_30_sec_watched_actions", "video_avg_time_watched_actions",
].join(",");

export async function getInsights(params: {
  entityId?: string;
  level?: "campaign" | "adset" | "ad";
  dateRange?: { since: string; until: string };
  breakdowns?: string[];
  actionBreakdowns?: string[];
  limit?: number;
}) {
  const { entityId, level = "campaign", dateRange, breakdowns, actionBreakdowns, limit = 500 } = params;
  const adAccountId = entityId || await getAdAccountId();
  const endpoint = `/${adAccountId}/insights`;

  const queryParams: Record<string, string | number | boolean> = {
    fields: INSIGHT_FIELDS,
    level,
    limit,
  };

  if (dateRange) {
    queryParams.time_range = JSON.stringify({
      since: dateRange.since,
      until: dateRange.until,
    });
  }

  if (breakdowns?.length) {
    queryParams.breakdowns = breakdowns.join(",");
  }

  if (actionBreakdowns?.length) {
    queryParams.action_breakdowns = actionBreakdowns.join(",");
  }

  const data = await metaApi<{ data?: InsightData[] }>(endpoint, {
    params: queryParams,
  });
  return data.data ?? [];
}

export function extractPurchases(actions?: Array<{ action_type: string; value: string }>) {
  return parseInt(actions?.find((a) => a.action_type === "purchase")?.value || "0", 10);
}

export function extractPurchaseValue(actionValues?: Array<{ action_type: string; value: string }>) {
  return parseFloat(actionValues?.find((a) => a.action_type === "purchase")?.value || "0");
}

export function calculateROAS(purchaseValue: number, spend: number) {
  return spend > 0 ? purchaseValue / spend : 0;
}

/**
 * Extract click-to-purchase ratio from action breakdown data.
 * When action_breakdowns=action_type is used, purchases are broken down into
 * 1d_click, 7d_click, 1d_view, etc. This calculates the % from clicks.
 */
export function extractClickPurchaseRatio(
  actions?: Array<{ action_type: string; value: string; "1d_click"?: string; "7d_click"?: string; "1d_view"?: string }>
): number | undefined {
  if (!actions) return undefined;
  const purchase = actions.find((a) => a.action_type === "purchase");
  if (!purchase) return undefined;

  const click1d = parseInt(purchase["1d_click"] || "0", 10);
  const click7d = parseInt(purchase["7d_click"] || "0", 10);
  const view1d = parseInt(purchase["1d_view"] || "0", 10);
  const totalClick = Math.max(click1d, click7d); // use the larger window
  const total = totalClick + view1d;

  if (total === 0) return undefined;
  return totalClick / total;
}
