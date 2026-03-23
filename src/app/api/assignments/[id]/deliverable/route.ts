import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { deliverableUrl, deliverableR2Key, filename, contentType, fileSize, width, height, duration } = body;

    if (!deliverableUrl) {
      return NextResponse.json({ error: "deliverableUrl is required" }, { status: 400 });
    }

    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    // Editors can only update their own assignments; admins can update any
    if (session.user.role !== "admin" && assignment.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Create a version record if we have enough info
    let versionId: string | null = null;
    if (deliverableR2Key) {
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
          r2Key: deliverableR2Key,
          r2Url: deliverableUrl,
          filename: filename || deliverableR2Key.split("/").pop() || "deliverable",
          contentType: contentType || "video/mp4",
          fileSize: fileSize || null,
          width: width || null,
          height: height || null,
          duration: duration || null,
          uploadedById: session.user.id!,
          reviewStatus: "no_status",
        })
        .returning();

      versionId = version.id;
    }

    const updateData: Record<string, unknown> = {
      deliverableUrl,
      deliverableR2Key: deliverableR2Key || null,
      updatedAt: new Date(),
    };
    if (versionId) {
      updateData.currentVersionId = versionId;
    }

    const [updated] = await db
      .update(schema.assignments)
      .set(updateData)
      .where(eq(schema.assignments.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Save deliverable error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save deliverable" },
      { status: 500 }
    );
  }
}
