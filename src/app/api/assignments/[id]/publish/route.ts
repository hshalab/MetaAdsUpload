import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { createCampaign } from "@/lib/meta/campaigns";
import { createAdSet } from "@/lib/meta/adsets";
import { createAd } from "@/lib/meta/ads";
import { createAdCreative } from "@/lib/meta/creatives";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const {
      campaignId: existingCampaignId,
      adsetId: existingAdsetId,
      creative: creativeConfig,
      campaign: campaignConfig,
      adset: adsetConfig,
    } = body;

    // Get assignment with related data
    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    if (assignment.status !== "ready_for_posting") {
      return NextResponse.json({ error: "Assignment must be in 'ready_for_posting' status to publish" }, { status: 400 });
    }

    if (assignment.metaAdId) {
      return NextResponse.json({ error: "Assignment already published", metaAdId: assignment.metaAdId }, { status: 400 });
    }

    // Get editor info for ad naming
    const [editor] = await db.select().from(schema.users).where(eq(schema.users.id, assignment.assignedToId));
    const editorName = editor?.name?.split(" ")[0] || "Unknown";

    // Get related entities for naming
    const formatRow = assignment.formatId ? (await db.select().from(schema.formats).where(eq(schema.formats.id, assignment.formatId)))[0] : null;
    const productRow = assignment.productId ? (await db.select().from(schema.products).where(eq(schema.products.id, assignment.productId)))[0] : null;
    const countryRow = assignment.countryId ? (await db.select().from(schema.countries).where(eq(schema.countries.id, assignment.countryId)))[0] : null;
    const angleRow = assignment.angleId ? (await db.select().from(schema.angles).where(eq(schema.angles.id, assignment.angleId)))[0] : null;

    const countryCode = countryRow?.code || "SE";
    const productName = productRow?.name || "Product";
    const formatName = formatRow?.name || "Video";
    const angleName = angleRow?.name || "";

    // Build ad name: "SE EditorName ProductName AngleName FormatName B{batch}V{version}"
    const adName = `${countryCode} ${editorName} ${productName}${angleName ? ` ${angleName}` : ""} ${formatName} B${assignment.batchNumber}V${assignment.version}`;

    const { getPageId, getPixelId } = await import("@/lib/meta/client");
    const pageId = await getPageId();
    const pixelId = await getPixelId();

    let campaignIdResult = existingCampaignId;
    let adsetIdResult = existingAdsetId;

    // Step 1: Create campaign if not provided
    if (!campaignIdResult && campaignConfig) {
      const campaign = await createCampaign({
        name: campaignConfig.name || `${countryCode} ${productName} Campaign`,
        objective: campaignConfig.objective || "OUTCOME_SALES",
        status: "PAUSED",
        daily_budget: campaignConfig.budgetType === "CBO" ? (campaignConfig.dailyBudget || 5000) : undefined,
      });
      campaignIdResult = campaign.id;
    }

    if (!campaignIdResult) {
      return NextResponse.json({ error: "Campaign ID is required. Either provide an existing one or campaign config to create one." }, { status: 400 });
    }

    // Step 2: Create adset if not provided
    if (!adsetIdResult && adsetConfig) {
      const adset = await createAdSet({
        campaign_id: campaignIdResult,
        name: adsetConfig.name || `${countryCode} ${productName} ${editorName} Adset`,
        daily_budget: adsetConfig.dailyBudget || 5000,
        targeting: adsetConfig.targeting || { geo_locations: { countries: [countryCode] } },
        optimization_goal: adsetConfig.optimizationGoal || "OFFSITE_CONVERSIONS",
        billing_event: "IMPRESSIONS",
        bid_strategy: adsetConfig.bidStrategy || "LOWEST_COST_WITHOUT_CAP",
        status: "PAUSED",
        promoted_object: pixelId ? { pixel_id: pixelId, custom_event_type: adsetConfig.conversionEvent || "PURCHASE" } : undefined,
      });
      adsetIdResult = adset.id;
    }

    if (!adsetIdResult) {
      return NextResponse.json({ error: "Adset ID is required. Either provide an existing one or adset config to create one." }, { status: 400 });
    }

    // Step 3: Create creative + ad
    const creativePayload: Record<string, unknown> = {
      name: adName,
      object_story_spec: { page_id: pageId },
    };

    // If assignment has a deliverable URL or R2 key, use it as video/image
    if (creativeConfig?.videoId) {
      (creativePayload.object_story_spec as Record<string, unknown>).video_data = {
        video_id: creativeConfig.videoId,
        message: creativeConfig.primaryText || "",
        title: creativeConfig.headline || "",
        call_to_action: {
          type: creativeConfig.ctaType || "SHOP_NOW",
          value: { link: assignment.landingPage || creativeConfig.linkUrl || "" },
        },
      };
    } else if (creativeConfig?.imageHash) {
      (creativePayload.object_story_spec as Record<string, unknown>).link_data = {
        link: assignment.landingPage || creativeConfig.linkUrl || "",
        message: creativeConfig.primaryText || "",
        name: creativeConfig.headline || "",
        image_hash: creativeConfig.imageHash,
        call_to_action: { type: creativeConfig.ctaType || "SHOP_NOW" },
      };
    }

    const adCreative = await createAdCreative(creativePayload as Parameters<typeof createAdCreative>[0]);

    const ad = await createAd({
      adset_id: adsetIdResult,
      name: adName,
      creative: { creative_id: adCreative.id },
      status: "PAUSED",
    });

    // Step 4: Update assignment with Meta IDs and set status to posted
    const [updated] = await db
      .update(schema.assignments)
      .set({
        metaAdId: ad.id,
        metaAdsetId: adsetIdResult,
        metaCampaignId: campaignIdResult,
        status: "posted",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.assignments.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      assignment: updated,
      meta: {
        campaignId: campaignIdResult,
        adsetId: adsetIdResult,
        adId: ad.id,
        creativeId: adCreative.id,
        adName,
      },
    });
  } catch (error) {
    console.error("Publish assignment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish to Meta" },
      { status: 500 }
    );
  }
}
