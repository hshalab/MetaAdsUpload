import type { EvolveSettings } from "./settings";

export interface SurfDecision {
  action: "double" | "scale_20" | "hold" | "decrease_20" | "pause";
  reason: string;
}

export interface SurfMetrics {
  roas: number;
  spend: number;
  dailyBudget: number;
}

/**
 * Surf Mode: Simplified aggressive scaling for promo / launch periods.
 * - 50-100%+ above KPI → double budget
 * - 20-50% above → +20%
 * - At KPI → hold
 * - Below KPI → -20%
 * - Well below breakeven → pause
 */
export function evaluateSurfScaling(
  entity: SurfMetrics,
  settings: EvolveSettings
): SurfDecision {
  const { roas, spend, dailyBudget } = entity;
  const { targetRoas, breakevenRoas, minDailySpend } = settings;

  // Way below breakeven — stop spending
  if (roas < breakevenRoas * 0.7 && spend > minDailySpend) {
    return {
      action: "pause",
      reason: `SURF: ROAS ${roas.toFixed(2)}x well below breakeven — pause to protect budget`,
    };
  }

  // Below breakeven — decrease
  if (roas < breakevenRoas) {
    return {
      action: "decrease_20",
      reason: `SURF: ROAS ${roas.toFixed(2)}x below breakeven — decrease 20%`,
    };
  }

  // Between breakeven and target — hold
  if (roas < targetRoas) {
    return {
      action: "hold",
      reason: `SURF: ROAS ${roas.toFixed(2)}x between breakeven and target — hold`,
    };
  }

  // 50%+ above target → double
  if (roas >= targetRoas * 1.5) {
    return {
      action: "double",
      reason: `SURF: ROAS ${roas.toFixed(2)}x is 50%+ above target — double budget!`,
    };
  }

  // 20-50% above target → scale 20%
  if (roas >= targetRoas * 1.2) {
    return {
      action: "scale_20",
      reason: `SURF: ROAS ${roas.toFixed(2)}x is 20%+ above target — scale +20%`,
    };
  }

  // At target — hold
  return {
    action: "hold",
    reason: `SURF: ROAS ${roas.toFixed(2)}x at target — hold current budget`,
  };
}
