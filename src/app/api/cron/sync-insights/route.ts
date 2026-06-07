import { NextRequest, NextResponse } from "next/server";
import { runEditorInsightsSync } from "@/lib/meta/sync-insights";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // allow long syncs (daily rows for many ads)

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server configuration error: CRON_SECRET not set" }, { status: 500 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const synced = await runEditorInsightsSync();
    return NextResponse.json({ success: true, synced });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// POST — manual / external trigger. GET — Vercel Cron (auto-sends Bearer CRON_SECRET).
export async function POST(request: NextRequest) { return handle(request); }
export async function GET(request: NextRequest) { return handle(request); }
