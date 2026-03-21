import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, desc, isNull } from "drizzle-orm";

// GET /api/time-entries — list time entries for current user (editors see own, admins see all)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const assignmentId = searchParams.get("assignmentId");
  const status = searchParams.get("status"); // "in_progress" | "completed"
  const userId = searchParams.get("userId");

  const conditions = [];

  // Editors can only see their own entries
  if (session.user.role === "editor") {
    conditions.push(eq(schema.timeEntries.userId, session.user.id));
  } else if (userId) {
    conditions.push(eq(schema.timeEntries.userId, userId));
  }

  if (assignmentId) {
    conditions.push(eq(schema.timeEntries.assignmentId, assignmentId));
  }
  if (status) {
    conditions.push(eq(schema.timeEntries.status, status));
  }

  const entries = await db
    .select()
    .from(schema.timeEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.timeEntries.startTime))
    .limit(200);

  return NextResponse.json(entries);
}

// POST /api/time-entries — start a new time entry
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { assignmentId, taskType, taskName, notes, videoOutputSeconds } = body;

  if (!taskType || !taskName) {
    return NextResponse.json({ error: "taskType and taskName are required" }, { status: 400 });
  }

  const validTaskTypes = ["new_video", "revision", "sourcing", "static_ad", "other"];
  if (!validTaskTypes.includes(taskType)) {
    return NextResponse.json({ error: `taskType must be one of: ${validTaskTypes.join(", ")}` }, { status: 400 });
  }

  // Check for already running timer
  const running = await db
    .select({ id: schema.timeEntries.id })
    .from(schema.timeEntries)
    .where(
      and(
        eq(schema.timeEntries.userId, session.user.id),
        eq(schema.timeEntries.status, "in_progress")
      )
    )
    .limit(1);

  if (running.length > 0) {
    return NextResponse.json(
      { error: "You already have a running timer. Stop it before starting a new one." },
      { status: 409 }
    );
  }

  const [entry] = await db
    .insert(schema.timeEntries)
    .values({
      userId: session.user.id,
      assignmentId: assignmentId || null,
      taskType,
      taskName: taskName.slice(0, 200),
      notes: notes?.slice(0, 1000) || null,
      startTime: new Date(),
      videoOutputSeconds: videoOutputSeconds || null,
      status: "in_progress",
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
