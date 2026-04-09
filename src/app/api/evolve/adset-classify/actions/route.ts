import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { getAds, getAdPostId, createAdWithPostId } from "@/lib/meta/ads";
import { updateAdSet, getAdSets } from "@/lib/meta/adsets";
import { getEvolveSettings } from "@/lib/evolve/settings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { adsetId, action, classification, metrics, campaignId, adsetName, dateRange } = body as {
      adsetId: string;
      action: "move_zombie" | "pause" | "let_run";
      classification: string;
      metrics?: { spend: number; roas: number; cpa: number; purchases: number };
      campaignId?: string;
      adsetName?: string;
      dateRange?: { since: string; until: string };
    };

    if (!adsetId || !action) {
      return NextResponse.json({ error: "Missing adsetId or action" }, { status: 400 });
    }

    let actionDescription = "";
    const newAdIds: string[] = [];

    switch (action) {
      case "pause":
        await updateAdSet(adsetId, { status: "PAUSED" });
        actionDescription = "Ad set pausad";
        break;

      case "let_run":
        actionDescription = "Ad set granskad — låter köra";
        break;

      case "move_zombie": {
        const settings = await getEvolveSettings();

        if (!settings.graveyardCampaignId) {
          return NextResponse.json({
            error: "Ingen Graveyard-kampanj konfigurerad. Gå till Evolve KPI Settings och välj din Graveyard-kampanj.",
          }, { status: 400 });
        }

        // 1. Get all active ads in this ad set
        const adsInSet = await getAds(adsetId, 100);
        const activeAds = adsInSet.filter((a) => a.status === "ACTIVE");

        if (activeAds.length === 0) {
          return NextResponse.json({
            error: "Inga aktiva ads i detta ad set att flytta.",
          }, { status: 400 });
        }

        // 2. Find target adset in graveyard
        const graveyardAdsets = await getAdSets(settings.graveyardCampaignId);
        const targetAdset = graveyardAdsets.find((a) => a.status === "ACTIVE") || graveyardAdsets[0];

        if (!targetAdset) {
          return NextResponse.json({
            error: "Ingen ad set hittad i Graveyard-kampanjen. Skapa en ad set med cost cap först.",
          }, { status: 400 });
        }

        // 3. For each ad: get post ID, create in graveyard
        const results: string[] = [];
        const errors: string[] = [];

        for (const ad of activeAds) {
          try {
            const postId = await getAdPostId(ad.id);
            if (!postId) {
              errors.push(`${ad.name}: kunde inte hämta post-ID`);
              continue;
            }

            const result = await createAdWithPostId({
              adset_id: targetAdset.id,
              name: `[GY] ${ad.name}`,
              postId,
              status: "ACTIVE",
            });

            newAdIds.push(result.id);
            results.push(`${ad.name} → ${result.id}`);
          } catch (err) {
            errors.push(`${ad.name}: ${err instanceof Error ? err.message : "failed"}`);
          }
        }

        // 4. Pause the entire ad set
        await updateAdSet(adsetId, { status: "PAUSED" });

        actionDescription = `Ad set pausad. ${results.length}/${activeAds.length} ads duplicerade till Graveyard (${targetAdset.name}).`;
        if (errors.length > 0) {
          actionDescription += ` Fel: ${errors.join("; ")}`;
        }
        break;
      }
    }

    // Save to audit trail
    await db.insert(schema.adClassifications).values({
      adId: adsetId,
      classification: classification || "unknown",
      spend: metrics?.spend || 0,
      roas: metrics?.roas || 0,
      cpa: metrics?.cpa || 0,
      purchases: metrics?.purchases || 0,
      recommendation: actionDescription,
      actionTaken: action,
      actionTakenAt: new Date(),
      campaignId: campaignId || null,
      adsetId: adsetId,
      dateRangeStart: dateRange?.since || null,
      dateRangeEnd: dateRange?.until || null,
    });

    return NextResponse.json({
      success: true,
      action: actionDescription,
      newAdIds,
    });
  } catch (error) {
    console.error("AdSet Action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute action" },
      { status: 500 }
    );
  }
}
