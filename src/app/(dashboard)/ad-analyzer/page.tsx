"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
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
  spendProgress: number;
  spendThreshold: number;
  ageDays: number;
  classification: Classification;
  recommendation: string;
  ncRoas: number | null;
  ncRevenue: number;
}

interface CampaignSummary {
  id: string;
  name: string;
  spend: number;
  revenue: number;
  purchases: number;
  roas: number;
  cpa: number;
  adCount: number;
  adsetCount: number;
  dailyBudget: number;
  maxAdSets: number;
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
  campaignSummaries: CampaignSummary[];
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

const CLASS_PRIORITY: Record<Classification, number> = {
  breakthrough: 0,
  spend_winner: 1,
  kpi_winner: 2,
  loser: 3,
  new: 4,
};

interface AdSetGroup {
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  ads: ClassifiedAd[];
  spend: number;
  revenue: number;
  purchases: number;
  roas: number;
  cpa: number;
  ctr: number;
  frequency: number;
  spendProgress: number;
  spendThreshold: number;
  bestClassification: Classification;
  classificationCounts: Partial<Record<Classification, number>>;
  ncRoas: number | null;
}

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
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());
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
          adName: ad.name,
          dateRange: data?.dateRange,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.action || "Action completed");
      if (action === "pause" || action === "move_zombie") fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  // Group ads by ad set
  const adSetGroups = useMemo((): AdSetGroup[] => {
    if (!data) return [];
    const filteredAds = data.ads.filter((a) => !classFilter || a.classification === classFilter);
    const groupMap = new Map<string, ClassifiedAd[]>();

    for (const ad of filteredAds) {
      const existing = groupMap.get(ad.adsetId) || [];
      existing.push(ad);
      groupMap.set(ad.adsetId, existing);
    }

    return Array.from(groupMap.entries())
      .map(([adsetId, ads]): AdSetGroup => {
        const spend = ads.reduce((s, a) => s + a.spend, 0);
        const revenue = ads.reduce((s, a) => s + a.purchaseValue, 0);
        const purchases = ads.reduce((s, a) => s + a.purchases, 0);
        const roas = spend > 0 ? revenue / spend : 0;
        const cpa = purchases > 0 ? spend / purchases : 0;
        const impressions = ads.reduce((s, a) => s + a.impressions, 0);
        const reach = ads.reduce((s, a) => s + a.reach, 0);
        const clicks = ads.reduce((s, a) => s + a.clicks, 0);
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const frequency = reach > 0 ? impressions / reach : 0;
        const spendThreshold = ads[0]?.spendThreshold || 0;
        const spendProgress = spendThreshold > 0 ? Math.min(spend / spendThreshold, 1) : 0;

        // Best classification in the group
        const bestClassification = ads.reduce(
          (best, a) => (CLASS_PRIORITY[a.classification] < CLASS_PRIORITY[best] ? a.classification : best),
          "new" as Classification
        );

        // Count classifications
        const classificationCounts: Partial<Record<Classification, number>> = {};
        for (const ad of ads) {
          classificationCounts[ad.classification] = (classificationCounts[ad.classification] || 0) + 1;
        }

        // ncROAS: use first ad's ncRoas (same per adset)
        const ncRoas = ads[0]?.ncRoas ?? null;

        return {
          adsetId,
          adsetName: ads[0]?.adsetName || "Unknown",
          campaignId: ads[0]?.campaignId || "",
          campaignName: ads[0]?.campaignName || "Unknown",
          ads: ads.sort((a, b) => b.spend - a.spend),
          spend,
          revenue,
          purchases,
          roas,
          cpa,
          ctr,
          frequency,
          spendProgress,
          spendThreshold,
          bestClassification,
          classificationCounts,
          ncRoas,
        };
      })
      .sort((a, b) => {
        const classOrder = CLASS_PRIORITY[a.bestClassification] - CLASS_PRIORITY[b.bestClassification];
        if (classOrder !== 0) return classOrder;
        return b.spend - a.spend;
      });
  }, [data, classFilter]);

  const toggleAdset = (adsetId: string) => {
    setExpandedAdsets((prev) => {
      const next = new Set(prev);
      if (next.has(adsetId)) next.delete(adsetId);
      else next.add(adsetId);
      return next;
    });
  };

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
              { label: "Ad Sets", value: `${adSetGroups.length}`, color: "text-white" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-white/5 bg-[#111827] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                  <span className={cn("text-xl font-bold", kpi.color)}>{kpi.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Campaign-Level CBO Summary */}
          {data.campaignSummaries && data.campaignSummaries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kampanjer (CBO)</h3>
              <div className="grid gap-2">
                {data.campaignSummaries.map((camp) => {
                  const campRoasColor = camp.roas >= data.settings.targetRoas
                    ? "text-emerald-400"
                    : camp.roas >= data.settings.breakevenRoas
                    ? "text-amber-400"
                    : camp.spend > 0
                    ? "text-red-400"
                    : "text-slate-500";
                  return (
                    <div key={camp.id} className="rounded-xl border border-white/5 bg-[#111827] px-4 py-3 flex items-center gap-6">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                        <p className="text-[10px] text-slate-600">
                          {camp.adCount} ads &middot; {camp.adsetCount}/{camp.maxAdSets} ad sets
                          {camp.adsetCount > camp.maxAdSets && (
                            <span className="text-amber-400 font-medium"> — för många ad sets!</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-5 text-right flex-shrink-0">
                        <div>
                          <div className="text-[10px] text-slate-500">ROAS</div>
                          <div className={cn("text-sm font-bold", campRoasColor)}>
                            {camp.spend > 0 ? `${camp.roas.toFixed(2)}x` : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Spend</div>
                          <div className="text-sm text-slate-300">{camp.spend.toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Köp</div>
                          <div className="text-sm text-slate-300">{camp.purchases}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">CPA</div>
                          <div className={cn("text-sm", camp.cpa > 0 && camp.cpa <= data.settings.targetCpa ? "text-emerald-400" : camp.cpa > 0 ? "text-red-400" : "text-slate-500")}>
                            {camp.cpa > 0 ? camp.cpa.toFixed(0) : "-"}
                          </div>
                        </div>
                        {camp.dailyBudget > 0 && (
                          <div>
                            <div className="text-[10px] text-slate-500">Budget</div>
                            <div className="text-sm text-slate-300">{camp.dailyBudget.toFixed(0)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Ad Sets Table — grouped with expand */}
          <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="w-8 px-2 py-3" />
                  <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Ad Set</th>
                  <th className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider px-2 py-3">Ads</th>
                  <th className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider px-2 py-3">Class</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Spend</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">ROAS</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">ncROAS</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">CPA</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Purch.</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">CTR</th>
                  <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Freq.</th>
                  <th className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">3x CPA</th>
                </tr>
              </thead>
              <tbody>
                {adSetGroups.map((group) => {
                  const isExpanded = expandedAdsets.has(group.adsetId);
                  const bestConfig = CLASS_CONFIG[group.bestClassification];

                  return (
                    <AdSetGroupRows
                      key={group.adsetId}
                      group={group}
                      isExpanded={isExpanded}
                      onToggle={() => toggleAdset(group.adsetId)}
                      bestConfig={bestConfig}
                      settings={data.settings}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      acting={acting}
                      executeAction={executeAction}
                    />
                  );
                })}
                {adSetGroups.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-500">
                      {data.ads.length === 0
                        ? "No ads found. Make sure you have active campaigns."
                        : "No ad sets in this category."}
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

/** Ad Set group row + expanded child ad rows */
function AdSetGroupRows({
  group,
  isExpanded,
  onToggle,
  bestConfig,
  settings,
  openMenu,
  setOpenMenu,
  acting,
  executeAction,
}: {
  group: AdSetGroup;
  isExpanded: boolean;
  onToggle: () => void;
  bestConfig: { label: string; color: string; bg: string; border: string };
  settings: { targetRoas: number; breakevenRoas: number; targetCpa: number };
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  acting: string | null;
  executeAction: (ad: ClassifiedAd, action: string) => void;
}) {
  return (
    <>
      {/* Ad Set summary row */}
      <tr
        className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-2 py-3 text-center">
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-slate-500 mx-auto" />
            : <ChevronRight className="h-4 w-4 text-slate-500 mx-auto" />}
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-white text-sm truncate max-w-[250px]">{group.adsetName}</p>
          <p className="text-[10px] text-slate-600 truncate max-w-[250px]">{group.campaignName}</p>
        </td>
        <td className="px-2 py-3 text-center">
          <span className="text-xs text-slate-400 font-medium">{group.ads.length}</span>
        </td>
        <td className="px-2 py-3 text-center">
          <ClassificationBadges counts={group.classificationCounts} />
        </td>
        <td className="px-4 py-3 text-right font-medium text-slate-300">{group.spend.toFixed(0)}</td>
        <td className="px-4 py-3 text-right">
          <span className={cn(
            "font-bold",
            group.roas >= settings.targetRoas ? "text-emerald-400" :
            group.roas >= settings.breakevenRoas ? "text-amber-400" :
            group.spend > 50 ? "text-red-400" : "text-slate-500"
          )}>
            {group.roas.toFixed(2)}x
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={cn(
            "font-bold",
            group.ncRoas != null && group.ncRoas >= settings.targetRoas ? "text-emerald-400" :
            group.ncRoas != null && group.ncRoas >= settings.breakevenRoas ? "text-amber-400" :
            group.ncRoas != null ? "text-red-400" : "text-slate-600"
          )}>
            {group.ncRoas != null ? `${group.ncRoas.toFixed(2)}x` : "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-slate-400">{group.cpa > 0 ? group.cpa.toFixed(0) : "-"}</td>
        <td className="px-4 py-3 text-right text-slate-300">{group.purchases}</td>
        <td className="px-4 py-3 text-right text-slate-400">{group.ctr.toFixed(2)}%</td>
        <td className="px-4 py-3 text-right text-slate-400">{group.frequency.toFixed(1)}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  group.spendProgress >= 1 ? "bg-cyan-400" : group.spendProgress >= 0.5 ? "bg-amber-400" : "bg-slate-500"
                )}
                style={{ width: `${Math.min(group.spendProgress * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">
              {group.spend.toFixed(0)}/{group.spendThreshold.toFixed(0)}
            </span>
          </div>
        </td>
      </tr>

      {/* Expanded: individual ad rows */}
      {isExpanded && group.ads.map((ad) => {
        const config = CLASS_CONFIG[ad.classification];
        const menuOpen = openMenu === ad.id;

        return (
          <tr key={ad.id} className="border-b border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
            <td className="px-2 py-2.5" />
            <td className="px-4 py-2.5 pl-8">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                  ad.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-500 border-white/10"
                )}>
                  {ad.status === "ACTIVE" ? "ON" : "OFF"}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-300 truncate max-w-[220px]">{ad.name}</p>
                  <p className="text-[10px] text-slate-600 truncate max-w-[220px]">{ad.recommendation}</p>
                </div>
              </div>
            </td>
            <td />
            <td className="px-2 py-2.5 text-center">
              <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border", config.bg, config.color, config.border)}>
                {config.label}
              </div>
            </td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-400">{ad.spend.toFixed(0)}</td>
            <td className="px-4 py-2.5 text-right">
              <span className={cn(
                "text-xs font-bold",
                ad.roas >= settings.targetRoas ? "text-emerald-400" :
                ad.roas >= settings.breakevenRoas ? "text-amber-400" :
                ad.spend > 50 ? "text-red-400" : "text-slate-500"
              )}>
                {ad.roas.toFixed(2)}x
              </span>
            </td>
            <td className="px-4 py-2.5 text-right">
              <span className={cn(
                "text-xs font-bold",
                ad.ncRoas != null && ad.ncRoas >= settings.targetRoas ? "text-emerald-400" :
                ad.ncRoas != null && ad.ncRoas >= settings.breakevenRoas ? "text-amber-400" :
                ad.ncRoas != null ? "text-red-400" : "text-slate-600"
              )}>
                {ad.ncRoas != null ? `${ad.ncRoas.toFixed(2)}x` : "—"}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-500">{ad.cpa > 0 ? ad.cpa.toFixed(0) : "-"}</td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-400">{ad.purchases}</td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-500">{ad.ctr.toFixed(2)}%</td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-500">{ad.frequency.toFixed(1)}</td>
            <td className="px-4 py-2.5">
              {/* Actions */}
              <div className="relative flex items-center justify-center">
                {acting === ad.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(menuOpen ? null : ad.id); }}
                    className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                )}
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-white/10 bg-[#111827] shadow-xl py-1">
                      <button onClick={(e) => { e.stopPropagation(); executeAction(ad, "move_zombie"); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                        <Skull className="h-3.5 w-3.5 text-amber-400" /> Flytta till Graveyard
                      </button>
                      <div className="border-t border-white/5 my-1" />
                      {ad.status === "ACTIVE" ? (
                        <button onClick={(e) => { e.stopPropagation(); executeAction(ad, "pause"); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                          <Pause className="h-3.5 w-3.5 text-red-400" /> Pausa
                        </button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); executeAction(ad, "let_run"); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                          <Play className="h-3.5 w-3.5 text-emerald-400" /> Låt köra
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); executeAction(ad, "reviewed"); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-all">
                        <Eye className="h-3.5 w-3.5 text-slate-400" /> Markera som granskad
                      </button>
                    </div>
                  </>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** Small inline badges showing classification distribution for an ad set */
function ClassificationBadges({ counts }: { counts: Partial<Record<Classification, number>> }) {
  const entries = Object.entries(counts) as [Classification, number][];
  if (entries.length === 0) return <span className="text-slate-600 text-[10px]">-</span>;

  // If all same classification, show single badge
  if (entries.length === 1) {
    const [cls, count] = entries[0];
    const config = CLASS_CONFIG[cls];
    return (
      <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border", config.bg, config.color, config.border)}>
        {config.label}
      </div>
    );
  }

  // Mixed: show mini colored dots with counts
  return (
    <div className="flex items-center justify-center gap-1">
      {entries
        .sort(([a], [b]) => CLASS_PRIORITY[a] - CLASS_PRIORITY[b])
        .map(([cls, count]) => {
          const dotColor: Record<Classification, string> = {
            breakthrough: "bg-emerald-400",
            spend_winner: "bg-blue-400",
            kpi_winner: "bg-cyan-400",
            loser: "bg-red-400",
            new: "bg-slate-400",
          };
          return (
            <div key={cls} className="flex items-center gap-0.5" title={`${CLASS_CONFIG[cls].label}: ${count}`}>
              <div className={cn("w-2 h-2 rounded-full", dotColor[cls])} />
              <span className="text-[9px] text-slate-500">{count}</span>
            </div>
          );
        })}
    </div>
  );
}
