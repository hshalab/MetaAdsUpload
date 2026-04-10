"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Eye,
  Skull,
  Sparkles,
  Loader2,
  Target,
  Copy,
  Calendar,
  MoreHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface AdsetData {
  id: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
  cpm: number;
  zone: "scale" | "hold" | "watch" | "kill" | "new";
  suggestion: string;
  ncRoas: number | null;
  ncRevenue: number;
}

interface ScalingData {
  thresholds: { breakeven: number; hold: number; target: number };
  settings?: { targetRoas: number; holdRoas: number; breakevenRoas: number; targetCpa: number; surfModeEnabled: boolean };
  summary: {
    totalSpend: number;
    totalRevenue: number;
    totalPurchases: number;
    overallRoas: number;
    totalDailyBudget: number;
    totalAdsets: number;
    zoneCounts: Record<string, number>;
  };
  adsets: AdsetData[];
  dateRange: { since: string; until: string; days: number };
}

interface Campaign {
  id: string;
  name: string;
}

const ZONE_CONFIG = {
  scale: {
    label: "Scale",
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    desc: "ROAS > 2.0 — Increase budget",
  },
  hold: {
    label: "Hold",
    icon: CheckCircle,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    desc: "ROAS 1.7–2.0 — Let it run",
  },
  watch: {
    label: "Watch",
    icon: Eye,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    desc: "ROAS 1.42–1.7 — Monitor closely",
  },
  kill: {
    label: "Kill",
    icon: Skull,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    desc: "ROAS < 1.42 — Below breakeven",
  },
  new: {
    label: "New",
    icon: Sparkles,
    color: "text-slate-400",
    bg: "bg-white/5",
    border: "border-white/10",
    desc: "Not enough spend data",
  },
};

type DateMode = "preset" | "today" | "custom";

export default function ScalingPage() {
  const [data, setData] = useState<ScalingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [dateMode, setDateMode] = useState<DateMode>("preset");
  const [presetDays, setPresetDays] = useState(7);
  const [customFrom, setCustomFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "PAUSED" | "ALL">("ACTIVE");
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  // Row action menu
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Duplicate dialog
  const [duplicateAdset, setDuplicateAdset] = useState<AdsetData | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateTarget, setDuplicateTarget] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Custom budget dialog
  const [budgetAdset, setBudgetAdset] = useState<AdsetData | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    if (dateMode === "today") {
      params.set("days", "0");
    } else if (dateMode === "custom") {
      params.set("since", customFrom);
      params.set("until", customTo);
    } else {
      params.set("days", String(presetDays));
    }
    return `/api/meta/scaling?${params}`;
  }, [dateMode, presetDays, customFrom, customTo, statusFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl());
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch");
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch campaigns for duplicate dialog
  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/meta/campaigns");
      const d = await res.json();
      setCampaigns(d.data || []);
    } catch { /* ignore */ }
  };

  const executeActions = async (actions: Array<{ adsetId: string; type: string; value?: number }>) => {
    setActing(true);
    try {
      const res = await fetch("/api/meta/scaling", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      const result = await res.json();
      const successes = result.results?.filter((r: { success: boolean }) => r.success).length || 0;
      const failures = result.results?.filter((r: { success: boolean }) => !r.success).length || 0;
      if (successes > 0) toast.success(`${successes} action(s) completed`);
      if (failures > 0) toast.error(`${failures} action(s) failed`);
      setSelected(new Set());
      fetchData();
    } catch {
      toast.error("Failed to execute actions");
    } finally {
      setActing(false);
    }
  };

  const handleBulkAction = (type: string, value?: number) => {
    const ids = Array.from(selected);
    if (ids.length === 0) { toast.error("Select ad sets first"); return; }
    executeActions(ids.map((id) => ({ adsetId: id, type, value })));
  };

  const handleSingleAction = (adsetId: string, type: string, value?: number) => {
    setOpenMenu(null);
    executeActions([{ adsetId, type, value }]);
  };

  const handleDuplicate = (adset: AdsetData) => {
    setOpenMenu(null);
    setDuplicateAdset(adset);
    setDuplicateName(`${adset.name} (copy)`);
    setDuplicateTarget("");
    fetchCampaigns();
  };

  const handleDuplicateSubmit = async () => {
    if (!duplicateAdset || !duplicateTarget) return;
    setDuplicating(true);
    try {
      const res = await fetch("/api/meta/adsets/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAdsetId: duplicateAdset.id,
          targetCampaignId: duplicateTarget,
          newName: duplicateName,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to duplicate");
      toast.success(`Duplicated ad set with ${d.totalAds} ads`);
      setDuplicateAdset(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setDuplicating(false);
    }
  };

  const handleSetBudget = (adset: AdsetData) => {
    setOpenMenu(null);
    setBudgetAdset(adset);
    setBudgetValue(adset.dailyBudget ? adset.dailyBudget.toFixed(0) : "");
  };

  const handleBudgetSubmit = () => {
    if (!budgetAdset || !budgetValue) return;
    const cents = Math.round(parseFloat(budgetValue) * 100);
    executeActions([{ adsetId: budgetAdset.id, type: "set_budget", value: cents }]);
    setBudgetAdset(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selected.size === filteredAdsets.length) setSelected(new Set());
    else setSelected(new Set(filteredAdsets.map((a) => a.id)));
  };

  const filteredAdsets = data?.adsets.filter((a) => !zoneFilter || a.zone === zoneFilter) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target className="h-6 w-6 text-cyan-400" />
            Scaling Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Breakeven: {data?.thresholds.breakeven ?? 1.42}x &middot; Hold: {data?.thresholds.hold ?? 1.7}x &middot; Scale: {data?.thresholds.target ?? 2.0}x
            {data?.settings?.surfModeEnabled && <span className="ml-2 text-amber-400 text-xs font-medium">[SURF MODE]</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(["ACTIVE", "PAUSED", "ALL"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all",
                  statusFilter === s ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Paused"}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => { setDateMode("today"); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                dateMode === "today" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              Today
            </button>
            {[3, 7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => { setDateMode("preset"); setPresetDays(d); }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all",
                  dateMode === "preset" && presetDays === d ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                {d}d
              </button>
            ))}
            <button
              onClick={() => setDateMode("custom")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                dateMode === "custom" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Custom date picker */}
      {dateMode === "custom" && (
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#111827] p-3">
          <Calendar className="h-4 w-4 text-slate-500" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark]"
            />
            <span className="text-slate-500 text-sm">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark]"
            />
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-all"
          >
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-white/5 bg-[#111827] py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Could not load scaling data</h3>
          <p className="text-slate-500 mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all">
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Total Spend", value: `${data.summary.totalSpend.toFixed(0)} SEK`, color: "text-white" },
              { label: "Revenue", value: `${data.summary.totalRevenue.toFixed(0)} SEK`, color: "text-white" },
              { label: "ROAS", value: `${data.summary.overallRoas.toFixed(2)}x`, color: data.summary.overallRoas >= data.thresholds.target ? "text-emerald-400" : data.summary.overallRoas >= data.thresholds.breakeven ? "text-amber-400" : "text-red-400" },
              { label: "Purchases", value: data.summary.totalPurchases.toString(), color: "text-white" },
              { label: "Daily Budget", value: `${data.summary.totalDailyBudget.toFixed(0)} SEK`, color: "text-white" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-white/5 bg-[#111827] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                  <span className={cn("text-xl font-bold", kpi.color)}>{kpi.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Zone Summary Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setZoneFilter(null)}
              className={cn(
                "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                !zoneFilter ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
              )}
            >
              All ({data.summary.totalAdsets})
            </button>
            {(["scale", "hold", "watch", "kill", "new"] as const).map((zone) => {
              const config = ZONE_CONFIG[zone];
              const count = data.summary.zoneCounts[zone] || 0;
              const ZoneIcon = config.icon;
              return (
                <button
                  key={zone}
                  onClick={() => setZoneFilter(zoneFilter === zone ? null : zone)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    zoneFilter === zone ? cn(config.bg, config.color, config.border) : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  )}
                >
                  <ZoneIcon className="h-4 w-4" />
                  {config.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Bulk Actions Bar */}
          {selected.size > 0 && (
            <div className="sticky top-0 z-10 rounded-xl border border-cyan-500/20 bg-[#111827]/95 backdrop-blur p-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm text-cyan-400 font-medium">
                {selected.size} ad set{selected.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleBulkAction("adjust_budget", 30)} disabled={acting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                  <ChevronUp className="h-3.5 w-3.5" /> +30%
                </button>
                <button onClick={() => handleBulkAction("adjust_budget", 20)} disabled={acting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                  <ChevronUp className="h-3.5 w-3.5" /> +20%
                </button>
                <button onClick={() => handleBulkAction("adjust_budget", 10)} disabled={acting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                  <ChevronUp className="h-3.5 w-3.5" /> +10%
                </button>
                <button onClick={() => handleBulkAction("adjust_budget", -20)} disabled={acting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50">
                  <ChevronDown className="h-3.5 w-3.5" /> -20%
                </button>
                <button onClick={() => handleBulkAction("adjust_budget", -50)} disabled={acting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                  <ChevronDown className="h-3.5 w-3.5" /> -50%
                </button>
                <div className="w-px h-6 bg-white/10" />
                <button onClick={() => handleBulkAction("pause")} disabled={acting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                  <Pause className="h-3.5 w-3.5" /> Pause
                </button>
                <button onClick={() => handleBulkAction("activate")} disabled={acting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                  <Play className="h-3.5 w-3.5" /> Activate
                </button>
                {acting && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
              </div>
            </div>
          )}

          {/* Ad Sets Table */}
          <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={filteredAdsets.length > 0 && selected.size === filteredAdsets.length} onChange={toggleSelectAll} className="rounded border-white/20 bg-white/5" />
                  </th>
                  <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Zone</th>
                  <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Ad Set</th>
                  <th className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider px-2 py-3">Status</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Budget</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Spend</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Revenue</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">ROAS</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">ncROAS</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Purch.</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">CPA</th>
                  <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Suggestion</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdsets.map((adset) => {
                  const zoneConfig = ZONE_CONFIG[adset.zone];
                  const ZoneIcon = zoneConfig.icon;
                  const menuOpen = openMenu === adset.id;
                  return (
                    <tr
                      key={adset.id}
                      className={cn(
                        "border-b border-white/5 hover:bg-white/[0.02] transition-colors",
                        selected.has(adset.id) && "bg-cyan-500/[0.03]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(adset.id)} onChange={() => toggleSelect(adset.id)} className="rounded border-white/20 bg-white/5" />
                      </td>
                      <td className="px-4 py-3">
                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border", zoneConfig.bg, zoneConfig.color, zoneConfig.border)}>
                          <ZoneIcon className="h-3 w-3" />
                          {zoneConfig.label}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white text-sm truncate max-w-[180px]">{adset.name}</p>
                        <p className="text-[10px] text-slate-600 truncate max-w-[180px]">{adset.campaignName}</p>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          adset.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-white/5 text-slate-500 border-white/10"
                        )}>
                          {adset.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {adset.dailyBudget ? `${adset.dailyBudget.toFixed(0)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {adset.spend.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {adset.purchaseValue.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-bold",
                          adset.roas >= (data?.thresholds.target ?? 2.0) ? "text-emerald-400" :
                          adset.roas >= (data?.thresholds.hold ?? 1.7) ? "text-blue-400" :
                          adset.roas >= (data?.thresholds.breakeven ?? 1.42) ? "text-amber-400" :
                          adset.spend > 50 ? "text-red-400" : "text-slate-500"
                        )}>
                          {adset.roas.toFixed(2)}x
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-bold",
                          adset.ncRoas != null && adset.ncRoas >= (data?.thresholds.target ?? 2.0) ? "text-emerald-400" :
                          adset.ncRoas != null && adset.ncRoas >= (data?.thresholds.breakeven ?? 1.42) ? "text-amber-400" :
                          adset.ncRoas != null ? "text-red-400" : "text-slate-600"
                        )}>
                          {adset.ncRoas != null ? `${adset.ncRoas.toFixed(2)}x` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{adset.purchases}</td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {adset.cpa > 0 ? adset.cpa.toFixed(0) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 max-w-[200px]">{adset.suggestion}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex items-center justify-end gap-1">
                          {/* Quick zone-based action */}
                          {adset.zone === "scale" && adset.status === "ACTIVE" && (
                            <button onClick={() => handleSingleAction(adset.id, "adjust_budget", 20)} disabled={acting}
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 transition-all" title="Scale +20%">
                              <TrendingUp className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {adset.zone === "kill" && adset.status === "ACTIVE" && (
                            <button onClick={() => handleSingleAction(adset.id, "pause")} disabled={acting}
                              className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all" title="Pause">
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {adset.zone === "watch" && adset.status === "ACTIVE" && (
                            <button onClick={() => handleSingleAction(adset.id, "adjust_budget", -20)} disabled={acting}
                              className="p-1.5 rounded hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-all" title="Reduce -20%">
                              <TrendingDown className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* More menu */}
                          <button
                            onClick={() => setOpenMenu(menuOpen ? null : adset.id)}
                            className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>

                          {menuOpen && (
                            <>
                              {/* Backdrop to close */}
                              <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-white/10 bg-[#111827] shadow-xl py-1">
                                {adset.status === "ACTIVE" ? (
                                  <button onClick={() => handleSingleAction(adset.id, "pause")}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                    <Pause className="h-3.5 w-3.5 text-red-400" /> Pause
                                  </button>
                                ) : (
                                  <button onClick={() => handleSingleAction(adset.id, "activate")}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                    <Play className="h-3.5 w-3.5 text-emerald-400" /> Activate
                                  </button>
                                )}
                                <div className="border-t border-white/5 my-1" />
                                <button onClick={() => handleSingleAction(adset.id, "adjust_budget", 30)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <ChevronUp className="h-3.5 w-3.5 text-emerald-400" /> Budget +30%
                                </button>
                                <button onClick={() => handleSingleAction(adset.id, "adjust_budget", 20)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <ChevronUp className="h-3.5 w-3.5 text-emerald-400" /> Budget +20%
                                </button>
                                <button onClick={() => handleSingleAction(adset.id, "adjust_budget", 10)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <ChevronUp className="h-3.5 w-3.5 text-emerald-400" /> Budget +10%
                                </button>
                                <button onClick={() => handleSingleAction(adset.id, "adjust_budget", -20)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <ChevronDown className="h-3.5 w-3.5 text-amber-400" /> Budget -20%
                                </button>
                                <button onClick={() => handleSingleAction(adset.id, "adjust_budget", -50)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <ChevronDown className="h-3.5 w-3.5 text-red-400" /> Budget -50%
                                </button>
                                <button onClick={() => handleSetBudget(adset)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <Target className="h-3.5 w-3.5 text-cyan-400" /> Set Budget...
                                </button>
                                <div className="border-t border-white/5 my-1" />
                                <button onClick={() => handleDuplicate(adset)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <Copy className="h-3.5 w-3.5 text-cyan-400" /> Duplicate to Campaign...
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAdsets.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-500">
                      {data.adsets.length === 0
                        ? "No ad sets found. Connect your Meta account and create campaigns first."
                        : "No ad sets in this zone."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ROAS Threshold Legend */}
          <div className="rounded-xl border border-white/5 bg-[#111827] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Your ROAS Zones</h3>
              <a href="/evolve-settings" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                Edit thresholds &rarr;
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                { zone: "scale" as const, desc: `ROAS > ${data?.thresholds.target ?? 2.0}x — Increase budget` },
                { zone: "hold" as const, desc: `ROAS ${data?.thresholds.hold ?? 1.7}–${data?.thresholds.target ?? 2.0}x — Let it run` },
                { zone: "watch" as const, desc: `ROAS ${data?.thresholds.breakeven ?? 1.42}–${data?.thresholds.hold ?? 1.7}x — Monitor closely` },
                { zone: "kill" as const, desc: `ROAS < ${data?.thresholds.breakeven ?? 1.42}x — Below breakeven` },
              ]).map(({ zone, desc }) => {
                const config = ZONE_CONFIG[zone];
                const ZoneIcon = config.icon;
                return (
                  <div key={zone} className={cn("rounded-lg border p-3", config.bg, config.border)}>
                    <div className="flex items-center gap-2 mb-1">
                      <ZoneIcon className={cn("h-4 w-4", config.color)} />
                      <span className={cn("text-sm font-semibold", config.color)}>{config.label}</span>
                    </div>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicateAdset} onOpenChange={(open) => { if (!open) setDuplicateAdset(null); }}>
        <DialogContent className="max-w-md bg-[#111827] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Copy className="h-5 w-5 text-cyan-400" />
              Duplicate Ad Set
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <p className="text-xs text-slate-500">Source Ad Set</p>
              <p className="text-sm font-medium text-white">{duplicateAdset?.name}</p>
              <p className="text-xs text-slate-600 font-mono mt-1">ID: {duplicateAdset?.id}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">New Name</label>
              <Input value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} className="bg-white/5 border-white/10 placeholder:text-slate-600" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Target Campaign</label>
              <Select value={duplicateTarget} onValueChange={setDuplicateTarget}>
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                <SelectContent className="bg-[#111827] border-white/10">
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDuplicateAdset(null)} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all">
              Cancel
            </button>
            <button onClick={handleDuplicateSubmit} disabled={duplicating || !duplicateTarget}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50">
              {duplicating ? <><Loader2 className="h-4 w-4 animate-spin" /> Duplicating...</> : <><Copy className="h-4 w-4" /> Duplicate</>}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Budget Dialog */}
      <Dialog open={!!budgetAdset} onOpenChange={(open) => { if (!open) setBudgetAdset(null); }}>
        <DialogContent className="max-w-sm bg-[#111827] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-400" />
              Set Daily Budget
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <p className="text-xs text-slate-500">Ad Set</p>
              <p className="text-sm font-medium text-white">{budgetAdset?.name}</p>
              {budgetAdset?.dailyBudget && (
                <p className="text-xs text-slate-500 mt-1">Current: {budgetAdset.dailyBudget.toFixed(0)} SEK/day</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">New Daily Budget (SEK)</label>
              <Input
                type="number"
                value={budgetValue}
                onChange={(e) => setBudgetValue(e.target.value)}
                placeholder="e.g. 200"
                className="bg-white/5 border-white/10 placeholder:text-slate-600"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleBudgetSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setBudgetAdset(null)} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all">
              Cancel
            </button>
            <button onClick={handleBudgetSubmit} disabled={!budgetValue || acting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50">
              Set Budget
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
