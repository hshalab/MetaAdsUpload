import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Get latest deliverable version for this assignment
    const [version] = await db
      .select({
        filename: schema.deliverableVersions.filename,
        contentType: schema.deliverableVersions.contentType,
        versionNumber: schema.deliverableVersions.versionNumber,
      })
      .from(schema.deliverableVersions)
      .where(eq(schema.deliverableVersions.assignmentId, id))
      .orderBy(desc(schema.deliverableVersions.versionNumber))
      .limit(1);

    if (!version) {
      return NextResponse.json({ filename: null });
    }

    return NextResponse.json({
      filename: version.filename,
      contentType: version.contentType,
      versionNumber: version.versionNumber,
    });
  } catch (error) {
    console.error("Deliverable info error:", error);
    return NextResponse.json({ filename: null });
  }
}
