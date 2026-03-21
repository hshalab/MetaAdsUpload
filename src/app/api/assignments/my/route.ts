import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, ne, sql, asc, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;

    const assignments = await db
      .select()
      .from(schema.assignments)
      .where(
        and(
          eq(schema.assignments.assignedToId, userId),
          ne(schema.assignments.status, "posted")
        )
      )
      .orderBy(asc(schema.assignments.priority), asc(schema.assignments.dueDate));

    // Get time sums
    const assignmentIds = assignments.map(a => a.id);
    const timeMap = new Map<string, number>();

    if (assignmentIds.length > 0) {
      const timeSums = await db
        .select({
          assignmentId: schema.timeEntries.assignmentId,
          total: sql<number>`coalesce(sum(${schema.timeEntries.durationSeconds}), 0)`,
        })
        .from(schema.timeEntries)
        .where(
          and(
            eq(schema.timeEntries.status, "completed"),
            sql`${schema.timeEntries.assignmentId} = ANY(${assignmentIds})`
          )
        )
        .groupBy(schema.timeEntries.assignmentId);

      for (const ts of timeSums) {
        if (ts.assignmentId) timeMap.set(ts.assignmentId, ts.total);
      }
    }

    const enriched = assignments.map(a => ({
      ...a,
      totalTrackedSeconds: timeMap.get(a.id) || 0,
    }));

    const needsAttention = enriched.filter(a => a.status === "revision");
    const active = enriched.filter(a => a.status === "editing_now");
    const pending = enriched.filter(a => a.status === "ready_for_editing");
    const inReview = enriched.filter(a => ["ready_for_review", "ready_for_posting"].includes(a.status));

    return NextResponse.json({
      needsAttention,
      active,
      pending,
      inReview,
      total: assignments.length,
    });
  } catch (error) {
    console.error("My assignments GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
