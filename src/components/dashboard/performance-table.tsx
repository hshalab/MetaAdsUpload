"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget: number;
  spend: number;
  impressions: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  roas: number;
  hookRate: number;
  holdRate: number;
}

interface PerformanceTableProps {
  campaigns: CampaignRow[];
  loading: boolean;
  onToggleStatus?: (id: string, newStatus: string) => void;
  onUpdateBudget?: (id: string, budget: number) => void;
}

function RoasIndicator({ value }: { value: number }) {
  if (value >= 2) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400 inline ml-1" />;
  if (value >= 1) return <Minus className="h-3.5 w-3.5 text-amber-400 inline ml-1" />;
  return <TrendingDown className="h-3.5 w-3.5 text-red-400 inline ml-1" />;
}

export function PerformanceTable({ campaigns, loading, onToggleStatus, onUpdateBudget }: PerformanceTableProps) {
  const [search, setSearch] = useState("");
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleBudgetSave = (id: string) => {
    const val = parseFloat(budgetValue);
    if (!isNaN(val) && onUpdateBudget) {
      onUpdateBudget(id, val);
    }
    setEditingBudget(null);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#111827] p-12 text-center">
        <div className="animate-pulse text-slate-400">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 className="text-base font-semibold text-white">Campaigns</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-56 h-8 bg-white/5 border-white/10 text-sm placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {["Campaign", "Status", "Budget", "Spend", "Impr.", "Clicks", "CTR", "CPC", "CPM", "Purch.", "ROAS", "Hook%"].map((h) => (
                <th
                  key={h}
                  className={cn(
                    "px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider",
                    h === "Campaign" ? "text-left" : "text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center text-slate-500 py-12">
                  No campaigns found
                </td>
              </tr>
            ) : (
              filtered.map((c, i) => (
                <tr
                  key={c.id}
                  className={cn(
                    "border-b border-white/5 transition-colors hover:bg-white/[0.02]",
                    i % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-200 max-w-[200px] truncate">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={c.status === "ACTIVE"}
                        onCheckedChange={(checked) =>
                          onToggleStatus?.(c.id, checked ? "ACTIVE" : "PAUSED")
                        }
                      />
                      <Badge
                        className={cn(
                          "text-[10px] px-2 py-0.5 font-medium border",
                          c.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                        )}
                      >
                        {c.status}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-300">
                    {editingBudget === c.id ? (
                      <Input
                        className="w-24 h-7 text-right bg-white/5 border-white/10 ml-auto"
                        value={budgetValue}
                        onChange={(e) => setBudgetValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleBudgetSave(c.id)}
                        onBlur={() => handleBudgetSave(c.id)}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-cyan-400 transition-colors"
                        onClick={() => {
                          setEditingBudget(c.id);
                          setBudgetValue(String(c.dailyBudget || 0));
                        }}
                      >
                        {c.dailyBudget ? `${c.dailyBudget.toLocaleString()} SEK` : "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-300">
                    {c.spend.toLocaleString("sv-SE", { maximumFractionDigits: 0 })} SEK
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-400">
                    {c.impressions.toLocaleString("sv-SE")}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-400">
                    {c.linkClicks.toLocaleString("sv-SE")}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-300">{c.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-400">{c.cpc.toFixed(2)} SEK</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-400">{c.cpm.toFixed(2)} SEK</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-300">{c.purchases}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">
                    <span className={cn(
                      c.roas >= 2 ? "text-emerald-400" : c.roas >= 1 ? "text-amber-400" : "text-red-400"
                    )}>
                      {c.roas.toFixed(2)}x
                    </span>
                    <RoasIndicator value={c.roas} />
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-400">{c.hookRate.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
