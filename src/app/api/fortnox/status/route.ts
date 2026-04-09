import { NextResponse } from "next/server";
import { getTokens } from "@/lib/fortnox/client";

export async function GET() {
  try {
    const tokens = await getTokens();

    if (!tokens) {
      return NextResponse.json({
        connected: false,
        expiresAt: null,
      });
    }

    const now = Date.now();
    const isExpired = now >= tokens.expiresAt;

    return NextResponse.json({
      connected: !isExpired,
      expiresAt: new Date(tokens.expiresAt).toISOString(),
      expiresIn: Math.max(0, Math.floor((tokens.expiresAt - now) / 1000)),
    });
  } catch (err) {
    console.error("Fortnox status error:", err);
    return NextResponse.json(
      { connected: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
