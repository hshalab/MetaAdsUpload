import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const desireId = searchParams.get("desireId");

    const conditions = [];
    if (status) conditions.push(eq(schema.creativeRoadmap.status, status));
    if (desireId) conditions.push(eq(schema.creativeRoadmap.desireId, desireId));

    const entries = await db
      .select()
      .from(schema.creativeRoadmap)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.creativeRoadmap.createdAt));

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Roadmap GET error:", error);
    return NextResponse.json({ error: "Failed to fetch roadmap" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const [result] = await db.insert(schema.creativeRoadmap).values({
      conceptName: body.conceptName,
      batchNumber: body.batchNumber || null,
      authorId: body.authorId || session.user.id,
      desireId: body.desireId || null,
      subAvatarId: body.subAvatarId || null,
      angleId: body.angleId || null,
      awarenessLevel: body.awarenessLevel || null,
      fileType: body.fileType || null,
      status: body.status || "ideation",
      hypothesis: body.hypothesis || null,
      variableTested: body.variableTested || null,
      metaAdId: body.metaAdId || null,
      assignmentId: body.assignmentId || null,
    }).returning();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Roadmap POST error:", error);
    return NextResponse.json({ error: "Failed to create concept" }, { status: 500 });
  }
}
