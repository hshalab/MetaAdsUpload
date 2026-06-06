import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEditorsOverview } from "@/lib/editor-stats";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

    const data = await getEditorsOverview({ from, to });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Editors API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch editor data" },
      { status: 500 }
    );
  }
}
