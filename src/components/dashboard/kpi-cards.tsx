"use client";

import { DollarSign, Eye, MousePointerClick, TrendingUp, Target, ShoppingCart, Receipt } from "lucide-react";
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

export function KPICards({ summary, loading }: KPICardsProps) {
  const cards = [
    {
      title: "Total Spend",
      value: summary ? `${summary.spend.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} SEK` : "-",
      icon: DollarSign,
      glow: "glow-cyan",
      iconBg: "bg-cyan-500/10",
      iconColor: "text-cyan-400",
    },
    {
      title: "Impressions",
      value: summary ? formatCompact(summary.impressions) : "-",
      icon: Eye,
      glow: "glow-purple",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
    },
    {
      title: "Purchases",
      value: summary ? (summary.purchases ?? 0).toLocaleString("sv-SE") : "-",
      icon: ShoppingCart,
      glow: "glow-green",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      title: "ROAS",
      value: summary ? `${summary.roas.toFixed(2)}x` : "-",
      icon: TrendingUp,
      glow: "glow-amber",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
    },
    {
      title: "CPA",
      value: summary && (summary.cpa ?? 0) > 0
        ? `${(summary.cpa ?? 0).toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} SEK`
        : "-",
      icon: Receipt,
      glow: "glow-blue",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      title: "CTR",
      value: summary ? `${summary.ctr.toFixed(2)}%` : "-",
      icon: Target,
      glow: "glow-cyan",
      iconBg: "bg-cyan-500/10",
      iconColor: "text-cyan-400",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={cn(
            "rounded-xl border bg-[#111827] p-4 transition-all duration-300 hover:scale-[1.02]",
            card.glow
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {card.title}
            </span>
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", card.iconBg)}>
              <card.icon className={cn("h-4 w-4", card.iconColor)} />
            </div>
          </div>
          <div className={cn("text-2xl font-bold text-white", loading && "animate-pulse")}>
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
