import type { EvolveSettings } from "./settings";

export type ScalingStatus = "scaling" | "decreasing" | "holding" | "monitoring";

export interface ScalingDecision {
  action: "double" | "scale_20" | "scale_10" | "hold" | "decrease_20" | "pause" | "monitor";
  reason: string;
  newStatus: ScalingStatus;
}

export interface EntityMetrics {
  roas: number;
  spend: number;
  dailyBudget: number;
  consecutiveDaysAboveTarget: number;
  consecutiveDaysBelowBreakeven: number;
  clickPurchaseRatio?: number; // 0-1, percentage of purchases from clicks vs views
}

export function evaluateScalingProtocol(
  entity: EntityMetrics,
  settings: EvolveSettings
): ScalingDecision {
  const { roas, spend, dailyBudget, consecutiveDaysAboveTarget, consecutiveDaysBelowBreakeven, clickPurchaseRatio } = entity;
  const { targetRoas, breakevenRoas, minDailySpend, scalingProtocolDays } = settings;

  // Is it hitting target KPI?
  if (roas >= targetRoas) {
    // Consistent above target for protocol days?
    if (consecutiveDaysAboveTarget >= scalingProtocolDays) {
      // Check click-based purchases
      if (clickPurchaseRatio !== undefined && clickPurchaseRatio >= 0.6) {
        // 50%+ above KPI? → Double
        if (roas >= targetRoas * 1.5) {
          return {
            action: "double",
            reason: `ROAS ${roas.toFixed(2)}x is 50%+ above target for ${consecutiveDaysAboveTarget}d with ${(clickPurchaseRatio * 100).toFixed(0)}% click purchases — double budget`,
            newStatus: "scaling",
          };
        }
        // Otherwise scale 20%
        return {
          action: "scale_20",
          reason: `ROAS ${roas.toFixed(2)}x above target for ${consecutiveDaysAboveTarget}d with ${(clickPurchaseRatio * 100).toFixed(0)}% click purchases — scale +20%`,
          newStatus: "scaling",
        };
      }
      // Unknown or low click ratio — scale cautiously
      return {
        action: "scale_10",
        reason: `ROAS ${roas.toFixed(2)}x above target for ${consecutiveDaysAboveTarget}d — scale cautiously +10%`,
        newStatus: "scaling",
      };
    }
    // Not consistent yet — monitor
    return {
      action: "monitor",
      reason: `ROAS ${roas.toFixed(2)}x above target but only ${consecutiveDaysAboveTarget}d/${scalingProtocolDays}d — wait for consistency`,
      newStatus: "monitoring",
    };
  }

  // NOT hitting target KPI
  // Below breakeven for extended period?
  if (roas < breakevenRoas) {
    if (consecutiveDaysBelowBreakeven >= 2) {
      // At minimum daily spend?
      if (dailyBudget <= minDailySpend) {
        return {
          action: "pause",
          reason: `ROAS ${roas.toFixed(2)}x below breakeven for ${consecutiveDaysBelowBreakeven}d at minimum budget — consider pausing`,
          newStatus: "decreasing",
        };
      }
      return {
        action: "decrease_20",
        reason: `ROAS ${roas.toFixed(2)}x below breakeven for ${consecutiveDaysBelowBreakeven}d — decrease 20%`,
        newStatus: "decreasing",
      };
    }
    // Just started dipping — hold and monitor
    return {
      action: "monitor",
      reason: `ROAS ${roas.toFixed(2)}x below breakeven for ${consecutiveDaysBelowBreakeven}d — monitoring before action`,
      newStatus: "monitoring",
    };
  }

  // Between breakeven and target — holding zone
  return {
    action: "hold",
    reason: `ROAS ${roas.toFixed(2)}x between breakeven and target — hold current budget`,
    newStatus: "holding",
  };
}
