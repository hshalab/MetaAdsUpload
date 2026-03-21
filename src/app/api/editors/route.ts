import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

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

/** Parse editor name from ad name. Convention: "SE EditorName ..." */
function parseEditor(adName: string): string | null {
  const match = adName.match(/^SE\s+(\S+)/i);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  try {
    // C2: Auth check
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

    // Get ad-level insights with ad metadata
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
    const adMap = new Map(adsData.map((a) => [a.id, a]));

    // Group by editor
    const editorMap = new Map<string, {
      editor: string;
      ads: Array<{
        id: string;
        name: string;
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
      const ad = adMap.get(row.entityId);
      const adName = ad?.name || row.entityId;
      const editor = parseEditor(adName);
      if (!editor) continue;

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

      if (!editorMap.has(editor)) {
        editorMap.set(editor, {
          editor,
          ads: [],
          totalSpend: 0,
          totalImpressions: 0,
          totalLinkClicks: 0,
          totalPurchases: 0,
          totalPurchaseValue: 0,
        });
      }

      const entry = editorMap.get(editor)!;
      entry.ads.push({
        id: row.entityId,
        name: adName,
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

    // Build response
    const editors = Array.from(editorMap.values()).map((e) => {
      const roas = e.totalSpend > 0 ? e.totalPurchaseValue / e.totalSpend : 0;
      const ctr = e.totalImpressions > 0 ? (e.totalLinkClicks / e.totalImpressions) * 100 : 0;
      const totalBonus = e.ads.reduce((sum, a) => sum + a.bonus, 0);

      // Sort ads by spend descending
      e.ads.sort((a, b) => b.spend - a.spend);

      return {
        editor: e.editor,
        totalSpend: e.totalSpend,
        totalPurchaseValue: e.totalPurchaseValue,
        totalPurchases: e.totalPurchases,
        totalImpressions: e.totalImpressions,
        roas,
        ctr,
        totalBonus,
        adCount: e.ads.length,
        ads: e.ads,
      };
    });

    // Sort editors by total spend descending
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
