import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { updateAd, getAdPostId, createAdWithPostId } from "@/lib/meta/ads";
import { getAdSets } from "@/lib/meta/adsets";
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

        if (!settings.graveyardCampaignId) {
          return NextResponse.json({
            error: "Ingen Graveyard-kampanj konfigurerad. Gå till Evolve KPI Settings och välj din Graveyard-kampanj.",
          }, { status: 400 });
        }

        // 1. Get the post ID to preserve engagement
        const postId = await getAdPostId(adId);
        if (!postId) {
          return NextResponse.json({
            error: "Kunde inte hämta post-ID för denna annons. Annonsen kan sakna en publicerad post.",
          }, { status: 400 });
        }

        // 2. Find the first active adset in the graveyard campaign
        const graveyardAdsets = await getAdSets(settings.graveyardCampaignId);
        const targetAdset = graveyardAdsets.find((a) => a.status === "ACTIVE") || graveyardAdsets[0];

        if (!targetAdset) {
          return NextResponse.json({
            error: "Ingen ad set hittad i Graveyard-kampanjen. Skapa en ad set med cost cap först.",
          }, { status: 400 });
        }

        // 3. Pause the original ad
        await updateAd(adId, { status: "PAUSED" });

        // 4. Create new ad in graveyard with post ID (preserves all engagement)
        const result = await createAdWithPostId({
          adset_id: targetAdset.id,
          name: `[GY] ${adName || adId}`,
          postId,
          status: "ACTIVE",
        });

        newAdId = result.id;
        actionDescription = `Pausad i CBO → duplicerad till Graveyard (${targetAdset.name}) med post-ID. Ny ad: ${result.id}`;
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
