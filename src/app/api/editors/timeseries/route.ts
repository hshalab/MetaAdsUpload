import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { resolveOwnedAdsets } from "@/lib/bonus-ledger";
import { getEditorTimeseries } from "@/lib/editor-stats";
import { getEvolveSettings } from "@/lib/evolve/settings";

// GET /api/editors/timeseries?editorId=...&from=...&to=...
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const editorId = searchParams.get("editorId");
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = searchParams.get("to") || new Date().toISOString().split("T")[0];
    if (!editorId) return NextResponse.json({ error: "editorId is required" }, { status: 400 });

    // Editor's owned ad sets → their ads → timeseries over those ads.
    const owned = await resolveOwnedAdsets();
    const adsetIds = owned.filter((a) => a.videoEditorId === editorId).map((a) => a.adsetId);
    const ads = adsetIds.length
      ? await db.select({ id: schema.adsCache.id }).from(schema.adsCache).where(inArray(schema.adsCache.adsetId, adsetIds))
      : [];
    const adIds = ads.map((a) => a.id);
    const settings = await getEvolveSettings();
    const timeseries = await getEditorTimeseries(adIds, from, to, settings.sekPerUsd);

    return NextResponse.json({ timeseries });
  } catch (error) {
    console.error("Editor timeseries error:", error);
    return NextResponse.json({ error: "Failed to fetch timeseries" }, { status: 500 });
  }
}
