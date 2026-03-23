import { metaApi, getAdAccountId } from "./client";

export interface Ad {
  id: string;
  adset_id: string;
  campaign_id: string;
  name: string;
  status: string;
  creative?: { id: string };
  preview_shareable_link?: string;
}

const AD_FIELDS = "id,adset_id,campaign_id,name,status,creative{id},preview_shareable_link";

export async function getAds(adsetId?: string, limit = 100) {
  const endpoint = adsetId ? `/${adsetId}/ads` : `/${await getAdAccountId()}/ads`;
  const data = await metaApi<{ data?: Ad[] }>(endpoint, {
    params: { fields: AD_FIELDS, limit },
  });
  return data.data ?? [];
}

export async function createAd(params: {
  adset_id: string;
  name: string;
  creative: { creative_id: string };
  status?: string;
}) {
  return metaApi<{ id: string }>(`/${await getAdAccountId()}/ads`, {
    method: "POST",
    body: { ...params, status: params.status || "PAUSED" },
  });
}

export async function updateAd(adId: string, params: Record<string, unknown>) {
  return metaApi(`/${adId}`, { method: "POST", body: params });
}

export async function getAdPostId(adId: string): Promise<string | null> {
  try {
    const data = await metaApi<{ effective_object_story_id?: string }>(
      `/${adId}`,
      { params: { fields: "effective_object_story_id" } }
    );
    return data.effective_object_story_id || null;
  } catch {
    return null;
  }
}
