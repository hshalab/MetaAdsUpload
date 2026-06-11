// ─── Editor performance aggregation (server-only) ───────────────────────────
// The bonus UNIT is the AD SET. Each editor owns ad sets; the bonus is computed
// on the ad set's aggregate lifetime spend + blended ROAS (see bonus-ledger).
// Each ad set drills down into its individual ads. Money is shown in USD.

import { db, schema } from "@/db";
import { and, eq, gte, lte, sql, inArray } from "drizzle-orm";
import { slugify } from "./bonus";
import { resolveOwnedAdsets, recomputeAdsetBonuses } from "./bonus-ledger";
import { getEvolveSettings } from "./evolve/settings";

export interface EditorAdRow {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  hookRate: number;
  holdRate: number;
  cpc: number;
  cpm: number;
  angle: string | null;
  problem: string | null;
  templateName: string | null;
}

export interface EditorAdsetRow {
  adsetId: string;
  adsetName: string;
  campaignId: string | null;
  strategistName: string | null;
  spend: number;
  impressions: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  hookRate: number;
  holdRate: number;
  cpc: number;
  cpm: number;
  bonus: number;
  bonusTier: number;
  tierLog: Record<string, string>;
  paidForAdset: number;
  outstanding: number;
  lifetimeSpend: number;
  lifetimeRoas: number;
  isWinner: boolean;
  graveyardOutcome: string | null;
  adCount: number;
  ads: EditorAdRow[];
}

async function ensureSlugs(editorIds: string[], users: (typeof schema.users.$inferSelect)[]) {
  const taken = new Set(users.map((u) => u.slug).filter(Boolean) as string[]);
  for (const id of editorIds) {
    const u = users.find((x) => x.id === id);
    if (!u || u.slug) continue;
    const base = slugify(u.name) || `editor-${id.slice(0, 6)}`;
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) candidate = `${base}-${n++}`;
    taken.add(candidate);
    u.slug = candidate;
    try {
      await db.update(schema.users).set({ slug: candidate, updatedAt: new Date() }).where(eq(schema.users.id, id));
    } catch { /* unique-index race — ignore */ }
  }
}

export async function getEditorsOverview({ from, to }: { from: string; to: string }) {
  const allUsers = await db.select().from(schema.users);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const settings = await getEvolveSettings();
  const rate = settings.sekPerUsd > 0 ? settings.sekPerUsd : 10.5;

  const ownedAdsets = await resolveOwnedAdsets();
  const ledgerRows = await recomputeAdsetBonuses(ownedAdsets, rate, settings.bonusTiers);
  const ledgerByAdset = new Map(ledgerRows.map((r) => [r.adId, r]));
  const ownedAdsetIds = ownedAdsets.map((a) => a.adsetId);

  // Ads inside the owned ad sets.
  const adsInSets = ownedAdsetIds.length
    ? await db
        .select({ id: schema.adsCache.id, name: schema.adsCache.name, adsetId: schema.adsCache.adsetId })
        .from(schema.adsCache)
        .where(inArray(schema.adsCache.adsetId, ownedAdsetIds))
    : [];
  const adsByAdset = new Map<string, Array<{ id: string; name: string }>>();
  for (const a of adsInSets) {
    const list = adsByAdset.get(a.adsetId) || [];
    list.push({ id: a.id, name: a.name });
    adsByAdset.set(a.adsetId, list);
  }
  const allAdIds = adsInSets.map((a) => a.id);

  // Per-ad period insights.
  const periodAd = allAdIds.length
    ? await db
        .select({
          entityId: schema.insights.entityId,
          spend: sql<number>`coalesce(sum(${schema.insights.spend}),0)`,
          impressions: sql<number>`coalesce(sum(${schema.insights.impressions}),0)`,
          linkClicks: sql<number>`coalesce(sum(${schema.insights.linkClicks}),0)`,
          purchases: sql<number>`coalesce(sum(${schema.insights.purchases}),0)`,
          purchaseValue: sql<number>`coalesce(sum(${schema.insights.purchaseValue}),0)`,
          videoViews3s: sql<number>`coalesce(sum(${schema.insights.videoViews3s}),0)`,
          videoThruplays: sql<number>`coalesce(sum(${schema.insights.videoThruplays}),0)`,
        })
        .from(schema.insights)
        .where(and(eq(schema.insights.entityType, "ad"), inArray(schema.insights.entityId, allAdIds), gte(schema.insights.dateStart, from), lte(schema.insights.dateStop, to)))
        .groupBy(schema.insights.entityId)
    : [];
  const periodByAd = new Map(periodAd.map((r) => [r.entityId, r]));

  // Per-ad creative metadata (angle / problem / template) from ad_owners.
  const adMetaRows = allAdIds.length
    ? await db.select().from(schema.adOwners).where(inArray(schema.adOwners.adId, allAdIds))
    : [];
  const adMetaById = new Map(adMetaRows.map((r) => [r.adId, r]));

  const editorMap = new Map<string, { editorId: string; adsets: EditorAdsetRow[] }>();
  const strategistMap = new Map<string, { id: string; adsets: number; winners: number }>();
  const templateMap = new Map<number, { templateId: number; templateName: string; ads: number; winners: number; spend: number; revenue: number }>();
  const anglePerf = new Map<string, { name: string; ads: number; winners: number; spend: number; revenue: number }>();
  const problemPerf = new Map<string, { name: string; ads: number; winners: number; spend: number; revenue: number }>();

  for (const owned of ownedAdsets) {
    const ledger = ledgerByAdset.get(owned.adsetId);
    const adsList = adsByAdset.get(owned.adsetId) || [];

    let aggSpendSek = 0, aggImpr = 0, aggLink = 0, aggPurch = 0, aggPvSek = 0, aggV3 = 0, aggThru = 0;
    const ads: EditorAdRow[] = adsList.map((ad) => {
      const p = periodByAd.get(ad.id);
      const spendSek = Number(p?.spend) || 0;
      const impressions = Number(p?.impressions) || 0;
      const linkClicks = Number(p?.linkClicks) || 0;
      const purchases = Number(p?.purchases) || 0;
      const pvSek = Number(p?.purchaseValue) || 0;
      const v3 = Number(p?.videoViews3s) || 0;
      const thru = Number(p?.videoThruplays) || 0;
      aggSpendSek += spendSek; aggImpr += impressions; aggLink += linkClicks; aggPurch += purchases; aggPvSek += pvSek; aggV3 += v3; aggThru += thru;
      const meta = adMetaById.get(ad.id);
      // Ad-level tag wins; otherwise the ad inherits the ad set's tag.
      const effAngle = meta?.angle ?? owned.angle ?? null;
      const effProblem = meta?.problem ?? owned.problem ?? null;
      const spend = spendSek / rate;
      const isWinnerAdset = (ledger?.earnedBonus || 0) > 0;
      if (meta?.templateId) {
        const t = templateMap.get(meta.templateId) || { templateId: meta.templateId, templateName: meta.templateName || `Template ${meta.templateId}`, ads: 0, winners: 0, spend: 0, revenue: 0 };
        t.ads += 1; if (isWinnerAdset) t.winners += 1; t.spend += spend; t.revenue += pvSek / rate;
        templateMap.set(meta.templateId, t);
      }
      if (effAngle) {
        const g = anglePerf.get(effAngle) || { name: effAngle, ads: 0, winners: 0, spend: 0, revenue: 0 };
        g.ads += 1; if (isWinnerAdset) g.winners += 1; g.spend += spend; g.revenue += pvSek / rate;
        anglePerf.set(effAngle, g);
      }
      if (effProblem) {
        const g = problemPerf.get(effProblem) || { name: effProblem, ads: 0, winners: 0, spend: 0, revenue: 0 };
        g.ads += 1; if (isWinnerAdset) g.winners += 1; g.spend += spend; g.revenue += pvSek / rate;
        problemPerf.set(effProblem, g);
      }
      return {
        id: ad.id,
        name: ad.name,
        spend,
        impressions,
        purchases,
        purchaseValue: pvSek / rate,
        roas: spendSek > 0 ? pvSek / spendSek : 0,
        ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
        hookRate: impressions > 0 ? (v3 / impressions) * 100 : 0,
        holdRate: v3 > 0 ? (thru / v3) * 100 : 0,
        cpc: linkClicks > 0 ? spend / linkClicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        angle: effAngle,
        problem: effProblem,
        templateName: meta?.templateName ?? null,
      };
    });

    const bonus = ledger?.earnedBonus || 0;
    const isWinner = bonus > 0;

    if (owned.creativeStrategistId) {
      const s = strategistMap.get(owned.creativeStrategistId) || { id: owned.creativeStrategistId, adsets: 0, winners: 0 };
      s.adsets += 1; if (isWinner) s.winners += 1;
      strategistMap.set(owned.creativeStrategistId, s);
    }

    if (!owned.videoEditorId) continue;

    const spend = aggSpendSek / rate;
    const paidForAdset = ledger?.paidAmount || 0;
    const adsetRow: EditorAdsetRow = {
      adsetId: owned.adsetId,
      adsetName: owned.adsetName || owned.adsetId,
      campaignId: owned.campaignId,
      strategistName: owned.creativeStrategistId ? userMap.get(owned.creativeStrategistId)?.name?.split(" ")[0] || null : null,
      spend,
      impressions: aggImpr,
      purchases: aggPurch,
      purchaseValue: aggPvSek / rate,
      roas: aggSpendSek > 0 ? aggPvSek / aggSpendSek : 0,
      ctr: aggImpr > 0 ? (aggLink / aggImpr) * 100 : 0,
      hookRate: aggImpr > 0 ? (aggV3 / aggImpr) * 100 : 0,
      holdRate: aggV3 > 0 ? (aggThru / aggV3) * 100 : 0,
      cpc: aggLink > 0 ? spend / aggLink : 0,
      cpm: aggImpr > 0 ? (spend / aggImpr) * 1000 : 0,
      bonus,
      bonusTier: ledger?.earnedTier || 0,
      tierLog: (ledger?.tierLog as Record<string, string>) || {},
      paidForAdset,
      outstanding: Math.max(bonus - paidForAdset, 0),
      lifetimeSpend: ledger?.peakSpend || 0,
      lifetimeRoas: ledger?.peakRoas || 0,
      isWinner,
      graveyardOutcome: owned.graveyardOutcome,
      adCount: ads.length,
      ads,
    };

    const entry = editorMap.get(owned.videoEditorId) || { editorId: owned.videoEditorId, adsets: [] };
    entry.adsets.push(adsetRow);
    editorMap.set(owned.videoEditorId, entry);
  }

  const editorIds = Array.from(editorMap.keys());
  await ensureSlugs(editorIds, allUsers);

  const payouts = editorIds.length
    ? await db.select().from(schema.editorPayouts).where(inArray(schema.editorPayouts.editorId, editorIds))
    : [];
  const payoutsByEditor = new Map<string, typeof payouts>();
  for (const p of payouts) {
    const list = payoutsByEditor.get(p.editorId) || [];
    list.push(p);
    payoutsByEditor.set(p.editorId, list);
  }

  const editors = Array.from(editorMap.values()).map((e) => {
    const user = userMap.get(e.editorId);
    e.adsets.sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);

    const totalSpendSekEquiv = e.adsets.reduce((s, a) => s + a.spend, 0); // USD
    const totalPurchaseValue = e.adsets.reduce((s, a) => s + a.purchaseValue, 0);
    const totalPurchases = e.adsets.reduce((s, a) => s + a.purchases, 0);
    const totalImpressions = e.adsets.reduce((s, a) => s + a.impressions, 0);
    const totalLinkClicks = e.adsets.reduce((s, a) => s + (a.ctr * a.impressions) / 100, 0);
    const totalV3 = e.adsets.reduce((s, a) => s + (a.hookRate * a.impressions) / 100, 0);
    const totalThru = e.adsets.reduce((s, a) => s + (a.holdRate * a.hookRate * a.impressions) / 10000, 0);
    const roas = totalSpendSekEquiv > 0 ? totalPurchaseValue / totalSpendSekEquiv : 0;
    const ctr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
    const hookRate = totalImpressions > 0 ? (totalV3 / totalImpressions) * 100 : 0;
    const holdRate = totalV3 > 0 ? (totalThru / totalV3) * 100 : 0;
    const cpc = totalLinkClicks > 0 ? totalSpendSekEquiv / totalLinkClicks : 0;
    const cpm = totalImpressions > 0 ? (totalSpendSekEquiv / totalImpressions) * 1000 : 0;

    const totalBonus = e.adsets.reduce((s, a) => s + a.bonus, 0);
    const paidAmount = e.adsets.reduce((s, a) => s + a.paidForAdset, 0);
    const winnerCount = e.adsets.filter((a) => a.isWinner).length;
    const graveyardSpendWinners = e.adsets.filter((a) => a.graveyardOutcome === "spend_winner").length;
    const graveyardLosers = e.adsets.filter((a) => a.graveyardOutcome === "loser").length;

    // Angle breakdown across all the editor's ads.
    const angleAgg = new Map<string, { angle: string; ads: number; winners: number }>();
    for (const aset of e.adsets) {
      for (const ad of aset.ads) {
        if (!ad.angle) continue;
        const g = angleAgg.get(ad.angle) || { angle: ad.angle, ads: 0, winners: 0 };
        g.ads += 1;
        if (aset.isWinner) g.winners += 1;
        angleAgg.set(ad.angle, g);
      }
    }
    const angleStats = Array.from(angleAgg.values()).sort((x, y) => y.winners - x.winners || y.ads - x.ads);

    const myPayouts = (payoutsByEditor.get(e.editorId) || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const pendingAmount = myPayouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);

    return {
      editorId: e.editorId,
      editor: user?.name?.split(" ")[0] || "Unknown",
      fullName: user?.name || "Unknown",
      slug: user?.slug || null,
      userType: user?.userType || "video_editor",
      totalSpend: totalSpendSekEquiv,
      totalPurchaseValue,
      totalPurchases,
      totalImpressions,
      roas,
      ctr,
      hookRate,
      holdRate,
      cpc,
      cpm,
      totalBonus,
      paidAmount,
      pendingAmount,
      unpaidAmount: Math.max(totalBonus - paidAmount - pendingAmount, 0),
      adsetCount: e.adsets.length,
      winnerCount,
      graveyardSpendWinners,
      graveyardLosers,
      angleStats,
      adsets: e.adsets,
      payouts: myPayouts,
    };
  });

  editors.sort((a, b) => b.totalBonus - a.totalBonus || b.totalSpend - a.totalSpend);

  const leaderboard = editors
    .map((e) => ({ editorId: e.editorId, name: e.editor, slug: e.slug, winners: e.winnerCount, hookRate: e.hookRate, earned: e.totalBonus }))
    .sort((a, b) => b.winners - a.winners || b.earned - a.earned);

  const strategists = Array.from(strategistMap.values())
    .map((s) => {
      const u = userMap.get(s.id);
      return { id: s.id, name: u?.name || "Unknown", slug: u?.slug || null, adsets: s.adsets, winners: s.winners, winRate: s.adsets > 0 ? (s.winners / s.adsets) * 100 : 0 };
    })
    .sort((a, b) => b.winners - a.winners);

  const templates = Array.from(templateMap.values())
    .map((t) => ({ templateId: t.templateId, templateName: t.templateName, ads: t.ads, winners: t.winners, winRate: t.ads > 0 ? (t.winners / t.ads) * 100 : 0, spend: t.spend, roas: t.spend > 0 ? t.revenue / t.spend : 0 }))
    .sort((a, b) => b.roas - a.roas || b.winners - a.winners);

  const mapPerf = (m: Map<string, { name: string; ads: number; winners: number; spend: number; revenue: number }>) =>
    Array.from(m.values())
      .map((g) => ({ name: g.name, ads: g.ads, winners: g.winners, winRate: g.ads > 0 ? (g.winners / g.ads) * 100 : 0, spend: g.spend, roas: g.spend > 0 ? g.revenue / g.spend : 0 }))
      .sort((a, b) => b.winners - a.winners || b.spend - a.spend);

  return {
    editors, leaderboard, strategists, templates,
    angles: mapPerf(anglePerf),
    problems: mapPerf(problemPerf),
    bonusTiers: settings.bonusTiers, sekPerUsd: rate, dateRange: { from, to },
  };
}

/** Daily spend / revenue / ROAS series for a set of ads — powers the performance graph. Money in USD. */
export async function getEditorTimeseries(adIds: string[], from: string, to: string, sekPerUsd = 10.5) {
  const rate = sekPerUsd > 0 ? sekPerUsd : 10.5;
  if (adIds.length === 0) return [] as Array<{ date: string; spend: number; revenue: number; roas: number; purchases: number }>;
  const rows = await db
    .select({
      date: schema.insights.dateStart,
      spend: sql<number>`coalesce(sum(${schema.insights.spend}), 0)`,
      revenue: sql<number>`coalesce(sum(${schema.insights.purchaseValue}), 0)`,
      purchases: sql<number>`coalesce(sum(${schema.insights.purchases}), 0)`,
    })
    .from(schema.insights)
    .where(and(eq(schema.insights.entityType, "ad"), inArray(schema.insights.entityId, adIds), gte(schema.insights.dateStart, from), lte(schema.insights.dateStop, to)))
    .groupBy(schema.insights.dateStart)
    .orderBy(schema.insights.dateStart);

  return rows.map((r) => {
    const spendSek = Number(r.spend) || 0;
    const revenueSek = Number(r.revenue) || 0;
    return { date: String(r.date), spend: spendSek / rate, revenue: revenueSek / rate, roas: spendSek > 0 ? revenueSek / spendSek : 0, purchases: Number(r.purchases) || 0 };
  });
}
