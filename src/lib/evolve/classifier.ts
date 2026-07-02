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
  /** Whether this ad is the top spender in its campaign */
  isTopSpender?: boolean;
  /** Share of total campaign spend this ad gets (0-1) */
  spendShare?: number;
}

/**
 * Evolve Ad Classifier — CBO-only workflow
 *
 * Core rules from Evolve course:
 *
 * 1. 3x CPA RULE: Don't judge an ad until it has spent 3x your target CPA.
 *
 * 2. TOP SPENDER RULE: Never turn off a top-spending ad that's at/above KPI.
 *    "If I 3x'd the budget on a smaller ad, would it beat the top spender?" → Almost never.
 *    Instead, make better creatives — the old top spender will lose spend naturally.
 *
 * 3. NEW AD SUCKING SPEND: If a new ad sucks up all spend with bad KPI:
 *    - Wait 1-2 days. Meta usually pulls spend back automatically.
 *    - If still eating all spend with shit KPI after 2 days → turn off.
 *    - At 20K+/day: have safety rules as backup.
 *
 * 4. AD NOT GETTING SPEND: If an ad isn't getting spend AND isn't at KPI
 *    after the learning period → turn off. It's dead weight.
 *
 * 5. ACCOUNT-LEVEL THINKING: If the overall account is at KPI, individual
 *    ad sets being below KPI is fine. Don't micro-optimize.
 *
 * Classifications:
 * - Breakthrough: ≥3x CPA spent + ROAS ≥ target → Keep!
 * - Spend Winner: ≥3x CPA spent + ROAS between breakeven & target → Graveyard with cost cap
 * - KPI Winner: ROAS ≥ target but <3x CPA spent → Promising, let run
 * - Loser: below breakeven after ≥3x CPA spent → Turn off or Graveyard
 * - New: still in learning / not enough spend to judge
 */
export function classifyAd(metrics: AdMetrics, settings: EvolveSettings): ClassificationResult {
  const { spend, roas, cpa, purchases, ageDays, isTopSpender, spendShare } = metrics;
  const { targetRoas, breakevenRoas, targetCpa, learningPeriodDays } = settings;

  const spendVsCpa = targetCpa > 0 ? spend / targetCpa : 0;
  const spendThreshold = targetCpa * 3;
  const isSuckingSpend = (spendShare || 0) > 0.5; // >50% of campaign spend

  // ── NEW: still in learning period ──
  if (ageDays < learningPeriodDays) {
    // Early breakthrough: already spent 3x CPA with great ROAS
    if (spendVsCpa >= 3 && roas >= targetRoas) {
      return {
        classification: "breakthrough",
        recommendation: `ROAS ${roas.toFixed(2)}x at ${spend.toFixed(0)} SEK already during learning — Top result!`,
      };
    }

    // New ad sucking all spend with bad KPI
    if (isSuckingSpend && roas < breakevenRoas && ageDays >= 2) {
      return {
        classification: "loser",
        recommendation: `Absorbing ${((spendShare || 0) * 100).toFixed(0)}% of spend at ${roas.toFixed(2)}x ROAS for ${ageDays} days — turn it off. Meta did not reduce spend.`,
      };
    }

    if (isSuckingSpend && roas < breakevenRoas && ageDays < 2) {
      return {
        classification: "new",
        recommendation: `Absorbing spend at ${roas.toFixed(2)}x ROAS — wait 1-2 days. Meta usually reduces spend automatically.`,
      };
    }

    return {
      classification: "new",
      recommendation: `Dag ${ageDays}/${learningPeriodDays} — ${spend.toFixed(0)}/${spendThreshold.toFixed(0)} SEK spent. Let it run.`,
    };
  }

  // ── NOT ENOUGH SPEND to judge (< 3x CPA) ──
  if (spendVsCpa < 3) {
    // Hitting target ROAS with some purchases — promising
    if (roas >= targetRoas && purchases > 0) {
      return {
        classification: "kpi_winner",
        recommendation: `ROAS ${roas.toFixed(2)}x men bara ${spend.toFixed(0)}/${spendThreshold.toFixed(0)} SEK spent — promising, let it run.`,
      };
    }

    // Zero spend or zero purchases with bad ROAS after learning period → dead
    if (spend === 0 || (purchases === 0 && ageDays > learningPeriodDays)) {
      return {
        classification: "loser",
        recommendation: spend === 0
          ? `No spend after ${ageDays} days — getting no distribution. Turn it off.`
          : `${spend.toFixed(0)} SEK spent, 0 purchases after ${ageDays} days — turn it off.`,
      };
    }

    // Minimal spend after 3+ days — zombie ad getting no distribution
    if (spend > 0 && spend < targetCpa && ageDays >= 3 && roas < breakevenRoas) {
      return {
        classification: "loser",
        recommendation: `Minimal spend (${spend.toFixed(0)} SEK) after ${ageDays} days — getting no distribution. Move to Graveyard.`,
      };
    }

    // Above breakeven but low spend — let it run for more data
    if (roas >= breakevenRoas) {
      return {
        classification: "kpi_winner",
        recommendation: `ROAS ${roas.toFixed(2)}x at ${spend.toFixed(0)} SEK — needs more data (${spendVsCpa.toFixed(1)}x of 3x CPA). Let it run.`,
      };
    }

    // Below breakeven, hasn't hit 3x CPA — too early to kill, but watch it
    return {
      classification: "new",
      recommendation: `ROAS ${roas.toFixed(2)}x below breakeven, but only ${spendVsCpa.toFixed(1)}x CPA spent. Wait until 3x CPA (${spendThreshold.toFixed(0)} SEK).`,
    };
  }

  // ── SPENT ≥ 3x CPA — we can judge ──

  // BREAKTHROUGH: at/above target ROAS
  if (roas >= targetRoas) {
    if (isTopSpender) {
      return {
        classification: "breakthrough",
        recommendation: `ROAS ${roas.toFixed(2)}x at ${spend.toFixed(0)} SEK — Top spender + best KPI. Do NOT touch it. Make better creatives instead.`,
      };
    }
    return {
      classification: "breakthrough",
      recommendation: `ROAS ${roas.toFixed(2)}x at ${spend.toFixed(0)} SEK — Top result! Let it run.`,
    };
  }

  // SPEND WINNER: above breakeven but below target
  if (roas >= breakevenRoas) {
    if (isTopSpender) {
      return {
        classification: "spend_winner",
        recommendation: `ROAS ${roas.toFixed(2)}x — profitable top spender. Do not turn it off — make better creatives and it loses spend naturally. Or move to Graveyard.`,
      };
    }
    return {
      classification: "spend_winner",
      recommendation: `ROAS ${roas.toFixed(2)}x — profitable but below target (${targetRoas}x). Move to Graveyard with a cost cap.`,
    };
  }

  // LOSER: below breakeven after sufficient spend
  if (isTopSpender) {
    return {
      classification: "loser",
      recommendation: `ROAS ${roas.toFixed(2)}x below breakeven, top spender — turn it off and focus on new creatives. Move to Graveyard.`,
    };
  }

  return {
    classification: "loser",
    recommendation: `ROAS ${roas.toFixed(2)}x below breakeven after ${spend.toFixed(0)} SEK — turn it off or move to Graveyard.`,
  };
}

export const CLASSIFICATION_CONFIG: Record<Classification, { label: string; color: string; bg: string; border: string }> = {
  breakthrough: { label: "Breakthrough", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  spend_winner: { label: "Spend Winner", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  kpi_winner: { label: "KPI Winner", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  loser: { label: "Loser", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  new: { label: "New", color: "text-slate-400", bg: "bg-white/5", border: "border-white/10" },
};
