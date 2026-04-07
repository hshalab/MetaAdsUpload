import type { EvolveSettings } from "./settings";

export type Classification = "breakthrough" | "spend_winner" | "kpi_winner" | "loser" | "new";

export interface ClassificationResult {
  classification: Classification;
  recommendation: string;
}

export interface AdMetrics {
  spend: number;
  roas: number;
  cpa: number;
  purchases: number;
  ageDays: number;
}

export function classifyAd(metrics: AdMetrics, settings: EvolveSettings): ClassificationResult {
  const { spend, roas, cpa, purchases, ageDays } = metrics;
  const { targetRoas, breakevenRoas, targetCpa, learningPeriodDays } = settings;

  // New: still in learning period
  if (ageDays < learningPeriodDays) {
    return {
      classification: "new",
      recommendation: `Day ${ageDays}/${learningPeriodDays} — let it run through learning period`,
    };
  }

  const spendVsCpa = targetCpa > 0 ? spend / targetCpa : 0;

  // Breakthrough: spent > 3x CPA AND hitting target ROAS
  if (spendVsCpa >= 3 && roas >= targetRoas) {
    return {
      classification: "breakthrough",
      recommendation: `ROAS ${roas.toFixed(2)}x on ${spend.toFixed(0)} SEK spend — Duplicate to ABO, scale 10-20% budget`,
    };
  }

  // Spend Winner: spent > 3x CPA, above breakeven but below target
  if (spendVsCpa >= 3 && roas >= breakevenRoas && roas < targetRoas) {
    return {
      classification: "spend_winner",
      recommendation: `ROAS ${roas.toFixed(2)}x with good spend — Duplicate to ABO, throttle 5-10% budget`,
    };
  }

  // KPI Winner: hitting target ROAS but low spend (< 1x CPA)
  if (roas >= targetRoas && spendVsCpa < 1) {
    return {
      classification: "kpi_winner",
      recommendation: `ROAS ${roas.toFixed(2)}x but only ${spend.toFixed(0)} SEK spent — Duplicate to ABO, give more budget`,
    };
  }

  // Loser: not hitting KPI after learning period
  return {
    classification: "loser",
    recommendation: `ROAS ${roas.toFixed(2)}x after ${ageDays} days — Move to Zombie or pause`,
  };
}

export const CLASSIFICATION_CONFIG: Record<Classification, { label: string; color: string; bg: string; border: string }> = {
  breakthrough: { label: "Breakthrough", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  spend_winner: { label: "Spend Winner", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  kpi_winner: { label: "KPI Winner", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  loser: { label: "Loser", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  new: { label: "New", color: "text-slate-400", bg: "bg-white/5", border: "border-white/10" },
};
