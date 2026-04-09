import { NextResponse } from "next/server";
import { batchSync } from "@/lib/fortnox/sync-engine";
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
    const batchSize = Math.min(body.batchSize ?? 200, 500);
    const cursor = body.cursor ?? undefined;

    const result = await batchSync({ batchSize, cursor });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Fortnox bulk sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bulk sync failed" },
      { status: 500 }
    );
  }
}
