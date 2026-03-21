import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const assignedToId = searchParams.get("assignedToId");
    const formatId = searchParams.get("formatId");
    const productId = searchParams.get("productId");
    const priority = searchParams.get("priority");

    const conditions = [];
    if (assignedToId) conditions.push(eq(schema.assignments.assignedToId, assignedToId));
    if (formatId) conditions.push(eq(schema.assignments.formatId, formatId));
    if (productId) conditions.push(eq(schema.assignments.productId, productId));
    if (priority) conditions.push(eq(schema.assignments.priority, priority));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const assignments = await db
      .select()
      .from(schema.assignments)
      .where(whereClause)
      .orderBy(asc(schema.assignments.priority), asc(schema.assignments.dueDate), desc(schema.assignments.createdAt));

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

    // Look up users for display
    const allUsers = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users);
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    type BoardStatus = "ready_for_editing" | "editing_now" | "ready_for_review" | "revision" | "ready_for_posting" | "posted";
    const board: Record<BoardStatus, unknown[]> = {
      ready_for_editing: [],
      editing_now: [],
      ready_for_review: [],
      revision: [],
      ready_for_posting: [],
      posted: [],
    };

    for (const a of assignments) {
      const enriched = {
        ...a,
        totalTrackedSeconds: timeMap.get(a.id) || 0,
        assignedTo: userMap.get(a.assignedToId) || null,
      };
      if (a.status in board) {
        board[a.status as BoardStatus].push(enriched);
      }
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error("Board GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch board" },
      { status: 500 }
    );
  }
}
