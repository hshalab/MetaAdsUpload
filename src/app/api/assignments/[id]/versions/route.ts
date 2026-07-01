import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { notifyAssignmentEvent } from "@/lib/notifications";
import { eq, desc, sql } from "drizzle-orm";

// GET /api/assignments/:id/versions — list all versions for an assignment
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Verify assignment exists
    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    // Editors can only see their own assignments
    if (session.user.role !== "admin" && assignment.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const versions = await db
      .select({
        id: schema.deliverableVersions.id,
        assignmentId: schema.deliverableVersions.assignmentId,
        versionNumber: schema.deliverableVersions.versionNumber,
        r2Key: schema.deliverableVersions.r2Key,
        r2Url: schema.deliverableVersions.r2Url,
        filename: schema.deliverableVersions.filename,
        contentType: schema.deliverableVersions.contentType,
        fileSize: schema.deliverableVersions.fileSize,
        width: schema.deliverableVersions.width,
        height: schema.deliverableVersions.height,
        duration: schema.deliverableVersions.duration,
        thumbnailR2Key: schema.deliverableVersions.thumbnailR2Key,
        thumbnailUrl: schema.deliverableVersions.thumbnailUrl,
        uploadedById: schema.deliverableVersions.uploadedById,
        reviewStatus: schema.deliverableVersions.reviewStatus,
        createdAt: schema.deliverableVersions.createdAt,
        uploaderName: schema.users.name,
      })
      .from(schema.deliverableVersions)
      .leftJoin(schema.users, eq(schema.deliverableVersions.uploadedById, schema.users.id))
      .where(eq(schema.deliverableVersions.assignmentId, id))
      .orderBy(desc(schema.deliverableVersions.versionNumber));

    // Get comment counts per version
    let countMap: Record<string, number> = {};
    if (versions.length > 0) {
      const commentCounts = await db
        .select({
          deliverableVersionId: schema.reviewComments.deliverableVersionId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.reviewComments)
        .where(
          sql`${schema.reviewComments.deliverableVersionId} IN (${sql.join(
            versions.map((v) => sql`${v.id}`),
            sql`, `
          )})`
        )
        .groupBy(schema.reviewComments.deliverableVersionId);

      countMap = Object.fromEntries(commentCounts.map((c) => [c.deliverableVersionId, c.count]));
    }

    const result = versions.map((v) => ({
      ...v,
      uploadedBy: { id: v.uploadedById, name: v.uploaderName || "Unknown" },
      commentCount: countMap[v.id] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Versions GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

// POST /api/assignments/:id/versions — create a new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { r2Key, r2Url, filename, contentType, fileSize, width, height, duration, thumbnailR2Key, thumbnailUrl } = body;

    if (!r2Key || !r2Url || !filename || !contentType) {
      return NextResponse.json({ error: "r2Key, r2Url, filename, and contentType are required" }, { status: 400 });
    }

    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    if (session.user.role !== "admin" && assignment.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Determine next version number
    const [maxVersion] = await db
      .select({ max: sql<number>`coalesce(max(${schema.deliverableVersions.versionNumber}), 0)` })
      .from(schema.deliverableVersions)
      .where(eq(schema.deliverableVersions.assignmentId, id));

    const nextVersion = (maxVersion?.max || 0) + 1;

    const [version] = await db
      .insert(schema.deliverableVersions)
      .values({
        assignmentId: id,
        versionNumber: nextVersion,
        r2Key,
        r2Url,
        filename,
        contentType,
        fileSize: fileSize || null,
        width: width || null,
        height: height || null,
        duration: duration || null,
        thumbnailR2Key: thumbnailR2Key || null,
        thumbnailUrl: thumbnailUrl || null,
        uploadedById: session.user.id!,
        reviewStatus: "no_status",
      })
      .returning();

    // Fire-and-forget WhatsApp notification to admin
    void notifyAssignmentEvent("version_uploaded", assignment);

    // Update assignment's currentVersionId and deliverableUrl
    await db
      .update(schema.assignments)
      .set({
        currentVersionId: version.id,
        deliverableUrl: r2Url,
        deliverableR2Key: r2Key,
        updatedAt: new Date(),
      })
      .where(eq(schema.assignments.id, id));

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Versions POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create version" },
      { status: 500 }
    );
  }
}
