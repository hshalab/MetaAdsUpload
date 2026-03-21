import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

// GET /api/time-entries/[id] — get single time entry
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [entry] = await db
    .select()
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.id, id))
    .limit(1);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Editors can only see their own
  if (session.user.role === "editor" && entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(entry);
}

// PATCH /api/time-entries/[id] — stop timer or update entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [entry] = await db
    .select()
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.id, id))
    .limit(1);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only owner or admin can update
  if (session.user.role === "editor" && entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Stop the timer
  if (body.action === "stop" && entry.status === "in_progress") {
    const endTime = new Date();
    const durationSeconds = Math.round((endTime.getTime() - entry.startTime.getTime()) / 1000);
    updates.endTime = endTime;
    updates.durationSeconds = durationSeconds;
    updates.status = "completed";
  }

  // Allow updating notes and videoOutputSeconds
  if (body.notes !== undefined) updates.notes = body.notes?.slice(0, 1000) || null;
  if (body.videoOutputSeconds !== undefined) updates.videoOutputSeconds = body.videoOutputSeconds;
  if (body.taskName !== undefined) updates.taskName = body.taskName.slice(0, 200);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(schema.timeEntries)
    .set(updates)
    .where(eq(schema.timeEntries.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/time-entries/[id] — delete a time entry (admin only, or owner if in_progress)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [entry] = await db
    .select()
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.id, id))
    .limit(1);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Editors can only delete their own in-progress entries
  if (session.user.role === "editor") {
    if (entry.userId !== session.user.id || entry.status !== "in_progress") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, id));
  return NextResponse.json({ ok: true });
}
