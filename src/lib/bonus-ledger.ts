// ─── Bonus ledger (server-only) ─────────────────────────────────────────────
// Resolves who owns each Meta ad and locks in lifetime-earned bonuses.
// Imports the DB, so this must only be used from server code (API routes /
// server components) — never from a client component.

import { db, schema } from "@/db";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { calculateBonus } from "./bonus";

export interface OwnedAd {
  adId: string;
  videoEditorId: string | null;
  creativeStrategistId: string | null;
  source: string; // "analyzer" | "uploader" | "assignment"
  assignmentId: string | null;
  adName: string | null;
  campaignId: string | null;
  adsetId: string | null;
  angle: string | null;
  problem: string | null;
  templateId: number | null;
  templateName: string | null;
  graveyardOutcome: string | null; // "spend_winner" | "loser" | null
}

/**
 * Resolve ad → owner across both attribution sources.
 * Priority: ad_owners (explicit, set via button/uploader) overrides the
 * assignment-workflow linkage (assignments.metaAdId → assignedToId).
 */
export async function resolveOwnedAds(): Promise<OwnedAd[]> {
  const [owners, assignmentRows, ads] = await Promise.all([
    db.select().from(schema.adOwners),
    db.select().from(schema.assignments).where(isNotNull(schema.assignments.metaAdId)),
    db
      .select({
        id: schema.adsCache.id,
        name: schema.adsCache.name,
        campaignId: schema.adsCache.campaignId,
        adsetId: schema.adsCache.adsetId,
      })
      .from(schema.adsCache),
  ]);

  const adMeta = new Map(ads.map((a) => [a.id, a]));
  const map = new Map<string, OwnedAd>();

  // Secondary source first so explicit owners (below) override it.
  for (const a of assignmentRows) {
    if (!a.metaAdId) continue;
    map.set(a.metaAdId, {
      adId: a.metaAdId,
      videoEditorId: a.assignedToId,
      creativeStrategistId: a.creativeStrategistId || null,
      source: "assignment",
      assignmentId: a.id,
      adName: adMeta.get(a.metaAdId)?.name || a.autoName || null,
      campaignId: a.metaCampaignId || adMeta.get(a.metaAdId)?.campaignId || null,
      adsetId: a.metaAdsetId || adMeta.get(a.metaAdId)?.adsetId || null,
      angle: null,
      problem: null,
      templateId: null,
      templateName: null,
      graveyardOutcome: null,
    });
  }

  for (const o of owners) {
    const existing = map.get(o.adId);
    map.set(o.adId, {
      adId: o.adId,
      // An explicit owner overrides the assignment owner; a metadata-only
      // ad_owners row (e.g. one created just to store a graveyard outcome) keeps
      // the assignment-derived owner instead of nulling it.
      videoEditorId: o.videoEditorId ?? existing?.videoEditorId ?? null,
      creativeStrategistId: o.creativeStrategistId ?? existing?.creativeStrategistId ?? null,
      source: o.videoEditorId || o.creativeStrategistId ? o.source || "analyzer" : existing?.source || o.source || "analyzer",
      assignmentId: existing?.assignmentId || null,
      adName: o.adName || adMeta.get(o.adId)?.name || existing?.adName || null,
      campaignId: o.campaignId || adMeta.get(o.adId)?.campaignId || existing?.campaignId || null,
      adsetId: o.adsetId || adMeta.get(o.adId)?.adsetId || existing?.adsetId || null,
      angle: o.angle ?? existing?.angle ?? null,
      problem: o.problem ?? existing?.problem ?? null,
      templateId: o.templateId ?? existing?.templateId ?? null,
      templateName: o.templateName ?? existing?.templateName ?? null,
      graveyardOutcome: o.graveyardOutcome ?? existing?.graveyardOutcome ?? null,
    });
  }

  return Array.from(map.values());
}

/**
 * Lock in lifetime-earned bonuses for the given owned ads.
 * Evaluates each ad on its CUMULATIVE (all-time) spend + ROAS and bumps the
 * locked earnedBonus up to the highest tier ever reached — never down.
 * Returns the up-to-date ledger rows for the evaluated ads.
 */
export async function recomputeAdBonuses(ownedAds: OwnedAd[], sekPerUsd = 10.5) {
  const rate = sekPerUsd > 0 ? sekPerUsd : 10.5;
  const eligible = ownedAds.filter((a) => a.videoEditorId);
  const adIds = eligible.map((a) => a.adId);
  if (adIds.length === 0) return [] as (typeof schema.adBonuses.$inferSelect)[];

  const editorByAd = new Map(eligible.map((a) => [a.adId, a.videoEditorId as string]));

  // Daily insights per ad, in chronological order, so we can capture EVERY tier
  // the ad passes through during its run — not just the latest cumulative state.
  const daily = await db
    .select({
      adId: schema.insights.entityId,
      date: schema.insights.dateStart,
      spend: schema.insights.spend,
      purchaseValue: schema.insights.purchaseValue,
    })
    .from(schema.insights)
    .where(and(eq(schema.insights.entityType, "ad"), inArray(schema.insights.entityId, adIds)))
    .orderBy(schema.insights.entityId, schema.insights.dateStart);

  const dailyByAd = new Map<string, Array<{ date: string; spend: number; purchaseValue: number }>>();
  for (const r of daily) {
    const list = dailyByAd.get(r.adId) || [];
    list.push({ date: String(r.date), spend: Number(r.spend) || 0, purchaseValue: Number(r.purchaseValue) || 0 });
    dailyByAd.set(r.adId, list);
  }

  const existing = await db
    .select()
    .from(schema.adBonuses)
    .where(inArray(schema.adBonuses.adId, adIds));
  const existingByAd = new Map(existing.map((r) => [r.adId, r]));

  const now = new Date();

  for (const adId of adIds) {
    const editorId = editorByAd.get(adId);
    if (!editorId) continue;
    const rows = dailyByAd.get(adId) || [];
    const prev = existingByAd.get(adId);

    // Walk day-by-day, accumulating spend + revenue. At each step evaluate the
    // tier and record the first date each tier is reached. tierLog only grows.
    const tierLog: Record<string, string> = { ...(prev?.tierLog || {}) };
    let cumSpendSek = 0;
    let cumRevSek = 0;
    let maxBonus = 0;
    let maxTier = 0;
    for (const day of rows) {
      cumSpendSek += day.spend;
      cumRevSek += day.purchaseValue;
      const roas = cumSpendSek > 0 ? cumRevSek / cumSpendSek : 0;
      const usdSpend = cumSpendSek / rate;
      const { bonus, tier } = calculateBonus(usdSpend, roas);
      if (bonus > maxBonus) { maxBonus = bonus; maxTier = tier; }
      if (bonus > 0 && !tierLog[String(bonus)]) tierLog[String(bonus)] = day.date;
    }

    const finalSpendUsd = cumSpendSek / rate;
    const finalRoas = cumSpendSek > 0 ? cumRevSek / cumSpendSek : 0;
    const earnedBonus = Math.max(prev?.earnedBonus || 0, maxBonus);
    const earnedTier = Math.max(prev?.earnedTier || 0, maxTier);

    if (!prev) {
      if (earnedBonus <= 0 && finalSpendUsd <= 0) continue;
      await db.insert(schema.adBonuses).values({
        adId,
        editorId,
        earnedBonus,
        earnedTier,
        tierLog,
        peakSpend: finalSpendUsd,
        peakRoas: finalRoas,
        firstQualifiedAt: earnedBonus > 0 ? now : null,
        lastEvaluatedAt: now,
      });
    } else {
      await db
        .update(schema.adBonuses)
        .set({
          editorId, // keep owner in sync if it changed
          earnedBonus,
          earnedTier,
          tierLog,
          peakSpend: Math.max(prev.peakSpend, finalSpendUsd),
          peakRoas: finalRoas,
          firstQualifiedAt: prev.firstQualifiedAt || (earnedBonus > 0 ? now : null),
          lastEvaluatedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.adBonuses.adId, adId));
    }
  }

  return db.select().from(schema.adBonuses).where(inArray(schema.adBonuses.adId, adIds));
}

/** Record a payment against a set of ad bonuses (called when a payout is marked paid). */
export async function applyBonusPayment(breakdown: Array<{ adId: string; bonus: number }>) {
  for (const item of breakdown) {
    if (!item.adId) continue;
    await db
      .update(schema.adBonuses)
      .set({
        paidAmount: sql`${schema.adBonuses.paidAmount} + ${item.bonus}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.adBonuses.adId, item.adId));
  }
}
