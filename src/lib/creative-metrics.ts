import { db } from "@/db";
import { sql } from "drizzle-orm";

// ─── Creative Intelligence: creative ↔ ad ↔ insights aggregation ────────────
// A library creative is linked to its Meta ads three ways:
//   1. ads_cache.video_id   = creatives.meta_video_id    (video creatives)
//   2. ads_cache.image_hash = creatives.meta_image_hash  (image creatives)
//   3. assignments.meta_ad_id where assignments.id = creatives.assignment_id
// Metrics are summed over all matched ads for the requested date range.

export interface CreativeMetrics {
  creativeId: number;
  adCount: number;
  activeAdCount: number;
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  linkClicks: number;
  videoViews3s: number;
  thruplays: number;
  roas: number;
  cpa: number | null;
  ctr: number;
  hookRate: number;
  holdRate: number;
  classification: string | null;
}

export interface CreativeAdBreakdownRow {
  adId: string;
  adName: string;
  adStatus: string;
  adsetId: string;
  campaignId: string;
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  linkClicks: number;
  videoViews3s: number;
  thruplays: number;
  roas: number;
  cpa: number | null;
  ctr: number;
  hookRate: number;
  holdRate: number;
  classification: string | null;
}

// Best classification wins when a creative runs as several ads.
const CLASSIFICATION_RANK = ["breakthrough", "spend_winner", "kpi_winner", "new", "loser"];

export function bestClassification(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const ra = CLASSIFICATION_RANK.indexOf(a);
  const rb = CLASSIFICATION_RANK.indexOf(b);
  if (ra === -1) return b;
  if (rb === -1) return a;
  return ra <= rb ? a : b;
}

export function rangeFromDays(days: number): { since: string; until: string } {
  const until = new Date().toISOString().slice(0, 10);
  const since =
    days > 0
      ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      : "2000-01-01"; // lifetime
  return { since, until };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function derive(spend: number, revenue: number, purchases: number, impressions: number, linkClicks: number, v3: number, thru: number) {
  return {
    roas: spend > 0 ? revenue / spend : 0,
    cpa: purchases > 0 ? spend / purchases : null,
    ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
    hookRate: impressions > 0 ? (v3 / impressions) * 100 : 0,
    holdRate: v3 > 0 ? (thru / v3) * 100 : 0,
  };
}

function matchedCte(creativeIds: number[]) {
  const idList = sql.join(creativeIds.map((id) => sql`${id}`), sql`, `);
  return sql`
    matched AS (
      SELECT DISTINCT x.creative_id, x.ad_id FROM (
        SELECT c.id AS creative_id, a.id AS ad_id
        FROM creatives c
        JOIN ads_cache a ON (
          (c.meta_video_id IS NOT NULL AND a.video_id = c.meta_video_id) OR
          (c.meta_image_hash IS NOT NULL AND a.image_hash = c.meta_image_hash)
        )
        WHERE c.id IN (${idList})
        UNION ALL
        SELECT c2.id AS creative_id, s.meta_ad_id AS ad_id
        FROM creatives c2
        JOIN assignments s ON s.id = c2.assignment_id
        WHERE s.meta_ad_id IS NOT NULL AND c2.id IN (${idList})
      ) x
    )
  `;
}

type Row = Record<string, unknown>;

async function execRows(query: ReturnType<typeof sql>): Promise<Row[]> {
  const res = (await db.execute(query)) as unknown as { rows?: Row[] } | Row[];
  return Array.isArray(res) ? res : res.rows ?? [];
}

/**
 * Aggregated performance per creative for a set of library creative IDs.
 * `days = 0` means lifetime. Excludes breakdown rows to avoid double counting.
 */
export async function getCreativeMetrics(creativeIds: number[], days = 30): Promise<Map<number, CreativeMetrics>> {
  const map = new Map<number, CreativeMetrics>();
  if (creativeIds.length === 0) return map;
  const { since, until } = rangeFromDays(days);

  const aggRows = await execRows(sql`
    WITH ${matchedCte(creativeIds)}
    SELECT
      m.creative_id,
      COUNT(DISTINCT m.ad_id) AS ad_count,
      COUNT(DISTINCT m.ad_id) FILTER (WHERE ac.status = 'ACTIVE') AS active_ad_count,
      COALESCE(SUM(i.spend), 0) AS spend,
      COALESCE(SUM(i.purchase_value), 0) AS revenue,
      COALESCE(SUM(i.purchases), 0) AS purchases,
      COALESCE(SUM(i.impressions), 0) AS impressions,
      COALESCE(SUM(i.link_clicks), 0) AS link_clicks,
      COALESCE(SUM(i.video_views_3s), 0) AS v3,
      COALESCE(SUM(i.video_thruplays), 0) AS thru
    FROM matched m
    LEFT JOIN ads_cache ac ON ac.id = m.ad_id
    LEFT JOIN insights i ON i.entity_id = m.ad_id
      AND i.entity_type = 'ad'
      AND i.breakdown_key IS NULL
      AND i.date_start >= ${since}
      AND i.date_stop <= ${until}
    GROUP BY m.creative_id
  `);

  for (const r of aggRows) {
    const creativeId = num(r.creative_id);
    const spend = num(r.spend);
    const revenue = num(r.revenue);
    const purchases = num(r.purchases);
    const impressions = num(r.impressions);
    const linkClicks = num(r.link_clicks);
    const v3 = num(r.v3);
    const thru = num(r.thru);
    map.set(creativeId, {
      creativeId,
      adCount: num(r.ad_count),
      activeAdCount: num(r.active_ad_count),
      spend,
      revenue,
      purchases,
      impressions,
      linkClicks,
      videoViews3s: v3,
      thruplays: thru,
      ...derive(spend, revenue, purchases, impressions, linkClicks, v3, thru),
      classification: null,
    });
  }

  // Latest classification per matched ad → best per creative.
  const clsRows = await execRows(sql`
    WITH ${matchedCte(creativeIds)},
    latest AS (
      SELECT DISTINCT ON (ad_id) ad_id, classification
      FROM ad_classifications
      WHERE ad_id IN (SELECT ad_id FROM matched)
      ORDER BY ad_id, classified_at DESC
    )
    SELECT m.creative_id, l.classification
    FROM matched m
    JOIN latest l ON l.ad_id = m.ad_id
  `);

  for (const r of clsRows) {
    const m = map.get(num(r.creative_id));
    if (m) m.classification = bestClassification(m.classification, (r.classification as string) ?? null);
  }

  return map;
}

/** Per-ad breakdown for one creative (the detail panel's mini ads-library view). */
export async function getCreativeAdBreakdown(creativeId: number, days = 30): Promise<CreativeAdBreakdownRow[]> {
  const { since, until } = rangeFromDays(days);

  const rows = await execRows(sql`
    WITH ${matchedCte([creativeId])},
    latest AS (
      SELECT DISTINCT ON (ad_id) ad_id, classification
      FROM ad_classifications
      WHERE ad_id IN (SELECT ad_id FROM matched)
      ORDER BY ad_id, classified_at DESC
    )
    SELECT
      m.ad_id,
      COALESCE(ac.name, m.ad_id) AS ad_name,
      COALESCE(ac.status, 'UNKNOWN') AS ad_status,
      COALESCE(ac.adset_id, '') AS adset_id,
      COALESCE(ac.campaign_id, '') AS campaign_id,
      l.classification,
      COALESCE(SUM(i.spend), 0) AS spend,
      COALESCE(SUM(i.purchase_value), 0) AS revenue,
      COALESCE(SUM(i.purchases), 0) AS purchases,
      COALESCE(SUM(i.impressions), 0) AS impressions,
      COALESCE(SUM(i.link_clicks), 0) AS link_clicks,
      COALESCE(SUM(i.video_views_3s), 0) AS v3,
      COALESCE(SUM(i.video_thruplays), 0) AS thru
    FROM matched m
    LEFT JOIN ads_cache ac ON ac.id = m.ad_id
    LEFT JOIN latest l ON l.ad_id = m.ad_id
    LEFT JOIN insights i ON i.entity_id = m.ad_id
      AND i.entity_type = 'ad'
      AND i.breakdown_key IS NULL
      AND i.date_start >= ${since}
      AND i.date_stop <= ${until}
    GROUP BY m.ad_id, ac.name, ac.status, ac.adset_id, ac.campaign_id, l.classification
    ORDER BY COALESCE(SUM(i.spend), 0) DESC
  `);

  return rows.map((r) => {
    const spend = num(r.spend);
    const revenue = num(r.revenue);
    const purchases = num(r.purchases);
    const impressions = num(r.impressions);
    const linkClicks = num(r.link_clicks);
    const v3 = num(r.v3);
    const thru = num(r.thru);
    return {
      adId: String(r.ad_id),
      adName: String(r.ad_name),
      adStatus: String(r.ad_status),
      adsetId: String(r.adset_id),
      campaignId: String(r.campaign_id),
      spend,
      revenue,
      purchases,
      impressions,
      linkClicks,
      videoViews3s: v3,
      thruplays: thru,
      ...derive(spend, revenue, purchases, impressions, linkClicks, v3, thru),
      classification: (r.classification as string) ?? null,
    };
  });
}
