import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { getAdSets, updateAdSet } from "@/lib/meta/adsets";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS } from "@/lib/meta/insights";
import { getEvolveSettings } from "@/lib/evolve/settings";
import { evaluateScalingProtocol } from "@/lib/evolve/scaling-protocol";
import { evaluateSurfScaling } from "@/lib/evolve/surf-scaling";
import { metaApi } from "@/lib/meta/client";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getEvolveSettings();
    const since = format(subDays(new Date(), 7), "yyyy-MM-dd");
    const until = format(new Date(), "yyyy-MM-dd");

    const [adsets, insightsData] = await Promise.all([
      getAdSets(undefined, 500),
      getInsights({ level: "adset", dateRange: { since, until }, limit: 500 }),
    ]);

    // Build insights map
    const insightsMap = new Map<string, { spend: number; roas: number; purchases: number; purchaseValue: number }>();
    for (const insight of insightsData) {
      if (!insight.adset_id) continue;
      const spend = parseFloat(insight.spend || "0");
      const purchases = extractPurchases(insight.actions);
      const purchaseValue = extractPurchaseValue(insight.action_values);
      insightsMap.set(insight.adset_id, {
        spend,
        roas: calculateROAS(purchaseValue, spend),
        purchases,
        purchaseValue,
      });
    }

    const results: Array<{ adsetId: string; name: string; action: string; executed: boolean }> = [];

    for (const adset of adsets.filter((a) => a.status === "ACTIVE")) {
      const metrics = insightsMap.get(adset.id);
      if (!metrics || metrics.spend === 0) continue;

      const dailyBudget = adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : 0;

      // Get or create protocol log entry
      const existingLogs = await db
        .select()
        .from(schema.scalingProtocolLog)
        .where(
          and(
            eq(schema.scalingProtocolLog.entityId, adset.id),
            eq(schema.scalingProtocolLog.entityType, "adset")
          )
        )
        .limit(1);

      const log = existingLogs[0];
      const daysAbove = log?.consecutiveDaysAboveTarget ?? 0;
      const daysBelow = log?.consecutiveDaysBelowBreakeven ?? 0;

      let actionLabel: string;
      let newDaysAbove = daysAbove;
      let newDaysBelow = daysBelow;
      let newDaysBelowTarget = 0;
      let newStatus: string;

      if (settings.surfModeEnabled) {
        // Surf mode
        const decision = evaluateSurfScaling({ roas: metrics.roas, spend: metrics.spend, dailyBudget }, settings);
        actionLabel = decision.reason;
        newStatus = "monitoring";

        // Note: actual budget execution is logged but not auto-executed in v1
        results.push({ adsetId: adset.id, name: adset.name, action: decision.reason, executed: false });
      } else {
        // Normal protocol
        // Update consecutive day counters
        if (metrics.roas >= settings.targetRoas) {
          newDaysAbove = daysAbove + 1;
          newDaysBelow = 0;
          newDaysBelowTarget = 0;
        } else if (metrics.roas < settings.breakevenRoas) {
          newDaysBelow = daysBelow + 1;
          newDaysAbove = 0;
          newDaysBelowTarget = 0;
        } else {
          // Between breakeven and target
          newDaysBelowTarget += 1;
          newDaysAbove = 0;
          newDaysBelow = 0;
        }

        const decision = evaluateScalingProtocol(
          {
            roas: metrics.roas,
            spend: metrics.spend,
            dailyBudget,
            consecutiveDaysAboveTarget: newDaysAbove,
            consecutiveDaysBelowBreakeven: newDaysBelow,
            consecutiveDaysBelowTarget: newDaysBelowTarget,
          },
          settings
        );

        actionLabel = decision.reason;
        newStatus = decision.newStatus;
        results.push({ adsetId: adset.id, name: adset.name, action: decision.reason, executed: false });
      }

      // Upsert protocol log
      if (log) {
        await db
          .update(schema.scalingProtocolLog)
          .set({
            status: newStatus,
            consecutiveDaysAboveTarget: newDaysAbove,
            consecutiveDaysBelowBreakeven: newDaysBelow,
            lastAction: actionLabel,
            lastActionAt: new Date(),
          })
          .where(eq(schema.scalingProtocolLog.id, log.id));
      } else {
        await db.insert(schema.scalingProtocolLog).values({
          entityId: adset.id,
          entityType: "adset",
          status: newStatus,
          consecutiveDaysAboveTarget: newDaysAbove,
          consecutiveDaysBelowBreakeven: newDaysBelow,
          lastAction: actionLabel,
          lastActionAt: new Date(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode: settings.surfModeEnabled ? "surf" : "normal",
      evaluated: results.length,
      results,
    });
  } catch (error) {
    console.error("Evolve scaling cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 }
    );
  }
}
