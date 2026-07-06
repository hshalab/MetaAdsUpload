import { metaApi, metaApiPaginated, getAdAccountId } from "./client";

export interface AdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Record<string, unknown>;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  start_time?: string;
  end_time?: string;
}

const ADSET_FIELDS = "id,campaign_id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,bid_strategy,start_time,end_time";

// ─── Attribution ─────────────────────────────────────────────────────────────
// Standard attribution window for this account's strategy:
// 7-day click-through, 1-day engaged-view (video), 1-day view-through.
export type AttributionEntry = { event_type: string; window_days: number };
export const DEFAULT_ATTRIBUTION_SPEC: AttributionEntry[] = [
  { event_type: "CLICK_THROUGH", window_days: 7 },
  { event_type: "ENGAGED_VIEW", window_days: 1 },
  { event_type: "VIEW_THROUGH", window_days: 1 },
];

// Meta only accepts view/engaged-view attribution on conversion-optimised ad sets.
// Applying it to LINK_CLICKS / LANDING_PAGE_VIEWS / IMPRESSIONS goals is rejected,
// so we default the window only for conversion goals and leave others untouched.
const ATTRIBUTION_CONVERSION_GOALS = new Set([
  "OFFSITE_CONVERSIONS",
  "CONVERSIONS",
  "VALUE",
  "OFFSITE_CONVERSION_VALUE",
]);

export async function getAdSets(campaignId?: string, limit = 200, statusFilter?: "ACTIVE" | "PAUSED" | "ARCHIVED") {
  const endpoint = campaignId
    ? `/${campaignId}/adsets`
    : `/${await getAdAccountId()}/adsets`;
  const params: Record<string, string | number> = { fields: ADSET_FIELDS, limit };
  if (statusFilter) {
    params.filtering = JSON.stringify([{ field: "effective_status", operator: "IN", value: [statusFilter] }]);
  }
  return metaApiPaginated<AdSet>(endpoint, { params });
}

export async function createAdSet(params: {
  campaign_id: string;
  name: string;
  daily_budget?: number;
  targeting: Record<string, unknown>;
  optimization_goal: string;
  billing_event: string;
  bid_strategy?: string;
  bid_amount?: number;
  start_time?: string;
  end_time?: string;
  status?: string;
  promoted_object?: Record<string, unknown>;
  is_dynamic_creative?: boolean;
  url_tags?: string;
  attribution_spec?: AttributionEntry[];
}) {
  // Default to the standard 7d-click / 1d-engaged-view / 1d-view window for
  // conversion ad sets unless the caller passes an explicit spec.
  const attribution_spec =
    params.attribution_spec ??
    (ATTRIBUTION_CONVERSION_GOALS.has(params.optimization_goal) ? DEFAULT_ATTRIBUTION_SPEC : undefined);

  return metaApi<{ id: string }>(`/${await getAdAccountId()}/adsets`, {
    method: "POST",
    body: { ...params, attribution_spec, status: params.status || "PAUSED" },
  });
}

export async function updateAdSet(adsetId: string, params: Record<string, unknown>) {
  return metaApi(`/${adsetId}`, { method: "POST", body: params });
}
