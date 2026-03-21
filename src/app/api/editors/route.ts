import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, gte, lte, sql, isNotNull } from "drizzle-orm";

interface BonusTier {
  minSpend: number;
  minRoas: number;
  bonus: number;
}

const BONUS_TIERS: BonusTier[] = [
  { minSpend: 7500, minRoas: 2.0, bonus: 50 },
  { minSpend: 3750, minRoas: 2.0, bonus: 30 },
  { minSpend: 1000, minRoas: 2.5, bonus: 20 },
  { minSpend: 500, minRoas: 2.5, bonus: 10 },
];

function calculateBonus(spend: number, roas: number): { bonus: number; tier: string | null } {
  for (const t of BONUS_TIERS) {
    if (spend >= t.minSpend && roas >= t.minRoas) {
      return { bonus: t.bonus, tier: `$${t.bonus} ($${t.minSpend}+ spend, ${t.minRoas}+ ROAS)` };
    }
  }
  return { bonus: 0, tier: null };
}

/** Fallback: Parse editor name from ad name. Convention: "SE EditorName ..." */
function parseEditor(adName: string): string | null {
  const match = adName.match(/^[A-Z]{2}\s+(\S+)/i);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

    // Get all editors
    const allEditors = await db.select().from(schema.users).where(eq(schema.users.role, "editor"));
    const editorMap = new Map(allEditors.map((e) => [e.id, e]));

    // Get published assignments (those with metaAdId)
    const publishedAssignments = await db
      .select()
      .from(schema.assignments)
      .where(isNotNull(schema.assignments.metaAdId));

    // Build a map: metaAdId -> editorId (assignedToId)
    const adToEditorMap = new Map<string, string>();
    const adToAssignmentMap = new Map<string, typeof publishedAssignments[0]>();
    for (const a of publishedAssignments) {
      if (a.metaAdId) {
        adToEditorMap.set(a.metaAdId, a.assignedToId);
        adToAssignmentMap.set(a.metaAdId, a);
      }
    }

    // Get ad-level insights
    const adInsights = await db
      .select({
        entityId: schema.insights.entityId,
        spend: sql<number>`sum(${schema.insights.spend})`,
        impressions: sql<number>`sum(${schema.insights.impressions})`,
        reach: sql<number>`sum(${schema.insights.reach})`,
        linkClicks: sql<number>`sum(${schema.insights.linkClicks})`,
        purchases: sql<number>`sum(${schema.insights.purchases})`,
        purchaseValue: sql<number>`sum(${schema.insights.purchaseValue})`,
        videoViews3s: sql<number>`sum(${schema.insights.videoViews3s})`,
      })
      .from(schema.insights)
      .where(
        and(
          eq(schema.insights.entityType, "ad"),
          gte(schema.insights.dateStart, from),
          lte(schema.insights.dateStop, to)
        )
      )
      .groupBy(schema.insights.entityId);

    // Get ad metadata for names
    const adsData = await db.select().from(schema.adsCache);
    const adCacheMap = new Map(adsData.map((a) => [a.id, a]));

    // Group by editor
    const editorDataMap = new Map<string, {
      editorId: string;
      editorName: string;
      ads: Array<{
        id: string;
        name: string;
        assignmentId: string | null;
        spend: number;
        impressions: number;
        linkClicks: number;
        purchases: number;
        purchaseValue: number;
        roas: number;
        ctr: number;
        hookRate: number;
        bonus: number;
        bonusTier: string | null;
      }>;
      totalSpend: number;
      totalImpressions: number;
      totalLinkClicks: number;
      totalPurchases: number;
      totalPurchaseValue: number;
    }>();

    for (const row of adInsights) {
      const adCache = adCacheMap.get(row.entityId);
      const adName = adCache?.name || row.entityId;

      // Primary: look up editor via assignment linkage
      let editorId = adToEditorMap.get(row.entityId);
      let editorName: string | null = null;
      let assignmentId: string | null = null;

      if (editorId) {
        const editor = editorMap.get(editorId);
        editorName = editor?.name?.split(" ")[0] || "Unknown";
        assignmentId = adToAssignmentMap.get(row.entityId)?.id || null;
      } else {
        // Fallback: parse from ad name convention
        editorName = parseEditor(adName);
        if (!editorName) continue;
        // Try to find matching editor in DB
        const matchingEditor = allEditors.find((e) =>
          e.name.toLowerCase().startsWith(editorName!.toLowerCase())
        );
        editorId = matchingEditor?.id || `name:${editorName}`;
      }

      const spend = row.spend || 0;
      const impressions = row.impressions || 0;
      const linkClicks = row.linkClicks || 0;
      const purchases = row.purchases || 0;
      const purchaseValue = row.purchaseValue || 0;
      const videoViews3s = row.videoViews3s || 0;
      const roas = spend > 0 ? purchaseValue / spend : 0;
      const ctr = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
      const hookRate = impressions > 0 ? (videoViews3s / impressions) * 100 : 0;
      const { bonus, tier: bonusTier } = calculateBonus(spend, roas);

      if (!editorDataMap.has(editorId)) {
        editorDataMap.set(editorId, {
          editorId,
          editorName: editorName!,
          ads: [],
          totalSpend: 0,
          totalImpressions: 0,
          totalLinkClicks: 0,
          totalPurchases: 0,
          totalPurchaseValue: 0,
        });
      }

      const entry = editorDataMap.get(editorId)!;
      entry.ads.push({
        id: row.entityId,
        name: adName,
        assignmentId,
        spend,
        impressions,
        linkClicks,
        purchases,
        purchaseValue,
        roas,
        ctr,
        hookRate,
        bonus,
        bonusTier,
      });
      entry.totalSpend += spend;
      entry.totalImpressions += impressions;
      entry.totalLinkClicks += linkClicks;
      entry.totalPurchases += purchases;
      entry.totalPurchaseValue += purchaseValue;
    }

    // Get existing payouts for this period
    const existingPayouts = await db
      .select()
      .from(schema.editorPayouts)
      .where(
        and(
          gte(schema.editorPayouts.periodFrom, from),
          lte(schema.editorPayouts.periodTo, to)
        )
      );

    const payoutsByEditor = new Map<string, typeof existingPayouts>();
    for (const p of existingPayouts) {
      if (!payoutsByEditor.has(p.editorId)) payoutsByEditor.set(p.editorId, []);
      payoutsByEditor.get(p.editorId)!.push(p);
    }

    // Build response
    const editors = Array.from(editorDataMap.values()).map((e) => {
      const roas = e.totalSpend > 0 ? e.totalPurchaseValue / e.totalSpend : 0;
      const ctr = e.totalImpressions > 0 ? (e.totalLinkClicks / e.totalImpressions) * 100 : 0;
      const totalBonus = e.ads.reduce((sum, a) => sum + a.bonus, 0);
      e.ads.sort((a, b) => b.spend - a.spend);

      const payouts = payoutsByEditor.get(e.editorId) || [];
      const paidAmount = payouts
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0);
      const pendingAmount = payouts
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        editorId: e.editorId,
        editor: e.editorName,
        totalSpend: e.totalSpend,
        totalPurchaseValue: e.totalPurchaseValue,
        totalPurchases: e.totalPurchases,
        totalImpressions: e.totalImpressions,
        roas,
        ctr,
        totalBonus,
        paidAmount,
        pendingAmount,
        unpaidAmount: totalBonus - paidAmount - pendingAmount,
        adCount: e.ads.length,
        ads: e.ads,
        payouts,
      };
    });

    editors.sort((a, b) => b.totalSpend - a.totalSpend);

    return NextResponse.json({
      editors,
      bonusTiers: BONUS_TIERS,
      dateRange: { from, to },
    });
  } catch (error) {
    console.error("Editors API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch editor data" },
      { status: 500 }
    );
  }
}
