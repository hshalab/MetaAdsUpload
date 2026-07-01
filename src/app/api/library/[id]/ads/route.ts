import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCreativeAdBreakdown } from "@/lib/creative-metrics";

// GET /api/library/:id/ads?days=30 — per-ad performance breakdown for one
// library creative (which Meta ads run this asset, and how each is doing).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const creativeId = parseInt(id, 10);
    if (!Number.isFinite(creativeId)) {
      return NextResponse.json({ error: "Invalid creative id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.max(0, parseInt(searchParams.get("days") || "30"));

    const ads = await getCreativeAdBreakdown(creativeId, days);
    return NextResponse.json({ ads });
  } catch (error) {
    console.error("Library ad breakdown error:", error);
    return NextResponse.json({ error: "Failed to fetch ad breakdown" }, { status: 500 });
  }
}
