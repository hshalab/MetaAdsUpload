import { NextRequest, NextResponse } from "next/server";
import { runAllRules } from "@/lib/rules/engine";

export async function POST(request: NextRequest) {
  // C5: Guard against unset CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runAllRules();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Rules engine error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
