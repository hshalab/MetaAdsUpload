import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

// PATCH /api/assignments/:id/versions/:versionId/status — update review status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, versionId } = await params;
    const body = await request.json();
    const { reviewStatus } = body;

    const validStatuses = ["no_status", "in_progress", "needs_review", "approved"];
    if (!reviewStatus || !validStatuses.includes(reviewStatus)) {
      return NextResponse.json({ error: "Invalid reviewStatus" }, { status: 400 });
    }

    // Verify assignment exists and user has access
    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    if (session.user.role !== "admin" && assignment.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify version exists and belongs to this assignment
    const [version] = await db
      .select()
      .from(schema.deliverableVersions)
      .where(eq(schema.deliverableVersions.id, versionId));

    if (!version || version.assignmentId !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(schema.deliverableVersions)
      .set({ reviewStatus })
      .where(eq(schema.deliverableVersions.id, versionId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Version status PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update version status" },
      { status: 500 }
    );
  }
}
