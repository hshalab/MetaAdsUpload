import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { and, isNull, inArray, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await db
      .select({
        id: schema.creativeRoadmap.id,
        conceptName: schema.creativeRoadmap.conceptName,
        batchNumber: schema.creativeRoadmap.batchNumber,
        status: schema.creativeRoadmap.status,
        upvotes: schema.creativeRoadmap.upvotes,
      })
      .from(schema.creativeRoadmap)
      .where(
        and(
          inArray(schema.creativeRoadmap.status, ["ideation", "in_production"]),
          isNull(schema.creativeRoadmap.metaAdId)
        )
      )
      .orderBy(desc(schema.creativeRoadmap.upvotes), desc(schema.creativeRoadmap.createdAt));

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Roadmap linkable GET error:", error);
    return NextResponse.json({ error: "Failed to fetch linkable concepts" }, { status: 500 });
  }
}
