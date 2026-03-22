import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const userId = session.user.id;
    const userRole = session.user.role;
    const body = await request.json();
    const { status, revisionFeedback } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    // Normalize to lowercase for DB storage
    const dbStatus = status.toLowerCase();

    const validStatuses = ["ready_for_editing", "editing_now", "ready_for_review", "revision", "ready_for_posting", "posted"];
    if (!validStatuses.includes(dbStatus)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const [current] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!current) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Validate status transitions
    if (userRole !== "admin") {
      // Editors: own assignments only, restricted transitions
      if (current.assignedToId !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      const allowedTransitions: Record<string, string[]> = {
        ready_for_editing: ["editing_now"],
        editing_now: ["ready_for_review"],
        revision: ["ready_for_review"],
      };
      if (!allowedTransitions[current.status]?.includes(dbStatus)) {
        return NextResponse.json({ error: "Invalid status transition" }, { status: 403 });
      }
    } else {
      // Admins: allow all except going backward from posted
      const adminTransitions: Record<string, string[]> = {
        ready_for_editing: ["editing_now", "revision"],
        editing_now: ["ready_for_review", "ready_for_editing", "revision"],
        ready_for_review: ["ready_for_posting", "revision", "editing_now"],
        revision: ["editing_now", "ready_for_review", "ready_for_editing"],
        ready_for_posting: ["posted", "revision", "ready_for_review"],
        posted: [], // Cannot go backward from posted
      };
      if (!adminTransitions[current.status]?.includes(dbStatus)) {
        return NextResponse.json(
          { error: `Cannot change status from ${current.status} to ${dbStatus}` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = { status: dbStatus, updatedAt: new Date() };

    if (dbStatus === "editing_now" && !current.startedAt) {
      updateData.startedAt = new Date();
    }
    if (dbStatus === "posted") {
      updateData.completedAt = new Date();
    }
    if (dbStatus === "revision" && revisionFeedback) {
      updateData.revisionFeedback = revisionFeedback;
    }

    const [assignment] = await db
      .update(schema.assignments)
      .set(updateData)
      .where(eq(schema.assignments.id, id))
      .returning();

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Assignment status PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update status" },
      { status: 500 }
    );
  }
}
