import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { deliverableUrl, deliverableR2Key } = body;

    if (!deliverableUrl) {
      return NextResponse.json({ error: "deliverableUrl is required" }, { status: 400 });
    }

    const [assignment] = await db.select().from(schema.assignments).where(eq(schema.assignments.id, id));
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    // Editors can only update their own assignments; admins can update any
    if (session.user.role !== "admin" && assignment.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const [updated] = await db
      .update(schema.assignments)
      .set({
        deliverableUrl,
        deliverableR2Key: deliverableR2Key || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.assignments.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Save deliverable error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save deliverable" },
      { status: 500 }
    );
  }
}
