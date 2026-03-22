"use client";

import { DollarSign, Eye, TrendingUp, TrendingDown, Target, ShoppingCart, Receipt, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardsProps {
  summary: {
    spend: number;
    impressions: number;
    linkClicks: number;
    ctr: number;
    roas: number;
    purchases?: number;
    cpa?: number;
  } | null;
  loading: boolean;
}

function getRoasColor(roas: number): string {
  if (roas >= 3) return "text-cyan-400";
  if (roas >= 2) return "text-emerald-400";
  if (roas >= 1) return "text-amber-400";
  if (roas > 0) return "text-red-400";
  return "text-slate-500";
}

function getRoasIcon(roas: number) {
  if (roas >= 2) return TrendingUp;
  if (roas >= 1) return Minus;
  if (roas > 0) return TrendingDown;
  return Minus;
}

export function KPICards({ summary, loading }: KPICardsProps) {
  const roasValue = summary?.roas ?? 0;
  const RoasIcon = getRoasIcon(roasValue);

  const cards = [
    {
      title: "Total Spend",
      value: summary ? `${summary.spend.toLocaleString("sv-SE", { maximumFractionDigits: 0 })} SEK` : "-",
      icon: DollarSign,
      glow: "glow-cyan",
      iconBg: "bg-cyan-500/10",
      iconColor: "text-cyan-400",
      valueColor: "text-white",
    },
    {
      title: "Impressions",
      value: summary ? formatCompact(summary.impressions) : "-",
      icon: Eye,
      glow: "glow-purple",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      valueColor: "text-white",
    },
    {
      title: "Purchases",
      value: summary ? (summary.purchases ?? 0).toLocaleString("sv-SE") : "-",
      icon: ShoppingCart,
      glow: "glow-green",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      valueColor: "text-white",
    },
    {
      title: "ROAS",
      value: summary ? `${roasValue.toFixed(2)}x` : "-",
      icon: RoasIcon,
      glow: roasValue >= 2 ? "glow-green" : roasValue >= 1 ? "glow-amber" : "glow-cyan",
      iconBg: roasValue >= 2 ? "bg-emerald-500/10" : roasValue >= 1 ? "bg-amber-500/10" : "bg-red-500/10",
      iconColor: getRoasColor(roasValue),
      valueColor: getRoasColor(roasValue),
    },
    {
      title: "CPA",
      value: summary && (summary.cpa ?? 0) > 0
        ? `${(summary.cpa ?? 0).toLocaleString("sv-SE", { maximumFractionDigits: 0 })} SEK`
        : "-",
      icon: Receipt,
      glow: "glow-blue",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      valueColor: "text-white",
    },
    {
      title: "CTR",
      value: summary ? `${summary.ctr.toFixed(2)}%` : "-",
      icon: Target,
      glow: "glow-cyan",
      iconBg: "bg-cyan-500/10",
      iconColor: "text-cyan-400",
      valueColor: "text-white",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={cn(
            "rounded-xl border bg-[#111827] p-4 transition-all duration-300 hover:scale-[1.02]",
            card.glow
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {card.title}
            </span>
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", card.iconBg)}>
              <card.icon className={cn("h-4 w-4", card.iconColor)} />
            </div>
          </div>
          <div className={cn(
            "text-xl sm:text-2xl font-bold tabular-nums",
            card.valueColor,
            loading && "animate-pulse"
          )}>
            {loading ? "..." : card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("sv-SE");
}
