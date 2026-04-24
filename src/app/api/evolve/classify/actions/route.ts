import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { updateAd, getAdPostId, createAdWithPostId } from "@/lib/meta/ads";
import { createAdSet } from "@/lib/meta/adsets";
import { metaApi } from "@/lib/meta/client";
import { getEvolveSettings } from "@/lib/evolve/settings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { adId, action, classification, metrics, campaignId, adsetId, adName, dateRange } = body as {
      adId: string;
      action: "move_zombie" | "pause" | "let_run" | "reviewed";
      classification: string;
      metrics?: { spend: number; roas: number; cpa: number; purchases: number };
      campaignId?: string;
      adsetId?: string;
      adName?: string;
      dateRange?: { since: string; until: string };
    };

    if (!adId || !action) {
      return NextResponse.json({ error: "Missing adId or action" }, { status: 400 });
    }

    let actionDescription = "";
    let newAdId: string | undefined;

    switch (action) {
      case "pause":
        await updateAd(adId, { status: "PAUSED" });
        actionDescription = "Pausad";
        break;

      case "let_run":
        actionDescription = "Granskad — låter köra";
        break;

      case "reviewed":
        actionDescription = "Markerad som granskad";
        break;

      case "move_zombie": {
        const settings = await getEvolveSettings();

        // Look up graveyard for this specific campaign, fall back to global default
        const targetGraveyardId = (campaignId && settings.graveyardMappings[campaignId])
          || settings.graveyardCampaignId;

        if (!targetGraveyardId) {
          return NextResponse.json({
            error: "Ingen Graveyard-kampanj konfigurerad för denna kampanj. Gå till Evolve KPI Settings och koppla en Graveyard.",
          }, { status: 400 });
        }

        // 1. Get the post ID to preserve engagement
        const postId = await getAdPostId(adId);
        if (!postId) {
          return NextResponse.json({
            error: "Kunde inte hämta post-ID för denna annons. Annonsen kan sakna en publicerad post.",
          }, { status: 400 });
        }

        // 2. Fetch source ad set's targeting to copy
        if (!adsetId) {
          return NextResponse.json({ error: "adsetId krävs för move_zombie" }, { status: 400 });
        }

        const sourceAdset = await metaApi<{
          name: string;
          targeting: Record<string, unknown>;
          optimization_goal: string;
          billing_event: string;
          promoted_object?: Record<string, unknown>;
        }>(`/${adsetId}`, {
          params: { fields: "name,targeting,optimization_goal,billing_event,promoted_object" },
        });

        // 3. Create new ad set in Graveyard with cost cap
        const costCapValue = Math.round(settings.targetCpa * (1 - settings.zombieCostCapDiscount) * 100);
        const gyAdsetName = `[GY] ${adName || adId}`;

        const newAdset = await createAdSet({
          campaign_id: targetGraveyardId,
          name: gyAdsetName,
          targeting: sourceAdset.targeting,
          optimization_goal: sourceAdset.optimization_goal,
          billing_event: sourceAdset.billing_event,
          bid_strategy: "LOWEST_COST_WITH_BID_CAP",
          bid_amount: costCapValue,
          status: "ACTIVE",
          ...(sourceAdset.promoted_object && { promoted_object: sourceAdset.promoted_object }),
        });

        // 4. Pause the original ad
        await updateAd(adId, { status: "PAUSED" });

        // 5. Create new ad in graveyard with post ID
        const result = await createAdWithPostId({
          adset_id: newAdset.id,
          name: adName || adId,
          postId,
          status: "ACTIVE",
        });

        newAdId = result.id;
        actionDescription = `Pausad → nytt GY ad set "${gyAdsetName}" (cost cap ${costCapValue / 100} kr). Ny ad: ${result.id}`;
        break;
      }
    }

    // Save to audit trail
    await db.insert(schema.adClassifications).values({
      adId,
      classification: classification || "unknown",
      spend: metrics?.spend || 0,
      roas: metrics?.roas || 0,
      cpa: metrics?.cpa || 0,
      purchases: metrics?.purchases || 0,
      recommendation: actionDescription,
      actionTaken: action,
      actionTakenAt: new Date(),
      campaignId: campaignId || null,
      adsetId: adsetId || null,
      dateRangeStart: dateRange?.since || null,
      dateRangeEnd: dateRange?.until || null,
    });

    return NextResponse.json({
      success: true,
      action: actionDescription,
      newAdId,
    });
  } catch (error) {
    console.error("Action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute action" },
      { status: 500 }
    );
  }
}
