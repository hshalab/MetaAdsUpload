import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql, eq, and, gte, inArray } from "drizzle-orm";
import { guardAdmin } from "@/lib/auth-helpers";

// ─── Editor Scorecard ────────────────────────────────────────────────────────
// "Put them to the test": output, speed, quality and honesty per editor for a
// selectable window. Powers /scorecards.

export interface EditorScorecard {
  userId: string;
  name: string;
  newVideos: number;          // v1 deliverable uploads in period
  revisions: number;          // v2+ uploads in period
  outputMinutes: number;      // sum of edited output length (from time entries)
  loggedHours: number;        // sum of tracked time
  minutesPerLoggedHour: number | null;
  avgTurnaroundHours: number | null; // assigned → completed
  onTimePct: number | null;   // completed before due date
  firstTryApprovalPct: number | null; // assignments done with exactly 1 version
  honestyFlags: {
    longSessions: number;     // single timer entries > 6h
    loggedButNoOutput: number; // 1h+ "new_video" entries with zero output length
  };
}

export async function GET(request: NextRequest) {
  const { error } = await guardAdmin();
  if (error) return error;

  try {
    const days = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get("days") || "7", 10) || 7, 1), 365);
    const since = new Date(Date.now() - days * 86400000);

    const editors = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(and(eq(schema.users.isActive, true), eq(schema.users.role, "editor")));
    if (editors.length === 0) return NextResponse.json({ days, scorecards: [] });
    const editorIds = editors.map((e) => e.id);

    // Deliverable versions in period (per uploader)
    const versionRows = await db
      .select({
        uploadedById: schema.deliverableVersions.uploadedById,
        isNew: sql<number>`sum(case when ${schema.deliverableVersions.versionNumber} = 1 then 1 else 0 end)`,
        isRevision: sql<number>`sum(case when ${schema.deliverableVersions.versionNumber} > 1 then 1 else 0 end)`,
      })
      .from(schema.deliverableVersions)
      .where(and(gte(schema.deliverableVersions.createdAt, since), inArray(schema.deliverableVersions.uploadedById, editorIds)))
      .groupBy(schema.deliverableVersions.uploadedById);
    const versionsByUser = new Map(versionRows.map((r) => [r.uploadedById, r]));

    // Time entries in period
    const timeRows = await db
      .select({
        userId: schema.timeEntries.userId,
        outputSeconds: sql<number>`coalesce(sum(${schema.timeEntries.videoOutputSeconds}), 0)`,
        loggedSeconds: sql<number>`coalesce(sum(${schema.timeEntries.durationSeconds}), 0)`,
        longSessions: sql<number>`sum(case when ${schema.timeEntries.durationSeconds} > 21600 then 1 else 0 end)`,
        loggedButNoOutput: sql<number>`sum(case when ${schema.timeEntries.taskType} = 'new_video' and ${schema.timeEntries.durationSeconds} > 3600 and coalesce(${schema.timeEntries.videoOutputSeconds}, 0) = 0 then 1 else 0 end)`,
      })
      .from(schema.timeEntries)
      .where(and(
        eq(schema.timeEntries.status, "completed"),
        gte(schema.timeEntries.startTime, since),
        inArray(schema.timeEntries.userId, editorIds),
      ))
      .groupBy(schema.timeEntries.userId);
    const timeByUser = new Map(timeRows.map((r) => [r.userId, r]));

    // Completed assignments in period (turnaround, on-time, first-try approval)
    const assignmentRows = await db
      .select({
        assignedToId: schema.assignments.assignedToId,
        completed: sql<number>`count(*)`,
        avgTurnaroundHours: sql<number>`avg(extract(epoch from (${schema.assignments.completedAt} - ${schema.assignments.createdAt})) / 3600)`,
        withDue: sql<number>`sum(case when ${schema.assignments.dueDate} is not null then 1 else 0 end)`,
        onTime: sql<number>`sum(case when ${schema.assignments.dueDate} is not null and ${schema.assignments.completedAt} <= ${schema.assignments.dueDate} then 1 else 0 end)`,
        firstTry: sql<number>`sum(case when (select count(*) from deliverable_versions dv where dv.assignment_id = ${schema.assignments.id}) = 1 then 1 else 0 end)`,
      })
      .from(schema.assignments)
      .where(and(
        gte(schema.assignments.completedAt, since),
        inArray(schema.assignments.assignedToId, editorIds),
      ))
      .groupBy(schema.assignments.assignedToId);
    const assignByUser = new Map(assignmentRows.map((r) => [r.assignedToId, r]));

    const scorecards: EditorScorecard[] = editors.map((e) => {
      const v = versionsByUser.get(e.id);
      const t = timeByUser.get(e.id);
      const a = assignByUser.get(e.id);
      const outputMinutes = Math.round(Number(t?.outputSeconds ?? 0) / 60);
      const loggedHours = Number(t?.loggedSeconds ?? 0) / 3600;
      const completed = Number(a?.completed ?? 0);
      const withDue = Number(a?.withDue ?? 0);
      return {
        userId: e.id,
        name: e.name,
        newVideos: Number(v?.isNew ?? 0),
        revisions: Number(v?.isRevision ?? 0),
        outputMinutes,
        loggedHours: Math.round(loggedHours * 10) / 10,
        minutesPerLoggedHour: loggedHours > 0 ? Math.round((outputMinutes / loggedHours) * 10) / 10 : null,
        avgTurnaroundHours: a?.avgTurnaroundHours != null ? Math.round(Number(a.avgTurnaroundHours) * 10) / 10 : null,
        onTimePct: withDue > 0 ? Math.round((Number(a?.onTime ?? 0) / withDue) * 100) : null,
        firstTryApprovalPct: completed > 0 ? Math.round((Number(a?.firstTry ?? 0) / completed) * 100) : null,
        honestyFlags: {
          longSessions: Number(t?.longSessions ?? 0),
          loggedButNoOutput: Number(t?.loggedButNoOutput ?? 0),
        },
      };
    });

    scorecards.sort((x, y) => y.outputMinutes - x.outputMinutes);
    return NextResponse.json({ days, scorecards });
  } catch (e) {
    console.error("Scorecard error:", e);
    return NextResponse.json({ error: "Failed to build scorecards" }, { status: 500 });
  }
}
