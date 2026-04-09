import type { EvolveSettings } from "./settings";

export type ScalingStatus = "scaling" | "decreasing" | "holding" | "monitoring";

export interface ScalingDecision {
  action: "double" | "scale_20" | "hold" | "decrease_20" | "pause" | "monitor";
  reason: string;
  newStatus: ScalingStatus;
  budgetChange?: number; // multiplier: 2.0 = double, 1.2 = +20%, 0.8 = -20%
}

export interface EntityMetrics {
  roas: number;
  spend: number;
  dailyBudget: number;
  consecutiveDaysAboveTarget: number;
  consecutiveDaysBelowBreakeven: number;
  consecutiveDaysBelowTarget: number; // between breakeven and target
  clickPurchaseRatio?: number; // 0-1, percentage of purchases from clicks vs views
}

/**
 * Evolve Scaling Protocol — Decision Tree
 *
 * Exact rules from the Evolve course:
 *
 * 1. Hitting target KPI?
 *    YES → Consistent 2-3 days above target?
 *      YES → 60%+ click-based purchases?
 *        YES → 50%+ above KPI? → DOUBLE budget : Scale +20%
 *        NO/unknown → Scale +20% (always 20%, never less)
 *      NO → Monitor, wait for consistency
 *
 * 2. NOT hitting target KPI
 *    → Below breakeven 2+ days?
 *      YES → At minimum daily spend?
 *        YES → Consider pausing
 *        NO → Decrease 20%
 *      NO → Below target 2-3 days consistently?
 *        YES → Decrease 20%
 *        NO → Hold, monitor
 *
 * Key principles:
 * - Always scale minimum 20% (never 10%)
 * - Only double when ROAS is 50%+ above target AND 60%+ click purchases
 * - Always decrease minimum 20%
 * - Wait 2-3 days (scalingProtocolDays) for consistency before scaling
 * - Surf mode: separate logic (see surf-scaling.ts)
 */
export function evaluateScalingProtocol(
  entity: EntityMetrics,
  settings: EvolveSettings
): ScalingDecision {
  const {
    roas, spend, dailyBudget,
    consecutiveDaysAboveTarget,
    consecutiveDaysBelowBreakeven,
    consecutiveDaysBelowTarget,
    clickPurchaseRatio,
  } = entity;
  const { targetRoas, breakevenRoas, minDailySpend, scalingProtocolDays } = settings;

  // ── Step 1: Hitting target KPI? ──
  if (roas >= targetRoas) {
    // Consistent above target for protocol days (2-3 days)?
    if (consecutiveDaysAboveTarget >= scalingProtocolDays) {
      // Check if 60%+ purchases come from clicks (not view-through)
      const hasGoodClickRatio = clickPurchaseRatio !== undefined && clickPurchaseRatio >= 0.6;

      // 50%+ above KPI AND good click ratio → DOUBLE
      if (roas >= targetRoas * 1.5 && hasGoodClickRatio) {
        return {
          action: "double",
          reason: `ROAS ${roas.toFixed(2)}x är 50%+ över target i ${consecutiveDaysAboveTarget} dagar med ${clickPurchaseRatio !== undefined ? (clickPurchaseRatio * 100).toFixed(0) : "?"}% klick-köp — dubbla budgeten`,
          newStatus: "scaling",
          budgetChange: 2.0,
        };
      }

      // Otherwise → always scale +20%
      return {
        action: "scale_20",
        reason: `ROAS ${roas.toFixed(2)}x över target i ${consecutiveDaysAboveTarget} dagar — höj budgeten med 20%`,
        newStatus: "scaling",
        budgetChange: 1.2,
      };
    }

    // Not consistent yet — monitor and wait
    return {
      action: "monitor",
      reason: `ROAS ${roas.toFixed(2)}x över target men bara ${consecutiveDaysAboveTarget}/${scalingProtocolDays} dagar — vänta på konsistens`,
      newStatus: "monitoring",
    };
  }

  // ── Step 2: NOT hitting target KPI ──

  // Below breakeven for 2+ days?
  if (roas < breakevenRoas && consecutiveDaysBelowBreakeven >= 2) {
    // At minimum daily spend already?
    if (dailyBudget <= minDailySpend) {
      return {
        action: "pause",
        reason: `ROAS ${roas.toFixed(2)}x under breakeven i ${consecutiveDaysBelowBreakeven} dagar vid minimibudget — överväg att pausa`,
        newStatus: "decreasing",
        budgetChange: 0,
      };
    }
    return {
      action: "decrease_20",
      reason: `ROAS ${roas.toFixed(2)}x under breakeven i ${consecutiveDaysBelowBreakeven} dagar — sänk budgeten med 20%`,
      newStatus: "decreasing",
      budgetChange: 0.8,
    };
  }

  // Below breakeven but not 2+ days yet
  if (roas < breakevenRoas) {
    return {
      action: "monitor",
      reason: `ROAS ${roas.toFixed(2)}x under breakeven i ${consecutiveDaysBelowBreakeven} dag(ar) — övervakar innan åtgärd`,
      newStatus: "monitoring",
    };
  }

  // Between breakeven and target for 2-3+ days → decrease 20%
  if (consecutiveDaysBelowTarget >= scalingProtocolDays) {
    return {
      action: "decrease_20",
      reason: `ROAS ${roas.toFixed(2)}x under target i ${consecutiveDaysBelowTarget} dagar — sänk budgeten med 20%`,
      newStatus: "decreasing",
      budgetChange: 0.8,
    };
  }

  // Between breakeven and target, not long enough to act — hold
  return {
    action: "hold",
    reason: `ROAS ${roas.toFixed(2)}x mellan breakeven och target — håll nuvarande budget`,
    newStatus: "holding",
  };
}
