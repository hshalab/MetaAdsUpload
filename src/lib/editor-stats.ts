// ─── Editor performance aggregation (server-only) ───────────────────────────
// Shared by the admin /api/editors route and the public /api/e/[slug] route so
// both render identical numbers. Bonuses are lifetime-locked (see bonus-ledger).

import { db, schema } from "@/db";
import { and, eq, gte, lte, sql, inArray } from "drizzle-orm";
import { slugify } from "./bonus";
import { resolveOwnedAds, recomputeAdBonuses } from "./bonus-ledger";
import { getEvolveSettings } from "./evolve/settings";

export interface EditorAdRow {
  id: string;
  name: string;
  assignmentId: string | null;
  source: string;
  strategistId: string | null;
  strategistName: string | null;
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  hookRate: number;
  holdRate: number;
  cpc: number;
  cpm: number;
  videoViews3s: number;
  videoThruplays: number;
  bonus: number;
  bonusTier: number;
  tierLog: Record<string, string>;
  paidForAd: number;
  outstanding: number;
  lifetimeSpend: number;
  lifetimeRoas: number;
  isWinner: boolean;
  angle: string | null;
  problem: string | null;
  graveyardOutcome: string | null;
  templateName: string | null;
}

/** Ensure every editor that owns ads has a unique public slug; backfill if missing. */
async function ensureSlugs(editorIds: string[], users: (typeof schema.users.$inferSelect)[]) {
  const taken = new Set(users.map((u) => u.slug).filter(Boolean) as string[]);
  for (const id of editorIds) {
    const u = users.find((x) => x.id === id);
    if (!u || u.slug) continue;
    let base = slugify(u.name) || `editor-${id.slice(0, 6)}`;
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) candidate = `${base}-${n++}`;
    taken.add(candidate);
    u.slug = candidate; // mutate in-memory copy so the caller sees it
    try {
      await db.update(schema.users).set({ slug: candidate, updatedAt: new Date() }).where(eq(schema.users.id, id));
    } catch {
      /* slug is best-effort; collisions on the unique index are ignored */
    }
  }
}

export async function getEditorsOverview({ from, to }: { from: string; to: string }) {
  const allUsers = await db.select().from(schema.users);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const settings = await getEvolveSettings();
  const rate = settings.sekPerUsd > 0 ? settings.sekPerUsd : 10.5; // SEK → USD

  const ownedAds = await resolveOwnedAds();
  const ledgerRows = await recomputeAdBonuses(ownedAds, rate, settings.bonusTiers);
  const ledgerByAd = new Map(ledgerRows.map((r) => [r.adId, r]));
  const ownedAdIds = ownedAds.map((a) => a.adId);

  const periodInsights = ownedAdIds.length
    ? await db
        .select({
          entityId: schema.insights.entityId,
          spend: sql<number>`coalesce(sum(${schema.insights.spend}), 0)`,
          impressions: sql<number>`coalesce(sum(${schema.insights.impressions}), 0)`,
          linkClicks: sql<number>`coalesce(sum(${schema.insights.linkClicks}), 0)`,
          purchases: sql<number>`coalesce(sum(${schema.insights.purchases}), 0)`,
          purchaseValue: sql<number>`coalesce(sum(${schema.insights.purchaseValue}), 0)`,
          videoViews3s: sql<number>`coalesce(sum(${schema.insights.videoViews3s}), 0)`,
          videoThruplays: sql<number>`coalesce(sum(${schema.insights.videoThruplays}), 0)`,
        })
        .from(schema.insights)
        .where(
          and(
            eq(schema.insights.entityType, "ad"),
            inArray(schema.insights.entityId, ownedAdIds),
            gte(schema.insights.dateStart, from),
            lte(schema.insights.dateStop, to)
          )
        )
        .groupBy(schema.insights.entityId)
    : [];
  const periodByAd = new Map(periodInsights.map((r) => [r.entityId, r]));

  const editorMap = new Map<string, { editorId: string; ads: EditorAdRow[] }>();
  const strategistMap = new Map<string, { id: string; ads: number; winners: number }>();
  const templateMap = new Map<number, { templateId: number; templateName: string; ads: number; winners: number; spend: number; revenue: number }>();

  for (const owned of ownedAds) {
    const period = periodByAd.get(owned.adId);
    const ledger = ledgerByAd.get(owned.adId);

    const spendSek = Number(period?.spend) || 0;
    const impressions = Number(period?.impressions) || 0;
    const linkClicks = Number(period?.linkClicks) || 0;
    const purchases = Number(period?.purchases) || 0;
    const purchaseValueSek = Number(period?.purchaseValue) || 0;
    const videoViews3s = Number(period?.videoViews3s) || 0;
    const videoThruplays = Number(period?.videoThruplays) || 0;
    // Convert money to USD (account is SEK; bonus thresholds + display are USD).
    const spend = spendSek / rate;
    const purchaseValue = purchaseValueSek / rate;
    const roas = spendSek > 0 ? purchaseValueSek / spendSek : 0; // ratio — currency-agnostic
    const ctr = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
    const hookRate = impressions > 0 ? (videoViews3s / impressions) * 100 : 0;
    const holdRate = videoViews3s > 0 ? (videoThruplays / videoViews3s) * 100 : 0;
    const cpc = linkClicks > 0 ? spend / linkClicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

    const bonus = ledger?.earnedBonus || 0;
    const bonusTier = ledger?.earnedTier || 0;
    const tierLog = (ledger?.tierLog as Record<string, string>) || {};
    const paidForAd = ledger?.paidAmount || 0;
    const outstanding = Math.max(bonus - paidForAd, 0);
    const lifetimeSpend = ledger?.peakSpend || 0;
    const lifetimeRoas = ledger?.peakRoas || 0;
    const isWinner = bonus > 0;

    if (owned.creativeStrategistId) {
      const s = strategistMap.get(owned.creativeStrategistId) || { id: owned.creativeStrategistId, ads: 0, winners: 0 };
      s.ads += 1;
      if (isWinner) s.winners += 1;
      strategistMap.set(owned.creativeStrategistId, s);
    }

    // Template performance (best/worst) — across all owned ads that recorded a template.
    if (owned.templateId) {
      const t = templateMap.get(owned.templateId) || {
        templateId: owned.templateId,
        templateName: owned.templateName || `Template ${owned.templateId}`,
        ads: 0,
        winners: 0,
        spend: 0,
        revenue: 0,
      };
      t.ads += 1;
      if (isWinner) t.winners += 1;
      t.spend += lifetimeSpend;
      t.revenue += lifetimeSpend * lifetimeRoas;
      templateMap.set(owned.templateId, t);
    }

    if (!owned.videoEditorId) continue;

    const row: EditorAdRow = {
      id: owned.adId,
      name: owned.adName || owned.adId,
      assignmentId: owned.assignmentId,
      source: owned.source,
      strategistId: owned.creativeStrategistId,
      strategistName: owned.creativeStrategistId ? userMap.get(owned.creativeStrategistId)?.name?.split(" ")[0] || null : null,
      spend,
      impressions,
      linkClicks,
      purchases,
      purchaseValue,
      roas,
      ctr,
      hookRate,
      holdRate,
      cpc,
      cpm,
      videoViews3s,
      videoThruplays,
      bonus,
      bonusTier,
      tierLog,
      paidForAd,
      outstanding,
      lifetimeSpend,
      lifetimeRoas,
      isWinner,
      angle: owned.angle,
      problem: owned.problem,
      graveyardOutcome: owned.graveyardOutcome,
      templateName: owned.templateName,
    };

    const entry = editorMap.get(owned.videoEditorId) || { editorId: owned.videoEditorId, ads: [] };
    entry.ads.push(row);
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
    e.ads.sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);

    const totalSpend = e.ads.reduce((s, a) => s + a.spend, 0);
    const totalPurchaseValue = e.ads.reduce((s, a) => s + a.purchaseValue, 0);
    const totalPurchases = e.ads.reduce((s, a) => s + a.purchases, 0);
    const totalImpressions = e.ads.reduce((s, a) => s + a.impressions, 0);
    const totalLinkClicks = e.ads.reduce((s, a) => s + a.linkClicks, 0);
    const totalVideoViews3s = e.ads.reduce((s, a) => s + a.videoViews3s, 0);
    const totalVideoThruplays = e.ads.reduce((s, a) => s + a.videoThruplays, 0);
    const roas = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
    const ctr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
    const hookRate = totalImpressions > 0 ? (totalVideoViews3s / totalImpressions) * 100 : 0;
    const holdRate = totalVideoViews3s > 0 ? (totalVideoThruplays / totalVideoViews3s) * 100 : 0;
    const cpc = totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

    const totalBonus = e.ads.reduce((s, a) => s + a.bonus, 0);
    const paidAmount = e.ads.reduce((s, a) => s + a.paidForAd, 0);
    const winnerCount = e.ads.filter((a) => a.isWinner).length;
    const graveyardSpendWinners = e.ads.filter((a) => a.graveyardOutcome === "spend_winner").length;
    const graveyardLosers = e.ads.filter((a) => a.graveyardOutcome === "loser").length;

    // Per-editor angle breakdown (which angles they win with).
    const angleAgg = new Map<string, { angle: string; ads: number; winners: number }>();
    for (const a of e.ads) {
      if (!a.angle) continue;
      const g = angleAgg.get(a.angle) || { angle: a.angle, ads: 0, winners: 0 };
      g.ads += 1;
      if (a.isWinner) g.winners += 1;
      angleAgg.set(a.angle, g);
    }
    const angleStats = Array.from(angleAgg.values()).sort((x, y) => y.winners - x.winners || y.ads - x.ads);

    const myPayouts = (payoutsByEditor.get(e.editorId) || []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const pendingAmount = myPayouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);

    return {
      editorId: e.editorId,
      editor: user?.name?.split(" ")[0] || "Unknown",
      fullName: user?.name || "Unknown",
      slug: user?.slug || null,
      userType: user?.userType || "video_editor",
      totalSpend,
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
      adCount: e.ads.length,
      winnerCount,
      graveyardSpendWinners,
      graveyardLosers,
      angleStats,
      ads: e.ads,
      payouts: myPayouts,
    };
  });

  editors.sort((a, b) => b.totalBonus - a.totalBonus || b.totalSpend - a.totalSpend);

  const leaderboard = editors
    .map((e) => ({
      editorId: e.editorId,
      name: e.editor,
      slug: e.slug,
      winners: e.winnerCount,
      hookRate: e.hookRate,
      earned: e.totalBonus,
    }))
    .sort((a, b) => b.winners - a.winners || b.earned - a.earned);

  const strategists = Array.from(strategistMap.values())
    .map((s) => {
      const u = userMap.get(s.id);
      return {
        id: s.id,
        name: u?.name || "Unknown",
        slug: u?.slug || null,
        ads: s.ads,
        winners: s.winners,
        winRate: s.ads > 0 ? (s.winners / s.ads) * 100 : 0,
      };
    })
    .sort((a, b) => b.winners - a.winners);

  const templates = Array.from(templateMap.values())
    .map((t) => ({
      templateId: t.templateId,
      templateName: t.templateName,
      ads: t.ads,
      winners: t.winners,
      winRate: t.ads > 0 ? (t.winners / t.ads) * 100 : 0,
      spend: t.spend,
      roas: t.spend > 0 ? t.revenue / t.spend : 0,
    }))
    .sort((a, b) => b.roas - a.roas || b.winners - a.winners);

  return { editors, leaderboard, strategists, templates, bonusTiers: settings.bonusTiers, sekPerUsd: rate, dateRange: { from, to } };
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
    .where(
      and(
        eq(schema.insights.entityType, "ad"),
        inArray(schema.insights.entityId, adIds),
        gte(schema.insights.dateStart, from),
        lte(schema.insights.dateStop, to)
      )
    )
    .groupBy(schema.insights.dateStart)
    .orderBy(schema.insights.dateStart);

  return rows.map((r) => {
    const spendSek = Number(r.spend) || 0;
    const revenueSek = Number(r.revenue) || 0;
    return {
      date: String(r.date),
      spend: spendSek / rate,
      revenue: revenueSek / rate,
      roas: spendSek > 0 ? revenueSek / spendSek : 0,
      purchases: Number(r.purchases) || 0,
    };
  });
}
