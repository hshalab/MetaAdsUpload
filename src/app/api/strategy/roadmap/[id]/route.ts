import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const [result] = await db.update(schema.creativeRoadmap)
      .set({
        ...(body.conceptName !== undefined && { conceptName: body.conceptName }),
        ...(body.batchNumber !== undefined && { batchNumber: body.batchNumber }),
        ...(body.authorId !== undefined && { authorId: body.authorId }),
        ...(body.desireId !== undefined && { desireId: body.desireId }),
        ...(body.subAvatarId !== undefined && { subAvatarId: body.subAvatarId }),
        ...(body.angleId !== undefined && { angleId: body.angleId }),
        ...(body.awarenessLevel !== undefined && { awarenessLevel: body.awarenessLevel }),
        ...(body.fileType !== undefined && { fileType: body.fileType }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.hypothesis !== undefined && { hypothesis: body.hypothesis }),
        ...(body.variableTested !== undefined && { variableTested: body.variableTested }),
        ...(body.whatHappened !== undefined && { whatHappened: body.whatHappened }),
        ...(body.whatWeLearned !== undefined && { whatWeLearned: body.whatWeLearned }),
        ...(body.metaAdId !== undefined && { metaAdId: body.metaAdId }),
        ...(body.assignmentId !== undefined && { assignmentId: body.assignmentId }),
        ...(body.adType !== undefined && { adType: body.adType }),
        ...(body.breakthroughMemo !== undefined && { breakthroughMemo: body.breakthroughMemo }),
        ...(body.linkToBrief !== undefined && { linkToBrief: body.linkToBrief }),
        ...(body.linkToAd !== undefined && { linkToAd: body.linkToAd }),
        updatedAt: new Date(),
      })
      .where(eq(schema.creativeRoadmap.id, id))
      .returning();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Roadmap PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action === "upvote") {
      const [result] = await db.update(schema.creativeRoadmap)
        .set({
          upvotes: sql`${schema.creativeRoadmap.upvotes} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.creativeRoadmap.id, id))
        .returning();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Roadmap PATCH error:", error);
    return NextResponse.json({ error: "Failed to patch" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(schema.creativeRoadmap).where(eq(schema.creativeRoadmap.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Roadmap DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
