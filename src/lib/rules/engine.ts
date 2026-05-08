import { db, schema } from "@/db";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import { evaluateAllConditions } from "./conditions";
import { executeAction } from "./actions";

/**
 * Parse timeRange string (e.g., "7d", "14d", "30d") into a Date.
 * Defaults to 7 days if not parseable.
 */
function parseTimeRange(timeRange: string): Date {
  const match = timeRange.match(/^(\d+)d$/);
  const days = match ? parseInt(match[1], 10) : 7;
  return new Date(Date.now() - days * 86400000);
}

export async function runAllRules() {
  const rules = await db.select().from(schema.automationRules).where(eq(schema.automationRules.enabled, true));
  if (rules.length === 0) return [];

  const results: Array<{ ruleId: number; entityId: string; action: string }> = [];

  // Pre-load all entity tables once (instead of per-rule)
  const [allCampaigns, allAdsets, allAds] = await Promise.all([
    db.select().from(schema.campaignsCache),
    db.select().from(schema.adsetsCache),
    db.select().from(schema.adsCache),
  ]);

  const entityMap = {
    campaign: allCampaigns.map((c) => ({ id: c.id, daily_budget: c.dailyBudget })),
    adset: allAdsets.map((a) => ({ id: a.id, daily_budget: a.dailyBudget })),
    ad: allAds.map((a) => ({ id: a.id, daily_budget: null as number | null })),
  };

  // Collect all entity IDs and find the widest date range across all rules
  const allEntityIds = new Set<string>();
  let globalEarliestDate = new Date();

  for (const rule of rules) {
    const conditions = rule.conditions as Array<{ metric: string; operator: string; value: number; timeRange: string }>;
    const entities = entityMap[rule.level as keyof typeof entityMap] || [];
    for (const e of entities) allEntityIds.add(e.id);

    const timeRanges = conditions.map((c) => c.timeRange || "7d");
    for (const tr of timeRanges) {
      const d = parseTimeRange(tr);
      if (d < globalEarliestDate) globalEarliestDate = d;
    }
  }

  const globalDateFilter = globalEarliestDate.toISOString().split("T")[0];
  const entityIdArray = Array.from(allEntityIds);

  // Batch-load all insights for all entities in one query
  const allInsights = entityIdArray.length > 0
    ? await db.select().from(schema.insights).where(
        and(
          inArray(schema.insights.entityId, entityIdArray),
          gte(schema.insights.dateStart, globalDateFilter)
        )
      )
    : [];

  // Group insights by entity ID
  const insightsByEntity = new Map<string, typeof allInsights>();
  for (const row of allInsights) {
    const existing = insightsByEntity.get(row.entityId) || [];
    existing.push(row);
    insightsByEntity.set(row.entityId, existing);
  }

  // Batch-load all recent rule executions (for cooldown checks)
  const minCooldownDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // max 30 days back
  const allRecentExecs = await db.select().from(schema.ruleExecutions).where(
    gte(schema.ruleExecutions.executedAt, minCooldownDate)
  );

  // Index executions by ruleId+entityId
  const execIndex = new Map<string, Date>();
  for (const exec of allRecentExecs) {
    const key = `${exec.ruleId}:${exec.entityId}`;
    const existing = execIndex.get(key);
    if (!existing || exec.executedAt > existing) {
      execIndex.set(key, exec.executedAt);
    }
  }

  for (const rule of rules) {
    const conditions = rule.conditions as Array<{ metric: string; operator: string; value: number; timeRange: string }>;
    const action = rule.action as { type: string; value?: number };
    const entities = entityMap[rule.level as keyof typeof entityMap] || [];
    const cooldownMs = (rule.cooldownHours || 24) * 60 * 60 * 1000;
    const cooldownDate = new Date(Date.now() - cooldownMs);

    for (const entity of entities) {
      // Check cooldown from pre-loaded data
      const lastExec = execIndex.get(`${rule.id}:${entity.id}`);
      if (lastExec && lastExec >= cooldownDate) continue;

      // Get insights from pre-loaded data
      const insightRows = insightsByEntity.get(entity.id);
      if (!insightRows || insightRows.length === 0) continue;

      const metrics: Record<string, number> = {};
      let totalSpend = 0, totalPurchaseValue = 0, totalImpressions = 0;
      let totalLinkClicks = 0, totalPurchases = 0, totalVideoViews3s = 0;

      for (const row of insightRows) {
        totalSpend += row.spend || 0;
        totalPurchaseValue += row.purchaseValue || 0;
        totalImpressions += row.impressions || 0;
        totalLinkClicks += row.linkClicks || 0;
        totalPurchases += row.purchases || 0;
        totalVideoViews3s += row.videoViews3s || 0;
      }

      metrics.spend = totalSpend;
      metrics.roas = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
      metrics.ctr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
      metrics.cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
      metrics.purchases = totalPurchases;
      metrics.hook_rate = totalImpressions > 0 ? (totalVideoViews3s / totalImpressions) * 100 : 0;
      metrics.impressions = totalImpressions;

      const conditionsTyped = conditions.map((c) => ({
        ...c,
        operator: c.operator as ">" | "<" | ">=" | "<=" | "==" | "!=",
      }));

      if (evaluateAllConditions(conditionsTyped, metrics)) {
        const actionTyped = { type: action.type as "pause" | "activate" | "adjust_budget" | "alert" | "tag", value: action.value };
        const result = await executeAction(actionTyped, entity.id, rule.level as "campaign" | "adset" | "ad", entity.daily_budget || undefined);

        await db.insert(schema.ruleExecutions).values({
          ruleId: rule.id,
          entityId: entity.id,
          entityType: rule.level,
          actionTaken: result,
        });

        results.push({ ruleId: rule.id, entityId: entity.id, action: result });
      }
    }
  }

  return results;
}
