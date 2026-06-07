import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";

// GET ?adsetId=... | ?adsetIds=a,b,c
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = request.nextUrl;
    const adsetId = searchParams.get("adsetId");
    const adsetIdsParam = searchParams.get("adsetIds");
    if (adsetId) {
      const [owner] = await db.select().from(schema.adsetOwners).where(eq(schema.adsetOwners.adsetId, adsetId));
      return NextResponse.json({ owner: owner || null });
    }
    if (adsetIdsParam) {
      const ids = adsetIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ owners: [] });
      const owners = await db.select().from(schema.adsetOwners).where(inArray(schema.adsetOwners.adsetId, ids));
      return NextResponse.json({ owners });
    }
    const owners = await db.select().from(schema.adsetOwners);
    return NextResponse.json({ owners });
  } catch (error) {
    console.error("adset-owner GET error:", error);
    return NextResponse.json({ error: "Failed to fetch ad set owners" }, { status: 500 });
  }
}

// POST — set/update an ad set's owner (admin). Body: { adsetId, videoEditorId, creativeStrategistId?, adsetName?, campaignId?, source? }
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { adsetId, videoEditorId, creativeStrategistId, adsetName, campaignId, source } = body;
    if (!adsetId) return NextResponse.json({ error: "adsetId is required" }, { status: 400 });
    if (!videoEditorId && !creativeStrategistId) {
      return NextResponse.json({ error: "videoEditorId or creativeStrategistId is required" }, { status: 400 });
    }

    const now = new Date();
    const [row] = await db
      .insert(schema.adsetOwners)
      .values({
        adsetId,
        videoEditorId: videoEditorId || null,
        creativeStrategistId: creativeStrategistId || null,
        adsetName: adsetName || null,
        campaignId: campaignId || null,
        source: source || "analyzer",
        assignedById: session.user.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.adsetOwners.adsetId,
        set: {
          videoEditorId: videoEditorId || null,
          creativeStrategistId: creativeStrategistId || null,
          adsetName: adsetName || null,
          campaignId: campaignId || null,
          source: source || "analyzer",
          assignedById: session.user.id,
          updatedAt: now,
        },
      })
      .returning();

    // Keep the bonus ledger (keyed by ad set id) pointed at the new owner.
    if (videoEditorId) {
      await db.update(schema.adBonuses).set({ editorId: videoEditorId, updatedAt: now }).where(eq(schema.adBonuses.adId, adsetId));
    }

    return NextResponse.json({ owner: row });
  } catch (error) {
    console.error("adset-owner POST error:", error);
    return NextResponse.json({ error: "Failed to set ad set owner" }, { status: 500 });
  }
}

// DELETE — clear ad set ownership. Body: { adsetId }
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { adsetId } = await request.json();
    if (!adsetId) return NextResponse.json({ error: "adsetId is required" }, { status: 400 });
    await db.delete(schema.adsetOwners).where(eq(schema.adsetOwners.adsetId, adsetId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("adset-owner DELETE error:", error);
    return NextResponse.json({ error: "Failed to clear ad set owner" }, { status: 500 });
  }
}
