import { getAdSets, createAdSet } from "@/lib/meta/adsets";
import { getAds } from "@/lib/meta/ads";
import { metaApi } from "@/lib/meta/client";

// ─── BIG 5 zombie handling ───────────────────────────────────────────────────
// For the US / BIG 5 market we run the graveyard differently: instead of a new
// ad set per move, every graveyard ad is funneled into a single shared zombie
// ad set. When that ad set reaches Meta's active-ad limit we spill into a
// sibling ("[GY] BIG5 ZOMBIE 2", "3", …) automatically.

export const BIG5_COUNTRY_CODES = ["US", "CA", "GB", "AU", "NZ"]; // USA, Canada, UK, Australia, New Zealand
const BIG5_SET = new Set(BIG5_COUNTRY_CODES);

export const ZOMBIE_ADSET_PREFIX = "[GY] BIG5 ZOMBIE";
// Meta caps active ads per ad set; keep a little headroom below the hard limit.
export const MAX_ADS_PER_ZOMBIE_ADSET = 50;

/** True when the ad set's geo targeting includes any BIG 5 country. */
export function isBig5Targeting(targeting: unknown): boolean {
  const countries = (targeting as { geo_locations?: { countries?: unknown } } | undefined)
    ?.geo_locations?.countries;
  if (!Array.isArray(countries)) return false;
  return countries.some((c) => BIG5_SET.has(String(c).toUpperCase()));
}

/** Parse the trailing index from a zombie ad set name; the bare prefix is #1. */
function parseZombieIndex(name: string): number {
  if (name === ZOMBIE_ADSET_PREFIX) return 1;
  const m = name.match(/\s(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 1;
}

export interface ZombiePlacerConfig {
  graveyardCampaignId: string;
  targeting: Record<string, unknown>;
  optimizationGoal: string;
  billingEvent: string;
  promotedObject?: Record<string, unknown>;
  /** Cost cap in cents; only used when the graveyard campaign is not CBO. */
  costCapValue: number;
}

/**
 * Build a stateful placer for the shared BIG 5 zombie ad set(s).
 * Call `next()` once per ad to get the ad set ID it should go into — capacity is
 * tracked in memory and a new sibling ad set is created when the current one fills.
 */
export async function createZombiePlacer(cfg: ZombiePlacerConfig) {
  // Is the graveyard campaign CBO? If so, budget + bid strategy live at the
  // campaign level and must not be set on the ad set.
  let isCBO = false;
  try {
    const campaign = await metaApi<{ daily_budget?: string; lifetime_budget?: string }>(
      `/${cfg.graveyardCampaignId}`,
      { params: { fields: "daily_budget,lifetime_budget" } }
    );
    isCBO = !!(campaign.daily_budget || campaign.lifetime_budget);
  } catch { /* assume ABO if the check fails */ }

  // Load existing shared zombie ad sets + their live ad counts.
  const existing = (await getAdSets(cfg.graveyardCampaignId)).filter(
    (a) => a.name?.startsWith(ZOMBIE_ADSET_PREFIX)
  );

  type Slot = { id: string; remaining: number; index: number };
  const slots: Slot[] = [];
  for (const a of existing) {
    const activeCount = (await getAds(a.id, MAX_ADS_PER_ZOMBIE_ADSET + 10)).filter(
      (x) => x.status === "ACTIVE"
    ).length;
    slots.push({
      id: a.id,
      remaining: Math.max(0, MAX_ADS_PER_ZOMBIE_ADSET - activeCount),
      index: parseZombieIndex(a.name!),
    });
  }
  slots.sort((x, y) => x.index - y.index);
  let maxIndex = slots.reduce((m, s) => Math.max(m, s.index), 0);

  const createdAdsetIds: string[] = [];
  const reusedAdsetIds = existing.map((a) => a.id);

  async function createSibling(): Promise<Slot> {
    maxIndex += 1;
    const name = maxIndex === 1 ? ZOMBIE_ADSET_PREFIX : `${ZOMBIE_ADSET_PREFIX} ${maxIndex}`;
    const adset = await createAdSet({
      campaign_id: cfg.graveyardCampaignId,
      name,
      targeting: cfg.targeting,
      optimization_goal: cfg.optimizationGoal,
      billing_event: cfg.billingEvent,
      bid_strategy: isCBO ? undefined : "LOWEST_COST_WITH_BID_CAP",
      bid_amount: isCBO ? undefined : cfg.costCapValue,
      status: "ACTIVE",
      ...(cfg.promotedObject && { promoted_object: cfg.promotedObject }),
    });
    createdAdsetIds.push(adset.id);
    const slot: Slot = { id: adset.id, remaining: MAX_ADS_PER_ZOMBIE_ADSET, index: maxIndex };
    slots.push(slot);
    return slot;
  }

  /** Returns the ad set ID the next ad should be created in. */
  async function next(): Promise<string> {
    let slot = slots.find((s) => s.remaining > 0);
    if (!slot) slot = await createSibling();
    slot.remaining -= 1;
    return slot.id;
  }

  return { next, createdAdsetIds, reusedAdsetIds, isCBO };
}
