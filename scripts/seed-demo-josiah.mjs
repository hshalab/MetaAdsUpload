// Seed fictional showcase ad sets for the owner's own editor page (/e/josiah).
// All rows are marked source='demo' and use IDs prefixed 'demo-js-', so the
// Meta insights sync skips them and they can be wiped cleanly.
//
//   node scripts/seed-demo-josiah.mjs          # create demo data
//   node scripts/seed-demo-josiah.mjs --clean  # remove ALL demo data again
//
// The bonus ledger (ad_bonuses) is NOT written here — editor-stats recomputes
// it from the daily insights on page load, exactly like for real ad sets.

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);
const EDITOR_ID = "ef77186e-5be3-48c4-a3b7-5e5a0415cdb1"; // Josiah (owner)
const RATE = 10.5; // SEK per USD — must match evolve settings

const clean = process.argv.includes("--clean");

async function wipe() {
  await sql`delete from insights where entity_id like 'demo-js-%'`;
  await sql`delete from ad_bonuses where ad_id like 'demo-js-%'`;
  await sql`delete from ads_cache where id like 'demo-js-%'`;
  await sql`delete from adset_owners where adset_id like 'demo-js-%'`;
  console.log("Demo data removed.");
}

if (clean) {
  await wipe();
  process.exit(0);
}

// ─── Demo ad set definitions ────────────────────────────────────────────────
// targetUsd: cumulative lifetime spend in USD. roas: blended lifetime ROAS.
// days: how long the set ran. endDaysAgo: 0 = still running today.
// Tiers: $10≥500/2.5x · $20≥1000/2.5x · $30≥3750/2.0x · $50≥7500/2.0x
const SETS = [
  // ── $50 tier (4) ──
  { batch: "Sep88",  fmt: "VSL",    lp: "LP5 + PP",   problem: "ItchySkin",    angle: "UGC (it worked for me)", targetUsd: 14800, roas: 2.62, days: 150, endDaysAgo: 0,  ads: 4, verdict: true },
  { batch: "Okt97",  fmt: "UGC",    lp: "LP2 + LP12", problem: "Scratching",   angle: "Differential",           targetUsd: 11200, roas: 2.71, days: 130, endDaysAgo: 5,  ads: 3, verdict: true },
  { batch: "Nov132", fmt: "STATIC", lp: "LP7",        problem: "GrassEating",  angle: "Educational",            targetUsd: 9400,  roas: 2.18, days: 115, endDaysAgo: 0,  ads: 3, verdict: true },
  { batch: "Dec148", fmt: "VSL",    lp: "PP + LP12",  problem: "LickingPaws",  angle: "Tasslickande",           targetUsd: 8100,  roas: 2.07, days: 95,  endDaysAgo: 12, ads: 4 },
  // ── $30 tier (4) ──
  { batch: "Dec155", fmt: "UGC",    lp: "LP1 + LP2",  problem: "Mix",          angle: "Guarantee",              targetUsd: 6300, roas: 2.31, days: 85, endDaysAgo: 0,  ads: 3, verdict: true },
  { batch: "Jan167", fmt: "ANIME",  lp: "LP1",        problem: "ItchySkin",    angle: "ANIME",                  targetUsd: 5100, roas: 2.12, days: 75, endDaysAgo: 8,  ads: 2 },
  { batch: "Jan172", fmt: "VSL",    lp: "LP12 + LP6", problem: "Dirty ears",   angle: "Educational",            targetUsd: 4400, roas: 2.24, days: 70, endDaysAgo: 0,  ads: 3 },
  { batch: "Feb191", fmt: "STATIC", lp: "PP",         problem: "Loose stools", angle: "Progression",            targetUsd: 3950, roas: 2.45, days: 60, endDaysAgo: 3,  ads: 2 },
  // ── $20 tier (5) ──
  { batch: "Feb198", fmt: "UGC",    lp: "LP2",        problem: "Scratching",   angle: "UGC (it worked for me)", targetUsd: 3100, roas: 2.88, days: 55, endDaysAgo: 0,  ads: 3, verdict: true },
  { batch: "Mar211", fmt: "VSL",    lp: "LP5",        problem: "GrassEating",  angle: "Differential",           targetUsd: 2400, roas: 2.74, days: 48, endDaysAgo: 0,  ads: 3 },
  { batch: "Mar219", fmt: "STATIC", lp: "LP12",       problem: "ItchySkin",    angle: "Guarantee",              targetUsd: 1900, roas: 3.05, days: 42, endDaysAgo: 6,  ads: 2 },
  { batch: "Apr237", fmt: "Non narrated", lp: "LP2",  problem: "LickingPaws",  angle: "Tasslickande",           targetUsd: 1500, roas: 2.62, days: 35, endDaysAgo: 0,  ads: 2 },
  { batch: "Apr242", fmt: "UGC",    lp: "LP1 + LP2",  problem: "Mix",          angle: "Progression",            targetUsd: 1150, roas: 2.91, days: 30, endDaysAgo: 0,  ads: 3 },
  // ── $10 tier (3) ──
  { batch: "Apr248", fmt: "VSL",    lp: "PP",         problem: "Dirty ears",   angle: "Educational",            targetUsd: 820, roas: 2.77, days: 24, endDaysAgo: 0, ads: 2 },
  { batch: "Maj271", fmt: "STATIC", lp: "LP7",        problem: "GrassEating",  angle: "Differential",           targetUsd: 690, roas: 2.95, days: 18, endDaysAgo: 0, ads: 2 },
  { batch: "Maj278", fmt: "UGC",    lp: "LP12",       problem: "Scratching",   angle: "UGC (it worked for me)", targetUsd: 560, roas: 2.58, days: 14, endDaysAgo: 0, ads: 2 },
  // ── non-qualifiers for realism (4) ──
  { batch: "Jun283", fmt: "VSL",    lp: "LP5",        problem: "ItchySkin",    angle: "ANIME",       targetUsd: 1750, roas: 1.78, days: 40, endDaysAgo: 10, ads: 3, graveyard: "spend_winner" },
  { batch: "Jun289", fmt: "STATIC", lp: "LP1",        problem: "Loose stools", angle: "Guarantee",   targetUsd: 480,  roas: 1.12, days: 21, endDaysAgo: 14, ads: 2, graveyard: "loser" },
  { batch: "Jun292", fmt: "UGC",    lp: "LP2",        problem: "Mix",          angle: "Progression", targetUsd: 390,  roas: 0.84, days: 16, endDaysAgo: 9,  ads: 2, graveyard: "loser" },
  { batch: "Jun295", fmt: "VSL",    lp: "LP12",       problem: "LickingPaws",  angle: "Educational", targetUsd: 310,  roas: 2.9,  days: 6,  endDaysAgo: 0,  ads: 2 },
];

const dateStr = (d) => d.toISOString().split("T")[0];
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };
// Deterministic-ish noise
let seed = 42;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };

await wipe(); // idempotent re-runs

const now = new Date();
let insightRows = [];
let totalAds = 0;

for (let i = 0; i < SETS.length; i++) {
  const s = SETS[i];
  const num = String(i + 1).padStart(3, "0");
  const adsetId = `demo-js-${num}`;
  const name = `SE Josiah ${s.batch} - #1 - ${s.fmt} - ${s.lp} - Evergreen - ${s.problem.replace(/\s/g, "")} - Josiah`;

  await sql`
    insert into adset_owners (adset_id, video_editor_id, campaign_id, adset_name, angle, problem, verdict, verdict_at, graveyard_outcome, graveyard_at, source, backfilled_at, created_at, updated_at)
    values (${adsetId}, ${EDITOR_ID}, 'demo-js-campaign', ${name}, ${s.angle}, ${s.problem}, ${s.verdict ? "confirmed_winner" : null}, ${s.verdict ? now : null}, ${s.graveyard || null}, ${s.graveyard ? daysAgo(s.endDaysAgo) : null}, 'demo', ${now}, ${daysAgo(s.endDaysAgo + s.days)}, ${now})`;

  // Ads inside the set — H1 is the workhorse, the rest share the remainder.
  const adShares = [];
  let remaining = 1;
  for (let a = 0; a < s.ads; a++) {
    const share = a === s.ads - 1 ? remaining : (a === 0 ? 0.45 + rand() * 0.15 : remaining * (0.3 + rand() * 0.3));
    adShares.push(Math.max(share, 0.05));
    remaining = Math.max(remaining - share, 0.05);
  }

  for (let a = 0; a < s.ads; a++) {
    const adId = `${adsetId}-a${a + 1}`;
    const adName = `H${a + 1} ${name}`;
    const status = s.graveyard ? "PAUSED" : "ACTIVE";
    totalAds++;
    await sql`
      insert into ads_cache (id, adset_id, campaign_id, name, status, creative_id, synced_at)
      values (${adId}, ${adsetId}, 'demo-js-campaign', ${adName}, ${status}, null, ${now})`;

    // Daily curve: ramp up over the first ~25% of days, plateau, slight decay.
    const start = s.endDaysAgo + s.days;
    const totalSpendSek = s.targetUsd * RATE * adShares[a];
    const weights = [];
    for (let d = 0; d < s.days; d++) {
      const ramp = Math.min(d / Math.max(s.days * 0.25, 1), 1);
      const decay = 1 - Math.max((d - s.days * 0.7) / (s.days * 0.9), 0) * 0.4;
      weights.push(ramp * decay * (0.7 + rand() * 0.6));
    }
    const wSum = weights.reduce((x, y) => x + y, 0);

    // Per-ad ROAS varies around the set's blended target; per-day noise on top.
    const adRoas = s.roas * (0.85 + rand() * 0.3);
    const cpmSek = 90 + rand() * 45;
    const ctrPct = 1.4 + rand() * 1.8;
    const hookPct = 24 + rand() * 16;
    const holdPct = 34 + rand() * 22;
    const aovSek = 650 + rand() * 250;

    for (let d = 0; d < s.days; d++) {
      const date = dateStr(daysAgo(start - d));
      const spend = (totalSpendSek * weights[d]) / wSum;
      if (spend < 1) continue;
      const revenue = spend * adRoas * (0.55 + rand() * 0.9);
      const impressions = Math.round((spend / cpmSek) * 1000);
      const linkClicks = Math.round(impressions * (ctrPct / 100));
      const purchases = Math.max(Math.round(revenue / aovSek), revenue > aovSek * 0.5 ? 1 : 0);
      const v3 = Math.round(impressions * (hookPct / 100));
      const thru = Math.round(v3 * (holdPct / 100));
      insightRows.push({
        entity_id: adId, entity_type: "ad", date_start: date, date_stop: date,
        spend: Math.round(spend * 100) / 100,
        impressions, reach: Math.round(impressions * 0.72),
        clicks: Math.round(linkClicks * 1.6), link_clicks: linkClicks,
        ctr: ctrPct, cpc: linkClicks > 0 ? spend / linkClicks : 0, cpm: cpmSek,
        purchases, purchase_value: Math.round(revenue * 100) / 100,
        roas: spend > 0 ? revenue / spend : 0,
        video_views_3s: v3, video_thruplays: thru,
      });
    }
  }
}

// Bulk insert insights in chunks.
const CHUNK = 250;
for (let i = 0; i < insightRows.length; i += CHUNK) {
  const slice = insightRows.slice(i, i + CHUNK);
  await sql`
    insert into insights (entity_id, entity_type, date_start, date_stop, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, purchases, purchase_value, roas, video_views_3s, video_thruplays)
    select * from unnest(
      ${slice.map((r) => r.entity_id)}::text[],
      ${slice.map((r) => r.entity_type)}::text[],
      ${slice.map((r) => r.date_start)}::date[],
      ${slice.map((r) => r.date_stop)}::date[],
      ${slice.map((r) => r.spend)}::real[],
      ${slice.map((r) => r.impressions)}::int[],
      ${slice.map((r) => r.reach)}::int[],
      ${slice.map((r) => r.clicks)}::int[],
      ${slice.map((r) => r.link_clicks)}::int[],
      ${slice.map((r) => r.ctr)}::real[],
      ${slice.map((r) => r.cpc)}::real[],
      ${slice.map((r) => r.cpm)}::real[],
      ${slice.map((r) => r.purchases)}::int[],
      ${slice.map((r) => r.purchase_value)}::real[],
      ${slice.map((r) => r.roas)}::real[],
      ${slice.map((r) => r.video_views_3s)}::int[],
      ${slice.map((r) => r.video_thruplays)}::int[]
    )`;
}

console.log(`Seeded ${SETS.length} demo ad sets, ${totalAds} ads, ${insightRows.length} daily insight rows.`);
console.log("Run with --clean to remove everything again.");
