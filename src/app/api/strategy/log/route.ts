import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { and, desc, gte, lte, eq, isNotNull, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const action = searchParams.get("action");
    const classification = searchParams.get("classification");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions = [isNotNull(schema.adClassifications.actionTaken)];

    if (from) {
      conditions.push(gte(schema.adClassifications.actionTakenAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(schema.adClassifications.actionTakenAt, new Date(to + "T23:59:59")));
    }
    if (action) {
      conditions.push(eq(schema.adClassifications.actionTaken, action));
    }
    if (classification) {
      conditions.push(eq(schema.adClassifications.classification, classification));
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [entries, countResult, summaryResult] = await Promise.all([
      db
        .select({
          id: schema.adClassifications.id,
          adId: schema.adClassifications.adId,
          classification: schema.adClassifications.classification,
          actionTaken: schema.adClassifications.actionTaken,
          actionTakenAt: schema.adClassifications.actionTakenAt,
          spend: schema.adClassifications.spend,
          roas: schema.adClassifications.roas,
          cpa: schema.adClassifications.cpa,
          adsetId: schema.adClassifications.adsetId,
          campaignId: schema.adClassifications.campaignId,
          recommendation: schema.adClassifications.recommendation,
          adName: schema.adsCache.name,
          adsetName: sql<string>`COALESCE(
            (SELECT name FROM adsets_cache WHERE id = ${schema.adClassifications.adsetId}),
            (SELECT name FROM adsets_cache WHERE id = ${schema.adClassifications.adId})
          )`,
        })
        .from(schema.adClassifications)
        .leftJoin(schema.adsCache, sql`${schema.adClassifications.adId} = ${schema.adsCache.id}`)
        .where(and(...conditions))
        .orderBy(desc(schema.adClassifications.actionTakenAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.adClassifications)
        .where(and(...conditions)),
      db
        .select({
          pausedThisWeek: sql<number>`count(*) filter (where ${schema.adClassifications.actionTaken} = 'pause' and ${schema.adClassifications.actionTakenAt} >= ${sevenDaysAgo})`,
          graveyardThisWeek: sql<number>`count(*) filter (where ${schema.adClassifications.actionTaken} = 'move_zombie' and ${schema.adClassifications.actionTakenAt} >= ${sevenDaysAgo})`,
          breakthroughsThisWeek: sql<number>`count(*) filter (where ${schema.adClassifications.classification} = 'breakthrough' and ${schema.adClassifications.actionTakenAt} >= ${sevenDaysAgo})`,
        })
        .from(schema.adClassifications)
        .where(isNotNull(schema.adClassifications.actionTaken)),
    ]);

    return NextResponse.json({
      entries,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset,
      summary: {
        pausedThisWeek: Number(summaryResult[0]?.pausedThisWeek || 0),
        graveyardThisWeek: Number(summaryResult[0]?.graveyardThisWeek || 0),
        breakthroughsThisWeek: Number(summaryResult[0]?.breakthroughsThisWeek || 0),
      },
    });
  } catch (error) {
    console.error("Strategy log GET error:", error);
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
  }
}
