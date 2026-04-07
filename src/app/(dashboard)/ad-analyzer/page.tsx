"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Pause,
  Play,
  Copy,
  Skull,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

type Classification = "breakthrough" | "spend_winner" | "kpi_winner" | "loser" | "new";

interface ClassifiedAd {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  frequency: number;
  hookRate: number;
  ageDays: number;
  classification: Classification;
  recommendation: string;
}

interface AnalyzerData {
  settings: { targetRoas: number; breakevenRoas: number; targetCpa: number };
  summary: {
    totalSpend: number;
    totalRevenue: number;
    totalPurchases: number;
    overallRoas: number;
    totalAds: number;
    classificationCounts: Record<Classification, number>;
  };
  ads: ClassifiedAd[];
  dateRange: { since: string; until: string };
  campaigns: Array<{ id: string; name: string }>;
}

const CLASS_CONFIG: Record<Classification, { label: string; color: string; bg: string; border: string }> = {
  breakthrough: { label: "Breakthrough", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  spend_winner: { label: "Spend Winner", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  kpi_winner: { label: "KPI Winner", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  loser: { label: "Loser", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  new: { label: "New", color: "text-slate-400", bg: "bg-white/5", border: "border-white/10" },
};

type DateMode = "preset" | "today" | "custom";

export default function AdAnalyzerPage() {
  const [data, setData] = useState<AnalyzerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateMode, setDateMode] = useState<DateMode>("preset");
  const [presetDays, setPresetDays] = useState(7);
  const [customFrom, setCustomFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [campaignFilter, setCampaignFilter] = useState("");
  const [classFilter, setClassFilter] = useState<Classification | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (dateMode === "today") {
      params.set("days", "0");
    } else if (dateMode === "custom") {
      params.set("since", customFrom);
      params.set("until", customTo);
    } else {
      params.set("days", String(presetDays));
    }
    if (campaignFilter) params.set("campaign_id", campaignFilter);
    return `/api/evolve/classify?${params}`;
  }, [dateMode, presetDays, customFrom, customTo, campaignFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl());
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const executeAction = async (ad: ClassifiedAd, action: string) => {
    setOpenMenu(null);
    setActing(ad.id);
    try {
      const res = await fetch("/api/evolve/classify/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adId: ad.id,
          action,
          classification: ad.classification,
          metrics: { spend: ad.spend, roas: ad.roas, cpa: ad.cpa, purchases: ad.purchases },
          campaignId: ad.campaignId,
          adsetId: ad.adsetId,
          dateRange: data?.dateRange,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.action || "Action completed");
      if (action === "pause") fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  const filteredAds = data?.ads.filter((a) => !classFilter || a.classification === classFilter) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-cyan-400" />
            Ad Analyzer
          </h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              Target: {data.settings.targetRoas}x &middot; Breakeven: {data.settings.breakevenRoas}x &middot; CPA: {data.settings.targetCpa} SEK
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Campaign filter */}
          {data && data.campaigns.length > 0 && (
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white [color-scheme:dark]"
            >
              <option value="">All Campaigns</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {/* Date range */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setDateMode("today")}
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
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark]" />
          <span className="text-slate-500 text-sm">to</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark]" />
          <button onClick={fetchData}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-all">
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
          <h3 className="text-lg font-semibold text-white mb-2">Could not load ad data</h3>
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
              { label: "ROAS", value: `${data.summary.overallRoas.toFixed(2)}x`, color: data.summary.overallRoas >= data.settings.targetRoas ? "text-emerald-400" : data.summary.overallRoas >= data.settings.breakevenRoas ? "text-amber-400" : "text-red-400" },
              { label: "Purchases", value: data.summary.totalPurchases.toString(), color: "text-white" },
              { label: "Ads", value: data.summary.totalAds.toString(), color: "text-white" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-white/5 bg-[#111827] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                  <span className={cn("text-xl font-bold", kpi.color)}>{kpi.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Classification Filter Tabs */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setClassFilter(null)}
              className={cn(
                "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                !classFilter ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
              )}
            >
              All ({data.summary.totalAds})
            </button>
            {(["breakthrough", "spend_winner", "kpi_winner", "loser", "new"] as const).map((cls) => {
              const config = CLASS_CONFIG[cls];
              const count = data.summary.classificationCounts[cls] || 0;
              return (
                <button
                  key={cls}
                  onClick={() => setClassFilter(classFilter === cls ? null : cls)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    classFilter === cls ? cn(config.bg, config.color, config.border) : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  )}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Ads Table */}
          <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Class</th>
                  <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Ad Name</th>
                  <th className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider px-2 py-3">Status</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Spend</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">ROAS</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">CPA</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Purch.</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">CTR</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Freq.</th>
                  <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Recommendation</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAds.map((ad) => {
                  const config = CLASS_CONFIG[ad.classification];
                  const menuOpen = openMenu === ad.id;
                  return (
                    <tr key={ad.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border", config.bg, config.color, config.border)}>
                          {config.label}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white text-sm truncate max-w-[200px]">{ad.name}</p>
                        <p className="text-[10px] text-slate-600 truncate max-w-[200px]">{ad.campaignName} / {ad.adsetName}</p>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          ad.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-500 border-white/10"
                        )}>
                          {ad.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{ad.spend.toFixed(0)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-bold",
                          ad.roas >= (data?.settings.targetRoas || 2) ? "text-emerald-400" :
                          ad.roas >= (data?.settings.breakevenRoas || 1.42) ? "text-amber-400" :
                          ad.spend > 50 ? "text-red-400" : "text-slate-500"
                        )}>
                          {ad.roas.toFixed(2)}x
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">{ad.cpa > 0 ? ad.cpa.toFixed(0) : "-"}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{ad.purchases}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{ad.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right text-slate-400">{ad.frequency.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 max-w-[220px]">{ad.recommendation}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          {acting === ad.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                          ) : (
                            <button
                              onClick={() => setOpenMenu(menuOpen ? null : ad.id)}
                              className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {menuOpen && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-white/10 bg-[#111827] shadow-xl py-1">
                                <button onClick={() => executeAction(ad, "duplicate_abo")}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <Copy className="h-3.5 w-3.5 text-cyan-400" /> Duplicate to ABO
                                </button>
                                <button onClick={() => executeAction(ad, "move_zombie")}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <Skull className="h-3.5 w-3.5 text-amber-400" /> Move to Zombie
                                </button>
                                <div className="border-t border-white/5 my-1" />
                                {ad.status === "ACTIVE" ? (
                                  <button onClick={() => executeAction(ad, "pause")}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                    <Pause className="h-3.5 w-3.5 text-red-400" /> Pause
                                  </button>
                                ) : (
                                  <button onClick={() => executeAction(ad, "let_run")}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                    <Play className="h-3.5 w-3.5 text-emerald-400" /> Let Run
                                  </button>
                                )}
                                <button onClick={() => executeAction(ad, "let_run")}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                                  <Eye className="h-3.5 w-3.5 text-slate-400" /> Mark as Reviewed
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAds.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      {data.ads.length === 0
                        ? "No ads found. Make sure you have active campaigns."
                        : "No ads in this category."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
