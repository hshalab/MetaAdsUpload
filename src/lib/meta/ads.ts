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

/**
 * Create an ad with multiple text options using creative_asset_groups_spec.
 * This is the "Flexible Ads" approach — works on standard ad sets,
 * supports multiple headlines/primary texts per ad, no dynamic creative needed.
 */
export async function createAdWithTextOptions(params: {
  adset_id: string;
  name: string;
  page_id: string;
  status?: string;
  headlines: string[];
  primaryTexts: string[];
  imageHash?: string;
  videoId?: string;
  linkUrl: string;
  ctaType?: string;
}) {
  const texts = [
    ...params.primaryTexts.map((text) => ({ text, text_type: "primary_text" })),
    ...params.headlines.map((text) => ({ text, text_type: "headline" })),
  ];

  const group: Record<string, unknown> = {
    texts,
    call_to_action: {
      type: params.ctaType || "SHOP_NOW",
      value: { link: params.linkUrl },
    },
  };

  if (params.imageHash) {
    group.images = [{ hash: params.imageHash }];
  } else if (params.videoId) {
    group.videos = [{ video_id: params.videoId }];
  }

  return metaApi<{ id: string }>(`/${await getAdAccountId()}/ads`, {
    method: "POST",
    body: {
      adset_id: params.adset_id,
      name: params.name,
      status: params.status || "PAUSED",
      creative: {
        name: params.name,
        object_story_spec: { page_id: params.page_id },
      },
      creative_asset_groups_spec: {
        groups: [group],
      },
    },
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
