import { metaApi, getAdAccountId } from "./client";

/**
 * Poll until a video is ready for use in ad creatives.
 * Meta needs time to process uploaded videos before they can be referenced.
 */
export async function waitForVideoReady(videoId: string, maxWaitMs = 120000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const result = await metaApi<{ status?: { video_status?: string } }>(
      `/${videoId}`,
      { params: { fields: "status" } }
    );
    const status = result.status?.video_status;
    if (status === "ready") return;
    if (status === "error") throw new Error("Video processing failed on Meta's side");
    // Still processing — wait 3s and retry
    await new Promise((r) => setTimeout(r, 3000));
  }
  // Timed out but try anyway — sometimes status API lags behind
  console.warn(`Video ${videoId} still not "ready" after ${maxWaitMs}ms, proceeding anyway`);
}

/**
 * Get the auto-generated thumbnail URL for a video.
 * Meta generates thumbnails from video frames after processing.
 */
export async function getVideoThumbnail(videoId: string): Promise<string | null> {
  try {
    const result = await metaApi<{ data?: Array<{ uri: string; is_preferred?: boolean }> }>(
      `/${videoId}/thumbnails`
    );
    if (!result.data || result.data.length === 0) {
      // Fallback: get picture field directly
      const video = await metaApi<{ picture?: string }>(`/${videoId}`, {
        params: { fields: "picture" },
      });
      return video.picture || null;
    }
    const preferred = result.data.find((t) => t.is_preferred);
    return preferred?.uri || result.data[0]?.uri || null;
  } catch {
    return null;
  }
}

export async function uploadImage(imageFile: Buffer, filename: string) {
  const accountId = await getAdAccountId();

  // Meta /adimages expects "bytes" as base64-encoded string
  const result = await metaApi<{ images?: Record<string, { hash: string }> }>(
    `/${accountId}/adimages`,
    { method: "POST", body: { bytes: imageFile.toString("base64"), filename } }
  );

  const images = result.images;
  if (!images || Object.keys(images).length === 0) {
    throw new Error("Meta API returned no image data after upload");
  }

  const firstImage = Object.values(images)[0];
  if (!firstImage?.hash) {
    throw new Error("Meta API returned image without hash");
  }

  return { images, hash: firstImage.hash };
}

export async function uploadVideo(videoFile: Buffer, filename: string) {
  const form = new FormData();
  form.append("title", filename);
  form.append("source", new Blob([new Uint8Array(videoFile)]), filename);
  return metaApi<{ id: string }>(
    `/${await getAdAccountId()}/advideos`,
    { method: "POST", body: form }
  );
}

export async function createAdCreative(params: {
  name: string;
  object_story_id?: string; // Use existing post (preserves engagement)
  object_story_spec?: {
    page_id: string;
    link_data?: {
      link: string;
      message?: string;
      name?: string;
      description?: string;
      call_to_action?: { type: string };
      image_hash?: string;
    };
    video_data?: {
      video_id: string;
      title?: string;
      message?: string;
      link_description?: string;
      call_to_action?: { type: string; value: { link: string } };
      image_hash?: string;
    };
  };
  asset_feed_spec?: {
    titles?: Array<{ text: string }>;
    bodies?: Array<{ text: string }>;
    descriptions?: Array<{ text: string }>;
    link_urls?: Array<{ website_url: string }>;
    call_to_action_types?: string[];
    images?: Array<{ hash: string }>;
    videos?: Array<{ video_id: string }>;
  };
  degrees_of_freedom_spec?: {
    creative_features_spec: {
      standard_enhancements: { enroll_status: string };
    };
  };
}) {
  return metaApi<{ id: string }>(`/${await getAdAccountId()}/adcreatives`, {
    method: "POST",
    body: params,
  });
}
