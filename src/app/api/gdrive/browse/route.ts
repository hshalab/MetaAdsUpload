import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFiles } from "@/lib/gdrive/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const folderId = request.nextUrl.searchParams.get("folder") || undefined;
    const files = await listFiles(folderId);
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to browse" }, { status: 500 });
  }
}
