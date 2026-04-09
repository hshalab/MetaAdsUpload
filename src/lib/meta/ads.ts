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
 * Meta API requires these complex fields as stringified JSON in FormData.
 */
export async function createAdWithTextOptions(params: {
  adset_id: string;
  name: string;
  page_id: string;
  status?: string;
  headlines: string[];
  primaryTexts: string[];
  imageHash?: string;
  variantHashes?: string[];
  videoId?: string;
  linkUrl: string;
  ctaType?: string;
}) {
  if (!params.linkUrl) {
    throw new Error("linkUrl is required for Flexible Ads (creative_asset_groups_spec)");
  }

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
    const images: { hash: string }[] = [{ hash: params.imageHash }];
    if (params.variantHashes) {
      for (const h of params.variantHashes) {
        images.push({ hash: h });
      }
    }
    group.images = images;
  } else if (params.videoId) {
    group.videos = [{ video_id: params.videoId }];
  }

  // Build creative with object_story_spec that matches the asset group.
  // Meta requires the first image/video in creative_asset_groups_spec to match
  // the image/video in the object_story_spec.
  const ctaType = params.ctaType || "SHOP_NOW";
  const storySpec: Record<string, unknown> = { page_id: params.page_id };

  if (params.imageHash) {
    storySpec.link_data = {
      link: params.linkUrl,
      image_hash: params.imageHash,
      call_to_action: { type: ctaType },
    };
  } else if (params.videoId) {
    // video_data requires message + title as baseline text for creative_asset_groups_spec
    storySpec.video_data = {
      video_id: params.videoId,
      message: params.primaryTexts[0] || "",
      title: params.headlines[0] || "",
      link_description: params.headlines[0] || "",
      call_to_action: { type: ctaType, value: { link: params.linkUrl } },
    };
  }

  // Meta API requires complex nested objects as stringified JSON in FormData
  const form = new FormData();
  form.append("adset_id", params.adset_id);
  form.append("name", params.name);
  form.append("status", params.status || "PAUSED");
  form.append("creative", JSON.stringify({
    name: params.name,
    object_story_spec: storySpec,
  }));
  form.append("creative_asset_groups_spec", JSON.stringify({
    groups: [group],
  }));

  return metaApi<{ id: string }>(`/${await getAdAccountId()}/ads`, {
    method: "POST",
    body: form,
  });
}

export async function updateAd(adId: string, params: Record<string, unknown>) {
  return metaApi(`/${adId}`, { method: "POST", body: params });
}

/**
 * Create an ad using an existing post ID (object_story_id).
 * This preserves all engagement (likes, comments, shares) from the original ad.
 * Used when moving ads to Graveyard campaign.
 */
export async function createAdWithPostId(params: {
  adset_id: string;
  name: string;
  postId: string;
  status?: string;
}) {
  const form = new FormData();
  form.append("adset_id", params.adset_id);
  form.append("name", params.name);
  form.append("status", params.status || "ACTIVE");
  form.append("creative", JSON.stringify({
    object_story_id: params.postId,
  }));

  return metaApi<{ id: string }>(`/${await getAdAccountId()}/ads`, {
    method: "POST",
    body: form,
  });
}

export async function getAdPostId(adId: string): Promise<string | null> {
  try {
    // Step 1: Get the creative ID from the ad
    const ad = await metaApi<{ creative?: { id?: string } }>(
      `/${adId}`,
      { params: { fields: "creative{id}" } }
    );

    if (!ad.creative?.id) return null;

    // Step 2: Fetch effective_object_story_id from the creative directly
    const creative = await metaApi<{
      effective_object_story_id?: string;
      object_story_id?: string;
    }>(
      `/${ad.creative.id}`,
      { params: { fields: "effective_object_story_id,object_story_id" } }
    );

    return creative.effective_object_story_id || creative.object_story_id || null;
  } catch {
    return null;
  }
}
