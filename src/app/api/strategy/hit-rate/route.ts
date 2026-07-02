import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { sql, gte, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "3");
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    // Get latest classification per unique adId
    const latestPerAd = await db.execute(sql`
      SELECT DISTINCT ON (ad_id)
        ad_id,
        classification,
        spend,
        roas,
        cpa,
        classified_at
      FROM ad_classifications
      WHERE classified_at >= ${since}
      ORDER BY ad_id, classified_at DESC
    `);

    const rows = latestPerAd.rows as Array<{
      ad_id: string;
      classification: string;
      spend: number;
      roas: number;
      cpa: number;
      classified_at: string;
    }>;

    const totalTested = rows.length;
    const breakthroughs = rows.filter((r) => r.classification === "breakthrough").length;
    const hitRate = totalTested > 0 ? (breakthroughs / totalTested) * 100 : 0;

    // This month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonthRows = rows.filter((r) => new Date(r.classified_at) >= monthStart);
    const thisMonthTested = thisMonthRows.length;
    const thisMonthBreakthroughs = thisMonthRows.filter((r) => r.classification === "breakthrough").length;

    // Weekly trend
    const weeklyMap = new Map<string, { tested: number; breakthroughs: number }>();
    for (const row of rows) {
      const d = new Date(row.classified_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
      const key = weekStart.toISOString().slice(0, 10);
      const entry = weeklyMap.get(key) || { tested: 0, breakthroughs: 0 };
      entry.tested++;
      if (row.classification === "breakthrough") entry.breakthroughs++;
      weeklyMap.set(key, entry);
    }
    const weeklyTrend = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        week,
        tested: data.tested,
        breakthroughs: data.breakthroughs,
        hitRate: data.tested > 0 ? (data.breakthroughs / data.tested) * 100 : 0,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Per author (from creative_roadmap)
    const roadmapEntries = await db
      .select({
        authorId: schema.creativeRoadmap.authorId,
        authorName: schema.users.name,
        lastClassification: schema.creativeRoadmap.lastClassification,
      })
      .from(schema.creativeRoadmap)
      .leftJoin(schema.users, sql`${schema.creativeRoadmap.authorId} = ${schema.users.id}`)
      .where(gte(schema.creativeRoadmap.createdAt, since));

    const authorMap = new Map<string, { name: string; tested: number; breakthroughs: number }>();
    for (const r of roadmapEntries) {
      if (!r.authorId) continue;
      const entry = authorMap.get(r.authorId) || { name: r.authorName || "Unknown", tested: 0, breakthroughs: 0 };
      entry.tested++;
      if (r.lastClassification === "breakthrough") entry.breakthroughs++;
      authorMap.set(r.authorId, entry);
    }
    const perAuthor = Array.from(authorMap.values())
      .map((a) => ({ ...a, hitRate: a.tested > 0 ? (a.breakthroughs / a.tested) * 100 : 0 }))
      .sort((a, b) => b.hitRate - a.hitRate);

    // Per desire (from creative_roadmap)
    const desireEntries = await db
      .select({
        desireId: schema.creativeRoadmap.desireId,
        desireName: schema.strategyDesires.name,
        lastClassification: schema.creativeRoadmap.lastClassification,
      })
      .from(schema.creativeRoadmap)
      .leftJoin(schema.strategyDesires, sql`${schema.creativeRoadmap.desireId} = ${schema.strategyDesires.id}`)
      .where(gte(schema.creativeRoadmap.createdAt, since));

    const desireMap = new Map<string, { name: string; tested: number; breakthroughs: number }>();
    for (const r of desireEntries) {
      if (!r.desireId) continue;
      const entry = desireMap.get(r.desireId) || { name: r.desireName || "Unknown", tested: 0, breakthroughs: 0 };
      entry.tested++;
      if (r.lastClassification === "breakthrough") entry.breakthroughs++;
      desireMap.set(r.desireId, entry);
    }
    const perDesire = Array.from(desireMap.values())
      .map((d) => ({ ...d, hitRate: d.tested > 0 ? (d.breakthroughs / d.tested) * 100 : 0 }))
      .sort((a, b) => b.hitRate - a.hitRate);

    // Trend arrow: compare last 2 weeks
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const lastWeekRows = rows.filter((r) => new Date(r.classified_at) >= oneWeekAgo);
    const prevWeekRows = rows.filter((r) => {
      const d = new Date(r.classified_at);
      return d >= twoWeeksAgo && d < oneWeekAgo;
    });

    const lastWeekRate = lastWeekRows.length > 0
      ? (lastWeekRows.filter((r) => r.classification === "breakthrough").length / lastWeekRows.length) * 100
      : 0;
    const prevWeekRate = prevWeekRows.length > 0
      ? (prevWeekRows.filter((r) => r.classification === "breakthrough").length / prevWeekRows.length) * 100
      : 0;
    const trendDelta = lastWeekRate - prevWeekRate;

    // Breakthrough details for drill-down
    const breakthroughList = rows
      .filter((r) => r.classification === "breakthrough")
      .map((r) => ({
        adId: r.ad_id,
        spend: r.spend,
        roas: r.roas,
      }))
      .sort((a, b) => (b.roas || 0) - (a.roas || 0));

    return NextResponse.json({
      totalTested,
      breakthroughs,
      hitRate,
      thisMonth: { tested: thisMonthTested, breakthroughs: thisMonthBreakthroughs },
      weeklyTrend,
      perAuthor,
      perDesire,
      trendDelta,
      breakthroughList,
    });
  } catch (error) {
    console.error("Hit rate GET error:", error);
    return NextResponse.json({ error: "Failed to calculate hit rate" }, { status: 500 });
  }
}
