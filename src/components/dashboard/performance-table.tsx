"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Search, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
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
  cpa?: number;
}

interface PerformanceTableProps {
  campaigns: CampaignRow[];
  loading: boolean;
  onToggleStatus?: (id: string, newStatus: string) => void;
  onUpdateBudget?: (id: string, budget: number) => void;
}

function getRoasColor(roas: number): string {
  if (roas >= 3) return "text-cyan-400";
  if (roas >= 2) return "text-emerald-400";
  if (roas >= 1) return "text-amber-400";
  if (roas > 0) return "text-red-400";
  return "text-slate-500";
}

function RoasIndicator({ value }: { value: number }) {
  if (value >= 2) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400 inline ml-1" />;
  if (value >= 1) return <Minus className="h-3.5 w-3.5 text-amber-400 inline ml-1" />;
  return <TrendingDown className="h-3.5 w-3.5 text-red-400 inline ml-1" />;
}

function formatSEK(n: number): string {
  return `${n.toLocaleString("sv-SE", { maximumFractionDigits: 0 })} SEK`;
}

function getCpa(c: CampaignRow): number {
  return c.cpa ?? (c.purchases > 0 ? c.spend / c.purchases : 0);
}

/* ───── Mobile campaign card ───── */
function CampaignCard({
  c,
  onToggleStatus,
  onUpdateBudget,
}: {
  c: CampaignRow;
  onToggleStatus?: (id: string, newStatus: string) => void;
  onUpdateBudget?: (id: string, budget: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");
  const cpa = getCpa(c);

  const handleBudgetSave = () => {
    const val = parseFloat(budgetValue);
    if (!isNaN(val) && onUpdateBudget) onUpdateBudget(c.id, val);
    setEditingBudget(false);
  };

  return (
    <div className="border-b border-white/5 last:border-b-0">
      {/* Main row — always visible */}
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
          <div className="flex items-center gap-3 mt-1">
            <Badge
              className={cn(
                "text-[10px] px-1.5 py-0 font-medium border",
                c.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-500/10 text-slate-400 border-slate-500/30"
              )}
            >
              {c.status}
            </Badge>
            <span className="text-xs text-slate-400">{formatSEK(c.spend)}</span>
            <span className={cn("text-xs font-semibold", getRoasColor(c.roas))}>
              {c.roas > 0 ? `${c.roas.toFixed(2)}x` : "-"}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Status + Budget row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={c.status === "ACTIVE"}
                onCheckedChange={(checked) =>
                  onToggleStatus?.(c.id, checked ? "ACTIVE" : "PAUSED")
                }
              />
              <span className="text-xs text-slate-400">
                {c.status === "ACTIVE" ? "Active" : "Paused"}
              </span>
            </div>
            <div>
              {editingBudget ? (
                <Input
                  className="w-28 h-7 text-right text-sm bg-white/5 border-white/10"
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBudgetSave()}
                  onBlur={handleBudgetSave}
                  autoFocus
                />
              ) : (
                <button
                  className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                  onClick={() => {
                    setEditingBudget(true);
                    setBudgetValue(String(c.dailyBudget || 0));
                  }}
                >
                  Budget: {c.dailyBudget ? formatSEK(c.dailyBudget) : "-"}
                </button>
              )}
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2">
            <MetricCell label="Spend" value={formatSEK(c.spend)} />
            <MetricCell
              label="ROAS"
              value={c.roas > 0 ? `${c.roas.toFixed(2)}x` : "-"}
              valueClass={getRoasColor(c.roas)}
              icon={c.roas > 0 ? <RoasIndicator value={c.roas} /> : null}
            />
            <MetricCell label="Purchases" value={String(c.purchases)} />
            <MetricCell label="CPA" value={cpa > 0 ? formatSEK(cpa) : "-"} />
            <MetricCell label="CTR" value={`${c.ctr.toFixed(2)}%`} />
            <MetricCell label="CPC" value={c.cpc > 0 ? `${c.cpc.toFixed(2)} SEK` : "-"} />
            <MetricCell label="CPM" value={c.cpm > 0 ? `${c.cpm.toFixed(2)} SEK` : "-"} />
            <MetricCell label="Hook%" value={c.hookRate > 0 ? `${c.hookRate.toFixed(1)}%` : "-"} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  valueClass,
  icon,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-medium text-slate-200 tabular-nums", valueClass)}>
        {value}
        {icon}
      </p>
    </div>
  );
}

export function PerformanceTable({ campaigns, loading, onToggleStatus, onUpdateBudget }: PerformanceTableProps) {
  const [search, setSearch] = useState("");
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  const filtered = campaigns
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
      return b.spend - a.spend;
    });

  const handleBudgetSave = (id: string) => {
    const val = parseFloat(budgetValue);
    if (!isNaN(val) && onUpdateBudget) onUpdateBudget(id, val);
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
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/5">
        <h3 className="text-base font-semibold text-white">Campaigns</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-40 sm:w-56 h-8 bg-white/5 border-white/10 text-sm placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-slate-500 py-12">No campaigns found</div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="md:hidden">
            {filtered.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                onToggleStatus={onToggleStatus}
                onUpdateBudget={onUpdateBudget}
              />
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Campaign", "Status", "Budget", "Spend", "Purch.", "CPA", "ROAS", "CTR", "CPC", "CPM", "Hook%"].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap",
                        h === "Campaign" ? "text-left" : "text-right"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const cpa = getCpa(c);
                  return (
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
                            {c.dailyBudget ? formatSEK(c.dailyBudget) : "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300 tabular-nums">
                        {formatSEK(c.spend)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300 font-medium tabular-nums">
                        {c.purchases}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-400 tabular-nums">
                        {cpa > 0 ? formatSEK(cpa) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                        <span className={getRoasColor(c.roas)}>
                          {c.roas > 0 ? `${c.roas.toFixed(2)}x` : "-"}
                        </span>
                        {c.roas > 0 && <RoasIndicator value={c.roas} />}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300 tabular-nums">{c.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-400 tabular-nums">{c.cpc > 0 ? `${c.cpc.toFixed(2)} SEK` : "-"}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-400 tabular-nums">{c.cpm > 0 ? `${c.cpm.toFixed(2)} SEK` : "-"}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-400 tabular-nums">{c.hookRate > 0 ? `${c.hookRate.toFixed(1)}%` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
