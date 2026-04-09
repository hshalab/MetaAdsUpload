import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { and, desc, gte, lte, isNotNull, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions = [isNotNull(schema.adClassifications.actionTaken)];

    if (from) {
      conditions.push(gte(schema.adClassifications.actionTakenAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(schema.adClassifications.actionTakenAt, new Date(to + "T23:59:59")));
    }

    const [entries, countResult] = await Promise.all([
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
          adName: schema.adsCache.name,
          adsetName: schema.adsetsCache.name,
        })
        .from(schema.adClassifications)
        .leftJoin(schema.adsCache, sql`${schema.adClassifications.adId} = ${schema.adsCache.id}`)
        .leftJoin(schema.adsetsCache, sql`${schema.adClassifications.adsetId} = ${schema.adsetsCache.id}`)
        .where(and(...conditions))
        .orderBy(desc(schema.adClassifications.actionTakenAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.adClassifications)
        .where(and(...conditions)),
    ]);

    return NextResponse.json({
      entries,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Strategy log GET error:", error);
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
  }
}
