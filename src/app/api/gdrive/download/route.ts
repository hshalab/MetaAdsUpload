import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { downloadFile } from "@/lib/gdrive/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fileId = request.nextUrl.searchParams.get("id");
    if (!fileId) return NextResponse.json({ error: "Missing file ID" }, { status: 400 });

    const buffer = await downloadFile(fileId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Download failed" }, { status: 500 });
  }
}
