import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { getCampaigns } from "@/lib/meta/campaigns";
import { getAdSets } from "@/lib/meta/adsets";
import { getAds } from "@/lib/meta/ads";
import { getInsights, extractPurchases, extractPurchaseValue, calculateROAS } from "@/lib/meta/insights";
import { getEvolveSettings } from "@/lib/evolve/settings";
import {
  auditCampaignStructure,
  auditZombieCampaign,
  auditAdSetCount,
  auditFrequency,
  auditBudgetDistribution,
  type AuditFinding,
} from "@/lib/evolve/audit";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const settings = await getEvolveSettings();
    const since = format(subDays(new Date(), 7), "yyyy-MM-dd");
    const until = format(new Date(), "yyyy-MM-dd");

    // Fetch all data
    const [campaigns, adsets, ads, insightsData] = await Promise.all([
      getCampaigns(200),
      getAdSets(undefined, 500),
      getAds(undefined, 500),
      getInsights({
        level: "adset",
        dateRange: { since, until },
        limit: 500,
      }),
    ]);

    // Build adset metrics for frequency checks
    const adsetMetrics = insightsData
      .filter((i) => i.adset_id)
      .map((i) => {
        const spend = parseFloat(i.spend || "0");
        const impressions = parseInt(i.impressions || "0");
        const reach = parseInt(i.reach || "0");
        const purchases = extractPurchases(i.actions);
        const purchaseValue = extractPurchaseValue(i.action_values);
        return {
          adsetId: i.adset_id!,
          spend,
          roas: calculateROAS(purchaseValue, spend),
          impressions,
          reach,
          frequency: reach > 0 ? impressions / reach : 0,
        };
      });

    // Cast to audit types
    const campaignInfos = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      buying_type: c.buying_type,
      daily_budget: c.daily_budget,
    }));

    const adsetInfos = adsets.map((a) => ({
      id: a.id,
      name: a.name,
      campaign_id: a.campaign_id,
      status: a.status,
      daily_budget: a.daily_budget,
      bid_strategy: a.bid_strategy,
    }));

    const adInfos = ads.map((a) => ({
      id: a.id,
      adset_id: a.adset_id,
      campaign_id: a.campaign_id,
      name: a.name,
      status: a.status,
    }));

    // Run all audit checks
    const allFindings: AuditFinding[] = [
      ...auditCampaignStructure(campaignInfos, settings),
      ...auditZombieCampaign(campaignInfos, adsetInfos, adInfos, settings),
      ...auditAdSetCount(campaignInfos, adsetInfos, settings),
      ...auditFrequency(adsetMetrics, adsetInfos),
      ...auditBudgetDistribution(campaignInfos, adsetInfos),
    ];

    // Save to DB
    for (const finding of allFindings) {
      await db.insert(schema.auditResults).values({
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
        description: finding.description || null,
        entityId: finding.entityId || null,
        entityType: finding.entityType || null,
        details: finding.details || {},
      });
    }

    const counts = {
      pass: allFindings.filter((f) => f.severity === "pass").length,
      warning: allFindings.filter((f) => f.severity === "warning").length,
      fail: allFindings.filter((f) => f.severity === "fail").length,
    };

    return NextResponse.json({
      findings: allFindings,
      counts,
      auditedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Audit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audit failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get most recent audit timestamp
    const latestResults = await db
      .select()
      .from(schema.auditResults)
      .orderBy(desc(schema.auditResults.auditedAt))
      .limit(1);

    if (latestResults.length === 0) {
      return NextResponse.json({ findings: [], counts: { pass: 0, warning: 0, fail: 0 }, auditedAt: null });
    }

    const latestAuditTime = latestResults[0].auditedAt;

    // Get all findings from that audit batch (within 1 minute of the latest)
    const allResults = await db
      .select()
      .from(schema.auditResults)
      .orderBy(desc(schema.auditResults.auditedAt))
      .limit(100);

    // Group by audit time (within 60s = same batch)
    const batchCutoff = new Date(latestAuditTime.getTime() - 60000);
    const batchResults = allResults.filter((r) => r.auditedAt >= batchCutoff);

    const findings = batchResults.map((r) => ({
      category: r.category,
      severity: r.severity,
      title: r.title,
      description: r.description,
      entityId: r.entityId,
      entityType: r.entityType,
      details: r.details,
    }));

    const counts = {
      pass: findings.filter((f) => f.severity === "pass").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      fail: findings.filter((f) => f.severity === "fail").length,
    };

    return NextResponse.json({
      findings,
      counts,
      auditedAt: latestAuditTime.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch audit" },
      { status: 500 }
    );
  }
}
