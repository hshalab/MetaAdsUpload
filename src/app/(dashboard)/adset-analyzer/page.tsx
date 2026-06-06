"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Pause,
  Skull,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { OwnerPicker, type TeamMember } from "@/components/editors/owner-picker";

type Classification = "breakthrough" | "spend_winner" | "kpi_winner" | "loser" | "new";

interface AdInSet {
  id: string;
  name: string;
  status: string;
  spend: number;
  roas: number;
  purchases: number;
  cpa: number;
}

interface ClassifiedAdset {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  campaignName: string;
  adCount: number;
  ads: AdInSet[];
  spend: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  cpa: number;
  frequency: number;
  spendProgress: number;
  spendThreshold: number;
  classification: Classification;
  recommendation: string;
  ncRoas: number | null;
  ncRevenue: number;
}

interface AdsetAnalyzerData {
  settings: { targetRoas: number; breakevenRoas: number; targetCpa: number };
  summary: {
    totalSpend: number;
    totalRevenue: number;
    totalPurchases: number;
    overallRoas: number;
    totalAdsets: number;
    classificationCounts: Record<Classification, number>;
  };
  adsets: ClassifiedAdset[];
  dateRange: { since: string; until: string };
  campaigns: Array<{ id: string; name: string }>;
}

const CLASS_CONFIG: Record<Classification, { label: string; color: string; bg: string; border: string; action: string }> = {
  breakthrough: { label: "Breakthrough", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", action: "Behåll!" },
  spend_winner: { label: "Spend Winner", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", action: "Graveyard" },
  kpi_winner: { label: "KPI Winner", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", action: "Låt köra" },
  loser: { label: "Loser", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", action: "Stäng av" },
  new: { label: "Ny", color: "text-slate-400", bg: "bg-white/5", border: "border-white/10", action: "Vänta" },
};

type DateMode = "preset" | "today" | "custom";

export default function AdSetAnalyzerPage() {
  const [data, setData] = useState<AdsetAnalyzerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>("preset");
  const [presetDays, setPresetDays] = useState(7);
  const [customFrom, setCustomFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [campaignFilter, setCampaignFilter] = useState("");
  const [classFilter, setClassFilter] = useState<Classification | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [ownersByAd, setOwnersByAd] = useState<Record<string, { videoEditorId: string | null; creativeStrategistId: string | null }>>({});

  // Team members for the owner picker (admin only — silently empty otherwise).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) return;
        const { users } = await res.json();
        setMembers(
          (users || [])
            .filter((u: { isActive?: boolean }) => u.isActive !== false)
            .map((u: { id: string; name: string; userType?: string; role?: string }) => ({
              id: u.id,
              name: u.name,
              userType: u.userType,
              role: u.role,
            }))
        );
      } catch { /* not admin / not logged in */ }
    })();
  }, []);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (dateMode === "today") params.set("days", "0");
    else if (dateMode === "custom") { params.set("since", customFrom); params.set("until", customTo); }
    else params.set("days", String(presetDays));
    return `/api/evolve/adset-classify?${params}`;
  }, [dateMode, presetDays, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl());
      if (!res.ok) {
        let msg = "Failed to fetch";
        try { const j = await res.json(); msg = j.error || msg; } catch { msg = `Server error (${res.status})`; }
        throw new Error(msg);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  // Debounce filter changes to avoid rapid API calls
  useEffect(() => {
    const timer = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Load existing owners for the ads currently shown.
  useEffect(() => {
    if (!data || members.length === 0) return;
    const adIds = data.adsets.flatMap((a) => a.ads.map((ad) => ad.id));
    if (adIds.length === 0) return;
    (async () => {
      try {
        const res = await fetch(`/api/ad-owner?adIds=${encodeURIComponent(adIds.join(","))}`);
        if (!res.ok) return;
        const { owners } = await res.json();
        const map: Record<string, { videoEditorId: string | null; creativeStrategistId: string | null }> = {};
        for (const o of owners || []) {
          map[o.adId] = { videoEditorId: o.videoEditorId, creativeStrategistId: o.creativeStrategistId };
        }
        setOwnersByAd(map);
      } catch { /* ignore */ }
    })();
  }, [data, members.length]);

  const executeAction = async (adsetId: string, action: string, adset: ClassifiedAdset) => {
    setActing(adsetId);
    try {
      const res = await fetch("/api/evolve/adset-classify/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adsetId,
          action,
          classification: adset.classification,
          metrics: { spend: adset.spend, roas: adset.roas, cpa: adset.cpa, purchases: adset.purchases },
          campaignId: adset.campaignId,
          adsetName: adset.name,
          dateRange: data?.dateRange,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.action || "Klart!");
      // Optimistic update: remove paused/moved adset from local state instead of re-fetching
      if (action === "pause" || action === "move_zombie") {
        setData((prev) => prev ? {
          ...prev,
          adsets: prev.adsets.filter((a) => a.id !== adsetId),
          summary: {
            ...prev.summary,
            totalAdsets: prev.summary.totalAdsets - 1,
            classificationCounts: {
              ...prev.summary.classificationCounts,
              [adset.classification]: Math.max(0, (prev.summary.classificationCounts[adset.classification] || 0) - 1),
            },
          },
        } : prev);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setActing(null);
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredAdsets = data?.adsets.filter((a) =>
    (!campaignFilter || a.campaignId === campaignFilter) &&
    (!classFilter || a.classification === classFilter)
  ) || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-cyan-400" />
            Ad Set Analyzer
          </h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              Target: {data.settings.targetRoas}x &middot; Breakeven: {data.settings.breakevenRoas}x &middot; CPA: {data.settings.targetCpa} SEK
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data && data.campaigns.length > 0 && (
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white [color-scheme:dark]"
            >
              <option value="">Alla kampanjer</option>
              {data.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button onClick={() => setDateMode("today")}
              className={cn("px-3 py-1.5 text-xs font-medium transition-all", dateMode === "today" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5")}>
              Idag
            </button>
            {[3, 7, 14, 30].map((d) => (
              <button key={d} onClick={() => { setDateMode("preset"); setPresetDays(d); }}
                className={cn("px-3 py-1.5 text-xs font-medium transition-all", dateMode === "preset" && presetDays === d ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5")}>
                {d}d
              </button>
            ))}
            <button onClick={() => setDateMode("custom")}
              className={cn("px-3 py-1.5 text-xs font-medium transition-all", dateMode === "custom" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5")}>
              <Calendar className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {dateMode === "custom" && (
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#111827] p-3">
          <Calendar className="h-4 w-4 text-slate-500" />
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark]" />
          <span className="text-slate-500 text-sm">till</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark]" />
          <button onClick={fetchData}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-all">
            Visa
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
          <h3 className="text-lg font-semibold text-white mb-2">Kunde inte ladda data</h3>
          <p className="text-slate-500 mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all">
            Försök igen
          </button>
        </div>
      ) : data ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Ad Sets" value={String(data.summary.totalAdsets)} />
            <KpiCard label="Spend" value={`${data.summary.totalSpend.toFixed(0)} SEK`} />
            <KpiCard label="ROAS" value={`${data.summary.overallRoas.toFixed(2)}x`}
              color={data.summary.overallRoas >= data.settings.targetRoas ? "text-emerald-400" : data.summary.overallRoas >= data.settings.breakevenRoas ? "text-amber-400" : "text-red-400"} />
            <KpiCard label="Köp" value={String(data.summary.totalPurchases)} />
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            <FilterTab active={!classFilter} onClick={() => setClassFilter(null)}
              label={`Alla (${data.summary.totalAdsets})`} />
            {(["breakthrough", "spend_winner", "kpi_winner", "loser", "new"] as const).map((cls) => {
              const c = CLASS_CONFIG[cls];
              const count = data.summary.classificationCounts[cls] || 0;
              if (count === 0) return null;
              return (
                <FilterTab key={cls} active={classFilter === cls}
                  onClick={() => setClassFilter(classFilter === cls ? null : cls)}
                  label={`${c.label} (${count})`}
                  activeColor={c.color} activeBg={c.bg} activeBorder={c.border} />
              );
            })}
          </div>

          {/* Ad Set Cards */}
          <div className="space-y-3">
            {filteredAdsets.map((adset) => {
              const config = CLASS_CONFIG[adset.classification];
              const isExpanded = expanded.has(adset.id);
              const isActing = acting === adset.id;

              return (
                <div key={adset.id} className={cn("rounded-xl border bg-[#111827] overflow-hidden transition-all", config.border)}>
                  {/* Main ad set row */}
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggle(adset.id)}>

                    {/* Expand arrow */}
                    <div className="shrink-0 text-slate-500">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </div>

                    {/* Classification badge */}
                    <div className={cn("shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border", config.bg, config.color, config.border)}>
                      {config.label}
                    </div>

                    {/* Name + campaign */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{adset.name}</p>
                      <p className="text-[10px] text-slate-600 truncate">{adset.campaignName} &middot; {adset.adCount} ads</p>
                    </div>

                    {/* Metrics */}
                    <div className="hidden sm:flex items-center gap-5 shrink-0">
                      <Metric label="Spend" value={`${adset.spend.toFixed(0)}`} />
                      <Metric label="ROAS" value={`${adset.roas.toFixed(2)}x`}
                        color={adset.roas >= data.settings.targetRoas ? "text-emerald-400" : adset.roas >= data.settings.breakevenRoas ? "text-amber-400" : adset.spend > 0 ? "text-red-400" : "text-slate-500"} />
                      <Metric label="ncROAS" value={adset.ncRoas != null ? `${adset.ncRoas.toFixed(2)}x` : "—"}
                        color={adset.ncRoas != null && adset.ncRoas >= data.settings.targetRoas ? "text-emerald-400" : adset.ncRoas != null && adset.ncRoas >= data.settings.breakevenRoas ? "text-amber-400" : adset.ncRoas != null ? "text-red-400" : "text-slate-600"} />
                      <Metric label="CPA" value={adset.cpa > 0 ? adset.cpa.toFixed(0) : "-"}
                        color={adset.cpa > 0 && adset.cpa <= data.settings.targetCpa ? "text-emerald-400" : adset.cpa > 0 ? "text-red-400" : "text-slate-500"} />
                      <Metric label="Köp" value={String(adset.purchases)} />
                      <Metric label="Freq" value={adset.frequency.toFixed(1)} />
                    </div>

                    {/* 3x CPA progress */}
                    <div className="hidden lg:flex flex-col items-center gap-0.5 shrink-0 w-20">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full",
                          adset.spendProgress >= 1 ? "bg-cyan-400" : adset.spendProgress >= 0.5 ? "bg-amber-400" : "bg-slate-600"
                        )} style={{ width: `${Math.min(adset.spendProgress * 100, 100)}%` }} />
                      </div>
                      <span className="text-[9px] text-slate-600">{adset.spend.toFixed(0)}/{adset.spendThreshold.toFixed(0)} SEK</span>
                    </div>

                    {/* Action buttons — always visible */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isActing ? (
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      ) : (
                        <>
                          {(adset.classification === "loser" || adset.classification === "spend_winner") && (
                            <button
                              onClick={() => executeAction(adset.id, "move_zombie", adset)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                              title="Flytta alla ads till Graveyard med post-ID, pausa ad set"
                            >
                              <Skull className="h-3.5 w-3.5" />
                              Graveyard
                            </button>
                          )}
                          {adset.classification === "loser" && adset.status === "ACTIVE" && (
                            <button
                              onClick={() => executeAction(adset.id, "pause", adset)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                              title="Pausa hela ad set"
                            >
                              <Pause className="h-3.5 w-3.5" />
                              Pausa
                            </button>
                          )}
                          {(adset.classification === "breakthrough" || adset.classification === "kpi_winner" || adset.classification === "new") && (
                            <button
                              onClick={() => executeAction(adset.id, "let_run", adset)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-all"
                            >
                              <Check className="h-3.5 w-3.5" />
                              OK
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Recommendation bar */}
                  <div className={cn("px-4 py-2 text-xs border-t", config.bg, config.border, config.color)}>
                    {adset.recommendation}
                  </div>

                  {/* Expanded: creatives inside this ad set */}
                  {isExpanded && adset.ads.length > 0 && (
                    <div className="border-t border-white/5">
                      <div className="px-4 py-2 bg-white/[0.02]">
                        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Creatives i detta ad set</p>
                      </div>
                      {adset.ads.map((ad) => (
                        <div key={ad.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          {/* Status dot */}
                          <div className={cn("w-2 h-2 rounded-full shrink-0",
                            ad.status === "ACTIVE" ? "bg-emerald-400" : "bg-slate-600"
                          )} />
                          {/* Name */}
                          <p className="flex-1 text-xs text-slate-400 truncate min-w-0">{ad.name}</p>
                          {/* Mini metrics */}
                          <div className="flex items-center gap-4 shrink-0 text-xs">
                            <span className="text-slate-500">{ad.spend.toFixed(0)} SEK</span>
                            <span className={cn("font-medium",
                              ad.roas >= (data?.settings.targetRoas || 0) ? "text-emerald-400" :
                              ad.roas >= (data?.settings.breakevenRoas || 0) ? "text-amber-400" :
                              ad.spend > 0 ? "text-red-400" : "text-slate-600"
                            )}>
                              {ad.roas.toFixed(2)}x
                            </span>
                            <span className="text-slate-500">{ad.purchases} köp</span>
                          </div>
                          {/* Owner assignment */}
                          <OwnerPicker
                            adId={ad.id}
                            adName={ad.name}
                            campaignId={adset.campaignId}
                            adsetId={adset.id}
                            members={members}
                            videoEditorId={ownersByAd[ad.id]?.videoEditorId || null}
                            creativeStrategistId={ownersByAd[ad.id]?.creativeStrategistId || null}
                            compact
                            onSaved={(ve, cs) =>
                              setOwnersByAd((prev) => ({ ...prev, [ad.id]: { videoEditorId: ve, creativeStrategistId: cs } }))
                            }
                          />
                        </div>
                      ))}
                      {adset.ads.length === 0 && (
                        <div className="px-4 py-4 text-xs text-slate-600 text-center">Inga ads i detta ad set</div>
                      )}
                    </div>
                  )}

                  {isExpanded && adset.ads.length === 0 && (
                    <div className="border-t border-white/5 px-4 py-4 text-xs text-slate-600 text-center">
                      Inga ads hittade i detta ad set
                    </div>
                  )}
                </div>
              );
            })}

            {filteredAdsets.length === 0 && (
              <div className="rounded-xl border border-white/5 bg-[#111827] py-12 text-center text-slate-500">
                {data.adsets.length === 0
                  ? "Inga ad sets hittade. Se till att du har aktiva kampanjer."
                  : "Inga ad sets i denna kategori."}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#111827] px-4 py-3">
      <div className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</div>
      <div className={cn("text-xl font-bold mt-0.5", color)}>{value}</div>
    </div>
  );
}

function Metric({ label, value, color = "text-slate-300" }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-right">
      <div className="text-[9px] text-slate-600 uppercase">{label}</div>
      <div className={cn("text-sm font-medium", color)}>{value}</div>
    </div>
  );
}

function FilterTab({ active, onClick, label, activeColor, activeBg, activeBorder }: {
  active: boolean; onClick: () => void; label: string;
  activeColor?: string; activeBg?: string; activeBorder?: string;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "px-3.5 py-2 rounded-xl border text-xs font-medium transition-all",
        active
          ? cn(activeBg || "bg-cyan-500/10", activeColor || "text-cyan-400", activeBorder || "border-cyan-500/20")
          : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
      )}>
      {label}
    </button>
  );
}
