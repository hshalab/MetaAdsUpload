import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { isNotNull, eq, desc } from "drizzle-orm";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all roadmap entries that have a metaAdId
    const roadmapEntries = await db
      .select()
      .from(schema.creativeRoadmap)
      .where(isNotNull(schema.creativeRoadmap.metaAdId));

    let synced = 0;

    for (const entry of roadmapEntries) {
      if (!entry.metaAdId) continue;

      // Get the latest classification for this ad
      const [latest] = await db
        .select()
        .from(schema.adClassifications)
        .where(eq(schema.adClassifications.adId, entry.metaAdId))
        .orderBy(desc(schema.adClassifications.classifiedAt))
        .limit(1);

      if (latest) {
        await db.update(schema.creativeRoadmap)
          .set({
            lastClassification: latest.classification,
            lastSpend: latest.spend,
            lastRoas: latest.roas,
            lastCpa: latest.cpa,
            // Auto-update status based on classification
            ...(latest.classification === "breakthrough" && entry.status !== "breakthrough" && { status: "breakthrough" }),
            ...(latest.classification === "loser" && entry.status !== "loser" && { status: "loser" }),
            ...(["spend_winner", "kpi_winner", "new"].includes(latest.classification) && entry.status === "uploaded" && { status: "learning" }),
            updatedAt: new Date(),
          })
          .where(eq(schema.creativeRoadmap.id, entry.id));

        synced++;
      }
    }

    return NextResponse.json({ synced, total: roadmapEntries.length });
  } catch (error) {
    console.error("Roadmap sync error:", error);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
