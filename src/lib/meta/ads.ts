import { metaApi, metaApiPaginated, getAdAccountId } from "./client";

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

export async function getAds(adsetId?: string, limit = 200, statusFilter?: "ACTIVE" | "PAUSED" | "ARCHIVED") {
  const endpoint = adsetId ? `/${adsetId}/ads` : `/${await getAdAccountId()}/ads`;
  const params: Record<string, string | number> = { fields: AD_FIELDS, limit };
  if (statusFilter) {
    params.filtering = JSON.stringify([{ field: "effective_status", operator: "IN", value: [statusFilter] }]);
  }
  return metaApiPaginated<Ad>(endpoint, { params });
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
    // Single request: fetch creative with effective_object_story_id nested
    const ad = await metaApi<{
      creative?: {
        id?: string;
        effective_object_story_id?: string;
        object_story_id?: string;
      };
    }>(
      `/${adId}`,
      { params: { fields: "creative{id,effective_object_story_id,object_story_id}" } }
    );

    return ad.creative?.effective_object_story_id || ad.creative?.object_story_id || null;
  } catch {
    return null;
  }
}

/**
 * Batch-fetch post IDs for multiple ads. Much more efficient than calling getAdPostId N times.
 * Uses a single request per ad but fetches creative fields inline.
 */
export async function getAdPostIds(adIds: string[]): Promise<Map<string, string>> {
  const postIds = new Map<string, string>();

  // Process in parallel with a concurrency limit (throttle handles this)
  const results = await Promise.allSettled(
    adIds.map(async (adId) => {
      const postId = await getAdPostId(adId);
      if (postId) postIds.set(adId, postId);
    })
  );

  // Log any failures
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`getAdPostIds: ${failures.length}/${adIds.length} failed`);
  }

  return postIds;
}
