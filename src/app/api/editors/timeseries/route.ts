import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveOwnedAds } from "@/lib/bonus-ledger";
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

    const owned = await resolveOwnedAds();
    const adIds = owned.filter((a) => a.videoEditorId === editorId).map((a) => a.adId);
    const settings = await getEvolveSettings();
    const timeseries = await getEditorTimeseries(adIds, from, to, settings.sekPerUsd);

    return NextResponse.json({ timeseries });
  } catch (error) {
    console.error("Editor timeseries error:", error);
    return NextResponse.json({ error: "Failed to fetch timeseries" }, { status: 500 });
  }
}
