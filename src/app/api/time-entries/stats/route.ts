import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, gte, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const period = request.nextUrl.searchParams.get("period") || "30d";

    // Calculate start date based on period
    let startDate: Date;
    const now = new Date();
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "all":
        startDate = new Date(2020, 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get completed time entries in period
    const entries = await db
      .select({
        id: schema.timeEntries.id,
        taskType: schema.timeEntries.taskType,
        durationSeconds: schema.timeEntries.durationSeconds,
        videoOutputSeconds: schema.timeEntries.videoOutputSeconds,
        startTime: schema.timeEntries.startTime,
        assignmentId: schema.timeEntries.assignmentId,
      })
      .from(schema.timeEntries)
      .where(
        and(
          eq(schema.timeEntries.userId, userId),
          eq(schema.timeEntries.status, "completed"),
          gte(schema.timeEntries.startTime, startDate)
        )
      );

    // Get assignments with videoLengthSeconds for this user
    const assignments = await db
      .select({
        id: schema.assignments.id,
        videoLengthSeconds: schema.assignments.videoLengthSeconds,
        status: schema.assignments.status,
      })
      .from(schema.assignments)
      .where(eq(schema.assignments.assignedToId, userId));

    const assignmentMap = new Map(assignments.map((a) => [a.id, a]));

    // Calculate totals
    let totalTrackedSeconds = 0;
    let totalOutputSeconds = 0;
    let videosCompleted = 0;
    const dailyMap = new Map<string, { trackedSeconds: number; videosCompleted: number; outputSeconds: number }>();
    const taskTypeMap = new Map<string, number>();
    const countedAssignments = new Set<string>();

    for (const entry of entries) {
      const duration = entry.durationSeconds || 0;
      totalTrackedSeconds += duration;

      // Daily breakdown
      const dateKey = new Date(entry.startTime).toISOString().split("T")[0];
      const daily = dailyMap.get(dateKey) || { trackedSeconds: 0, videosCompleted: 0, outputSeconds: 0 };
      daily.trackedSeconds += duration;

      // Count video output from assignment's videoLengthSeconds
      if (entry.assignmentId && !countedAssignments.has(entry.assignmentId)) {
        const assignment = assignmentMap.get(entry.assignmentId);
        if (assignment?.videoLengthSeconds) {
          totalOutputSeconds += assignment.videoLengthSeconds;
          videosCompleted++;
          daily.videosCompleted++;
          daily.outputSeconds += assignment.videoLengthSeconds;
          countedAssignments.add(entry.assignmentId);
        }
      }

      // Also count videoOutputSeconds from time entries (for standalone timer sessions)
      if (!entry.assignmentId && entry.videoOutputSeconds) {
        totalOutputSeconds += entry.videoOutputSeconds;
        videosCompleted++;
        daily.videosCompleted++;
        daily.outputSeconds += entry.videoOutputSeconds;
      }

      dailyMap.set(dateKey, daily);

      // Task type breakdown
      const taskType = entry.taskType || "other";
      taskTypeMap.set(taskType, (taskTypeMap.get(taskType) || 0) + duration);
    }

    // Build daily breakdown sorted by date
    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build task type breakdown
    const taskTypeBreakdown = Array.from(taskTypeMap.entries())
      .map(([taskType, totalSeconds]) => ({ taskType, totalSeconds }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    // Count total assigned in period
    const totalAssigned = assignments.length;

    return NextResponse.json({
      totalTrackedSeconds,
      totalVideosCompleted: videosCompleted,
      totalOutputSeconds,
      avgVideoLengthSeconds: videosCompleted > 0 ? Math.round(totalOutputSeconds / videosCompleted) : 0,
      totalAssigned,
      dailyBreakdown,
      taskTypeBreakdown,
      period,
    });
  } catch (error) {
    console.error("Time entries stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
