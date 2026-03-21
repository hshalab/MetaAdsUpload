import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get all editors
    const editors = await db.select().from(schema.users).where(eq(schema.users.role, "editor"));

    const result = [];

    for (const editor of editors) {
      // Get assignments for this editor
      const assignments = await db
        .select()
        .from(schema.assignments)
        .where(eq(schema.assignments.assignedToId, editor.id));

      const completed = assignments.filter((a) => a.status === "posted");
      const revisions = assignments.filter((a) => a.status === "revision" || a.revisionFeedback);

      // Get time entries
      const timeEntries = await db
        .select({
          totalSeconds: sql<number>`sum(${schema.timeEntries.durationSeconds})`,
        })
        .from(schema.timeEntries)
        .where(eq(schema.timeEntries.userId, editor.id));

      const totalSeconds = timeEntries[0]?.totalSeconds || 0;
      const completedCount = completed.length;
      const totalMinutes = completedCount > 0
        ? completed.reduce((sum, a) => {
            const te = totalSeconds; // approximate
            return sum + te;
          }, 0) / completedCount / 60
        : 0;

      result.push({
        editorId: editor.id,
        editorName: editor.name,
        completedAssignments: completedCount,
        avgEditingMinutes: Math.round(totalMinutes),
        revisionRate: assignments.length > 0 ? (revisions.length / assignments.length) * 100 : 0,
        totalTrackedHours: totalSeconds / 3600,
      });
    }

    return NextResponse.json({ editors: result });
  } catch (error) {
    console.error("Assignment stats error:", error);
    return NextResponse.json({ error: "Failed to fetch assignment stats" }, { status: 500 });
  }
}
