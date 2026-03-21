import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, or } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const userId = session.user.id;

    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (assignment.assignedToId !== userId) {
      return NextResponse.json({ error: "This assignment is not assigned to you" }, { status: 403 });
    }

    // Check for active time entry
    const activeEntries = await db
      .select({ id: schema.timeEntries.id })
      .from(schema.timeEntries)
      .where(
        and(
          eq(schema.timeEntries.userId, userId),
          eq(schema.timeEntries.status, "in_progress")
        )
      );

    if (activeEntries.length > 0) {
      return NextResponse.json(
        { error: "You already have an active task. Please finish it first." },
        { status: 400 }
      );
    }

    const taskType = assignment.status === "revision" ? "revision" : "new_video";
    const now = new Date();

    const [timeEntry] = await db
      .insert(schema.timeEntries)
      .values({
        userId,
        assignmentId: id,
        taskType,
        taskName: assignment.autoName || assignment.title,
        startTime: now,
        status: "in_progress",
      })
      .returning();

    // Update assignment status
    const [updatedAssignment] = await db
      .update(schema.assignments)
      .set({
        status: "editing_now",
        startedAt: assignment.startedAt || now,
        updatedAt: now,
      })
      .where(eq(schema.assignments.id, id))
      .returning();

    return NextResponse.json({
      timeEntry,
      assignment: updatedAssignment,
    });
  } catch (error) {
    console.error("Assignment start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start work" },
      { status: 500 }
    );
  }
}
