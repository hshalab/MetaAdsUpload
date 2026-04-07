import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { updateAd } from "@/lib/meta/ads";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { adId, action, classification, metrics, campaignId, adsetId, dateRange } = body as {
      adId: string;
      action: "duplicate_abo" | "move_zombie" | "pause" | "let_run";
      classification: string;
      metrics?: { spend: number; roas: number; cpa: number; purchases: number };
      campaignId?: string;
      adsetId?: string;
      dateRange?: { since: string; until: string };
    };

    if (!adId || !action) {
      return NextResponse.json({ error: "Missing adId or action" }, { status: 400 });
    }

    let actionDescription = "";

    switch (action) {
      case "pause":
        await updateAd(adId, { status: "PAUSED" });
        actionDescription = "Paused ad";
        break;

      case "let_run":
        actionDescription = "Reviewed — letting run";
        break;

      case "duplicate_abo":
        // For now, record the intent. Full duplication would need target campaign selection.
        actionDescription = "Marked for ABO duplication";
        break;

      case "move_zombie":
        actionDescription = "Marked for zombie campaign move";
        break;
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

    return NextResponse.json({ success: true, action: actionDescription });
  } catch (error) {
    console.error("Action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute action" },
      { status: 500 }
    );
  }
}
