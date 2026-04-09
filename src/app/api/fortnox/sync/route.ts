import { NextResponse } from "next/server";
import { batchSync, getSyncStats } from "@/lib/fortnox/sync-engine";
import { getTokens } from "@/lib/fortnox/client";

export async function POST(request: Request) {
  try {
    const tokens = await getTokens();
    if (!tokens) {
      return NextResponse.json(
        { error: "Fortnox not connected. Complete OAuth flow first." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize ?? 50;
    const cursor = body.cursor ?? undefined;

    const result = await batchSync({ batchSize, cursor });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Fortnox sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await getSyncStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("Fortnox sync stats error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get sync stats" },
      { status: 500 }
    );
  }
}
