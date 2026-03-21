import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const { searchParams } = request.nextUrl;
    const assignmentId = searchParams.get("assignmentId");

    const conditions = [];

    // Non-admins can only see their own
    if (userRole !== "admin") {
      conditions.push(eq(schema.timeEntries.userId, userId));
    }

    if (assignmentId) {
      conditions.push(eq(schema.timeEntries.assignmentId, assignmentId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const entries = await db
      .select()
      .from(schema.timeEntries)
      .where(whereClause)
      .orderBy(desc(schema.timeEntries.startTime));

    // Calculate summary
    const completedEntries = entries.filter(e => e.status === "completed");
    const totalSeconds = completedEntries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

    return NextResponse.json({
      entries,
      summary: {
        totalEntries: entries.length,
        completedEntries: completedEntries.length,
        totalSeconds,
        totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Time GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch time entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const body = await request.json();
    const { assignmentId, taskType, taskName, notes, startTime, endTime, durationSeconds, videoOutputSeconds } = body;

    if (!taskType || !taskName || !startTime || !endTime || durationSeconds === undefined) {
      return NextResponse.json(
        { error: "taskType, taskName, startTime, endTime, and durationSeconds are required" },
        { status: 400 }
      );
    }

    // H6: Time entry validation
    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);
    const now = new Date();

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: "Invalid startTime or endTime" }, { status: 400 });
    }

    if (parsedStart > now) {
      return NextResponse.json({ error: "startTime cannot be in the future" }, { status: 400 });
    }

    if (parsedEnd <= parsedStart) {
      return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
    }

    if (typeof durationSeconds !== "number" || durationSeconds <= 0) {
      return NextResponse.json({ error: "durationSeconds must be a positive number" }, { status: 400 });
    }

    if (durationSeconds > 86400) {
      return NextResponse.json({ error: "durationSeconds cannot exceed 86400 (24 hours)" }, { status: 400 });
    }

    // Check duration roughly matches (endTime - startTime) within 60 seconds tolerance
    const computedDuration = (parsedEnd.getTime() - parsedStart.getTime()) / 1000;
    if (Math.abs(computedDuration - durationSeconds) > 60) {
      return NextResponse.json({ error: "durationSeconds does not match the difference between startTime and endTime (tolerance: 60s)" }, { status: 400 });
    }

    // Don't allow entries older than 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (parsedStart < sevenDaysAgo) {
      return NextResponse.json({ error: "Cannot create time entries older than 7 days" }, { status: 400 });
    }

    const [entry] = await db
      .insert(schema.timeEntries)
      .values({
        userId,
        assignmentId: assignmentId || null,
        taskType,
        taskName,
        notes: notes || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationSeconds,
        videoOutputSeconds: videoOutputSeconds || null,
        status: "completed",
      })
      .returning();

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Time POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save time entry" },
      { status: 500 }
    );
  }
}
