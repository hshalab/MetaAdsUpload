import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { uploadImage, uploadVideo, createAdCreative } from "@/lib/meta/creatives";
import { createAdSet } from "@/lib/meta/adsets";
import { createAd } from "@/lib/meta/ads";
import { getPageId, getPixelId, metaApi, getAdAccountId } from "@/lib/meta/client";

export const maxDuration = 300; // 5 minutes for large video uploads

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function downloadFromR2(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) throw new Error("R2_BUCKET_NAME not configured");

  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  const result = await client.send(command);

  if (!result.Body) throw new Error("Empty file in R2");

  const chunks: Uint8Array[] = [];
  const stream = result.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: result.ContentType || "application/octet-stream",
  };
}

async function uploadVideoByUrl(url: string, filename: string): Promise<string> {
  const accountId = await getAdAccountId();
  const result = await metaApi<{ id: string }>(`/${accountId}/advideos`, {
    method: "POST",
    body: { file_url: url, title: filename },
  });
  return result.id;
}

// Determine if we should use Dynamic Creative (multiple headlines or texts)
function isDynamicCreative(adCopy: AdCopyInput): boolean {
  const headlineCount = Array.isArray(adCopy.headlines) ? adCopy.headlines.filter(Boolean).length : 0;
  const textCount = Array.isArray(adCopy.primaryTexts) ? adCopy.primaryTexts.filter(Boolean).length : 0;
  return headlineCount > 1 || textCount > 1;
}

interface AdCopyInput {
  // Support both single values and arrays
  headline?: string;
  headlines?: string[];
  primaryText?: string;
  primaryTexts?: string[];
  linkUrl: string;
  ctaType: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const {
      r2Key,
      r2Url,
      filename,
      mediaType,
      campaignId,
      adsetId: existingAdsetId,
      adsetConfig,
      adCopy,
      adName: adNameValue,
    } = body as {
      r2Key: string;
      r2Url: string;
      filename: string;
      mediaType: "video" | "image";
      campaignId: string;
      adsetId?: string;
      adsetConfig?: {
        name: string;
        dailyBudget: number;
        targeting: Record<string, unknown>;
        optimizationGoal: string;
        bidStrategy: string;
        conversionEvent?: string;
      };
      adCopy: AdCopyInput;
      adName: string;
    };

    if (!r2Key || !campaignId || !adCopy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Normalize ad copy — support both single and array formats
    const headlinesArr = (adCopy.headlines?.filter(Boolean) || (adCopy.headline ? [adCopy.headline] : []));
    const textsArr = (adCopy.primaryTexts?.filter(Boolean) || (adCopy.primaryText ? [adCopy.primaryText] : []));
    const useDynamic = headlinesArr.length > 1 || textsArr.length > 1;

    const results: Record<string, string> = {};

    // Step 1: Upload media to Meta
    let videoId: string | undefined;
    let imageHash: string | undefined;

    if (mediaType === "video") {
      // Try file_url first (Meta downloads directly from R2 — faster)
      try {
        videoId = await uploadVideoByUrl(r2Url, filename);
      } catch {
        // Fallback: download from R2 and upload buffer
        const { buffer } = await downloadFromR2(r2Key);
        const result = await uploadVideo(buffer, filename);
        videoId = result.id;
      }
      results.videoId = videoId;
    } else {
      const { buffer } = await downloadFromR2(r2Key);
      const result = await uploadImage(buffer, filename);
      imageHash = result.hash;
      results.imageHash = imageHash;
    }

    // Step 2: Create Ad Creative
    const pageId = await getPageId();
    const creativeName = `${filename.replace(/\.[^.]+$/, "")} ${new Date().toISOString().split("T")[0]}`;

    let creativePayload: Record<string, unknown>;

    if (useDynamic) {
      // Dynamic Creative — uses asset_feed_spec for A/B testing multiple headlines/texts
      creativePayload = {
        name: creativeName,
        object_story_spec: { page_id: pageId },
        asset_feed_spec: {
          bodies: textsArr.map((text) => ({ text })),
          titles: headlinesArr.map((text) => ({ text })),
          link_urls: [{ website_url: adCopy.linkUrl }],
          call_to_action_types: [adCopy.ctaType || "SHOP_NOW"],
          ...(videoId
            ? { videos: [{ video_id: videoId }], ad_formats: ["SINGLE_VIDEO"] }
            : imageHash
            ? { images: [{ hash: imageHash }], ad_formats: ["SINGLE_IMAGE"] }
            : {}),
        },
      };
    } else {
      // Standard Creative — single headline/text
      const firstHeadline = headlinesArr[0] || "";
      const firstText = textsArr[0] || "";

      creativePayload = {
        name: creativeName,
        object_story_spec: { page_id: pageId },
      };

      if (videoId) {
        (creativePayload.object_story_spec as Record<string, unknown>).video_data = {
          video_id: videoId,
          message: firstText,
          title: firstHeadline,
          call_to_action: {
            type: adCopy.ctaType || "SHOP_NOW",
            value: { link: adCopy.linkUrl || "" },
          },
        };
      } else if (imageHash) {
        (creativePayload.object_story_spec as Record<string, unknown>).link_data = {
          link: adCopy.linkUrl || "",
          message: firstText,
          name: firstHeadline,
          image_hash: imageHash,
          call_to_action: { type: adCopy.ctaType || "SHOP_NOW" },
        };
      }
    }

    const adCreative = await createAdCreative(
      creativePayload as Parameters<typeof createAdCreative>[0]
    );
    results.creativeId = adCreative.id;
    if (useDynamic) results.dynamicCreative = "true";

    // Step 3: Use existing or create new ad set
    let adsetId = existingAdsetId;

    if (!adsetId && adsetConfig) {
      const pixelId = await getPixelId();
      const adsetParams: Record<string, unknown> = {
        campaign_id: campaignId,
        name: adsetConfig.name,
        daily_budget: adsetConfig.dailyBudget ? adsetConfig.dailyBudget * 100 : undefined,
        targeting: adsetConfig.targeting || { geo_locations: { countries: ["SE"] } },
        optimization_goal: adsetConfig.optimizationGoal || "OFFSITE_CONVERSIONS",
        billing_event: "IMPRESSIONS",
        bid_strategy: adsetConfig.bidStrategy || "LOWEST_COST_WITHOUT_CAP",
        status: "PAUSED",
        promoted_object: pixelId
          ? { pixel_id: pixelId, custom_event_type: adsetConfig.conversionEvent || "PURCHASE" }
          : undefined,
      };

      // If dynamic creative, tell Meta this ad set uses it
      if (useDynamic) {
        adsetParams.is_dynamic_creative = true;
      }

      const adset = await createAdSet(adsetParams as Parameters<typeof createAdSet>[0]);
      adsetId = adset.id;
      results.adsetId = adset.id;
    } else if (adsetId) {
      results.adsetId = adsetId;
    }

    if (!adsetId) {
      return NextResponse.json({ error: "No ad set ID and no ad set config provided" }, { status: 400 });
    }

    // Step 4: Create Ad
    const ad = await createAd({
      adset_id: adsetId,
      name: adNameValue || creativeName,
      creative: { creative_id: adCreative.id },
      status: "PAUSED",
    });
    results.adId = ad.id;

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Upload from R2 error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
