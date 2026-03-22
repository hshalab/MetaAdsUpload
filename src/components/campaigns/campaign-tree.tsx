"use client";

import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import { ChevronDown, ChevronRight, RefreshCw, Copy, Loader2, Search, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

interface AdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  hookRate: number;
}

const EMPTY_METRICS: Metrics = {
  spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0,
  roas: 0, ctr: 0, cpc: 0, cpm: 0, cpa: 0, hookRate: 0,
};

type DatePreset = "today" | "3" | "7" | "14" | "30";

export function CampaignTree() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<Record<string, AdSet[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editBudget, setEditBudget] = useState<{ id: string; type: "campaign" | "adset"; value: string } | null>(null);

  // Date range
  const [datePreset, setDatePreset] = useState<DatePreset>("7");

  // Metrics
  const [campaignMetrics, setCampaignMetrics] = useState<Map<string, Metrics>>(new Map());
  const [adsetMetrics, setAdsetMetrics] = useState<Map<string, Metrics>>(new Map());

  // Duplicate state
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<AdSet | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState("");
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const getDateRange = useCallback(() => {
    const days = datePreset === "today" ? 0 : parseInt(datePreset);
    const since = format(days === 0 ? new Date() : subDays(new Date(), days), "yyyy-MM-dd");
    const until = format(new Date(), "yyyy-MM-dd");
    return { since, until };
  }, [datePreset]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta/campaigns");
      const data = await res.json();
      const rawCampaigns: Campaign[] = data.data || [];

      // Sort ACTIVE first, then by name
      rawCampaigns.sort((a, b) => {
        if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
        if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
        return a.name.localeCompare(b.name);
      });

      setCampaigns(rawCampaigns);

      // Fetch campaign-level insights
      const { since, until } = getDateRange();
      const insightsRes = await fetch(`/api/meta/insights?from=${since}&to=${until}`);
      const insightsData = await insightsRes.json();

      const metricsMap = new Map<string, Metrics>();
      for (const c of (insightsData.campaigns || [])) {
        metricsMap.set(c.id, {
          spend: c.spend || 0,
          impressions: c.impressions || 0,
          clicks: c.linkClicks || 0,
          purchases: c.purchases || 0,
          purchaseValue: c.purchaseValue || (c.roas && c.spend ? c.roas * c.spend : 0),
          roas: c.roas || 0,
          ctr: c.ctr || 0,
          cpc: c.cpc || 0,
          cpm: c.cpm || 0,
          cpa: c.cpa || (c.purchases > 0 ? c.spend / c.purchases : 0),
          hookRate: c.hookRate || 0,
        });
      }
      setCampaignMetrics(metricsMap);
    } catch {
      toast.error("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const fetchAdsetInsights = async (campaignId: string, adsetList: AdSet[]) => {
    try {
      const { since, until } = getDateRange();
      // Fetch adset-level insights for this campaign
      const res = await fetch(
        `/api/meta/scaling?status=ALL&since=${since}&until=${until}`
      );
      const data = await res.json();
      const metricsMap = new Map(adsetMetrics);
      for (const a of (data.adsets || [])) {
        if (adsetList.some(as => as.id === a.id)) {
          metricsMap.set(a.id, {
            spend: a.spend || 0,
            impressions: a.impressions || 0,
            clicks: a.clicks || 0,
            purchases: a.purchases || 0,
            purchaseValue: a.purchaseValue || 0,
            roas: a.roas || 0,
            ctr: a.ctr || 0,
            cpc: a.cpc || 0,
            cpm: a.cpm || 0,
            cpa: a.cpa || 0,
            hookRate: 0,
          });
        }
      }
      setAdsetMetrics(metricsMap);
    } catch {
      // Silently fail — metrics just won't show
    }
  };

  const toggleExpand = async (campaignId: string) => {
    const next = new Set(expanded);
    if (next.has(campaignId)) {
      next.delete(campaignId);
    } else {
      next.add(campaignId);
      if (!adsets[campaignId]) {
        const res = await fetch(`/api/meta/adsets?campaign_id=${campaignId}`);
        const data = await res.json();
        const adsetList: AdSet[] = (data.data || []).sort((a: AdSet, b: AdSet) => {
          if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
          if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
          return a.name.localeCompare(b.name);
        });
        setAdsets((prev) => ({ ...prev, [campaignId]: adsetList }));
        fetchAdsetInsights(campaignId, adsetList);
      }
    }
    setExpanded(next);
  };

  const toggleStatus = async (id: string, type: "campaign" | "adset", currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const endpoint = type === "campaign" ? "/api/meta/campaigns" : "/api/meta/adsets";
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      toast.success(`${type === "campaign" ? "Campaign" : "Ad Set"} ${newStatus.toLowerCase()}`);
      fetchCampaigns();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const saveBudget = async () => {
    if (!editBudget) return;
    const budgetCents = Math.round(parseFloat(editBudget.value) * 100);
    const endpoint = editBudget.type === "campaign" ? "/api/meta/campaigns" : "/api/meta/adsets";
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editBudget.id, daily_budget: budgetCents }),
      });
      toast.success("Budget updated");
      setEditBudget(null);
      fetchCampaigns();
    } catch {
      toast.error("Failed to update budget");
    }
  };

  const handleDuplicate = (adset: AdSet) => {
    setDuplicateSource(adset);
    setDuplicateName(`${adset.name} (copy)`);
    setDuplicateTarget("");
    setShowDuplicate(true);
  };

  const handleDuplicateSubmit = async () => {
    if (!duplicateSource || !duplicateTarget) return;
    setDuplicating(true);
    try {
      const res = await fetch("/api/meta/adsets/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAdsetId: duplicateSource.id,
          targetCampaignId: duplicateTarget,
          newName: duplicateName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to duplicate");
      toast.success(`Duplicated ad set with ${data.totalAds} ads`);
      setShowDuplicate(false);
      const targetRes = await fetch(`/api/meta/adsets?campaign_id=${duplicateTarget}`);
      const targetData = await targetRes.json();
      setAdsets((prev) => ({ ...prev, [duplicateTarget]: targetData.data || [] }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setDuplicating(false);
    }
  };

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatBudget = (daily?: string, lifetime?: string) => {
    if (daily) return `${(parseFloat(daily) / 100).toFixed(0)} SEK/day`;
    if (lifetime) return `${(parseFloat(lifetime) / 100).toFixed(0)} SEK`;
    return "-";
  };

  const MetricCell = ({ value, suffix = "", color }: { value: number; suffix?: string; color?: string }) => (
    <td className={cn("px-3 py-3 text-right text-sm tabular-nums", color || "text-slate-300")}>
      {value > 0 ? `${value.toLocaleString("sv-SE", { maximumFractionDigits: value < 10 ? 2 : 0 })}${suffix}` : "-"}
    </td>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white/5 border-white/10 text-sm placeholder:text-slate-500"
          />
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["today", "3", "7", "14", "30"] as DatePreset[]).map((d) => (
            <button
              key={d}
              onClick={() => setDatePreset(d)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                datePreset === d ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              {d === "today" ? "Today" : `${d}d`}
            </button>
          ))}
        </div>
        <button
          onClick={fetchCampaigns}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="w-10 px-3 py-3" />
              <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3 min-w-[200px]">Name</th>
              <th className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Budget</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Spend</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Purch.</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">CPA</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">ROAS</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">CTR</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">CPC</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">CPM</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Hook%</th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.map((c) => {
              const m = campaignMetrics.get(c.id) || EMPTY_METRICS;
              return (
                <>
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => toggleExpand(c.id)}
                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
                      >
                        {expanded.has(c.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-medium text-white truncate max-w-[250px]" title={c.name}>{c.name}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={c.status === "ACTIVE"} onCheckedChange={() => toggleStatus(c.id, "campaign", c.status)} />
                        <span className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
                          c.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-400 border-white/10"
                        )}>
                          {c.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-slate-300">
                      {editBudget?.id === c.id ? (
                        <Input
                          className="ml-auto w-24 h-7 text-right bg-white/5 border-white/10"
                          value={editBudget.value}
                          onChange={(e) => setEditBudget({ ...editBudget, value: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                          onBlur={saveBudget}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-cyan-400 transition-colors whitespace-nowrap"
                          onClick={() => setEditBudget({ id: c.id, type: "campaign", value: String(parseFloat(c.daily_budget || "0") / 100) })}
                        >
                          {formatBudget(c.daily_budget, c.lifetime_budget)}
                        </span>
                      )}
                    </td>
                    <MetricCell value={m.spend} suffix=" SEK" />
                    <td className="px-3 py-3 text-right text-sm font-medium text-slate-200">{m.purchases || "-"}</td>
                    <MetricCell value={m.cpa} suffix=" SEK" />
                    <td className="px-3 py-3 text-right text-sm font-semibold">
                      <span className={cn(
                        m.roas >= 2 ? "text-emerald-400" : m.roas >= 1.42 ? "text-amber-400" : m.roas > 0 ? "text-red-400" : "text-slate-500"
                      )}>
                        {m.roas > 0 ? `${m.roas.toFixed(2)}x` : "-"}
                      </span>
                    </td>
                    <MetricCell value={m.ctr} suffix="%" />
                    <MetricCell value={m.cpc} suffix=" SEK" />
                    <MetricCell value={m.cpm} suffix=" SEK" />
                    <MetricCell value={m.hookRate} suffix="%" />
                    <td className="px-3 py-3">
                      <span className="font-mono text-[10px] text-slate-600">{c.id.slice(-6)}</span>
                    </td>
                  </tr>
                  {expanded.has(c.id) && adsets[c.id]?.map((as) => {
                    const am = adsetMetrics.get(as.id) || EMPTY_METRICS;
                    return (
                      <tr key={as.id} className="border-b border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5 pl-10 text-slate-300 truncate max-w-[230px]" title={as.name}>
                          <span className="text-slate-600 mr-1">└</span>{as.name}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch checked={as.status === "ACTIVE"} onCheckedChange={() => toggleStatus(as.id, "adset", as.status)} />
                            <span className={cn(
                              "text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
                              as.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-400 border-white/10"
                            )}>
                              {as.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm">
                          {editBudget?.id === as.id ? (
                            <Input
                              className="ml-auto w-24 h-7 text-right bg-white/5 border-white/10"
                              value={editBudget.value}
                              onChange={(e) => setEditBudget({ ...editBudget, value: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                              onBlur={saveBudget}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer text-slate-400 hover:text-cyan-400 transition-colors whitespace-nowrap"
                              onClick={() => setEditBudget({ id: as.id, type: "adset", value: String(parseFloat(as.daily_budget || "0") / 100) })}
                            >
                              {formatBudget(as.daily_budget, as.lifetime_budget)}
                            </span>
                          )}
                        </td>
                        <MetricCell value={am.spend} suffix=" SEK" />
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-slate-300">{am.purchases || "-"}</td>
                        <MetricCell value={am.cpa} suffix=" SEK" />
                        <td className="px-3 py-2.5 text-right text-sm font-semibold">
                          <span className={cn(
                            am.roas >= 2 ? "text-emerald-400" : am.roas >= 1.42 ? "text-amber-400" : am.roas > 0 ? "text-red-400" : "text-slate-500"
                          )}>
                            {am.roas > 0 ? `${am.roas.toFixed(2)}x` : "-"}
                          </span>
                        </td>
                        <MetricCell value={am.ctr} suffix="%" />
                        <MetricCell value={am.cpc} suffix=" SEK" />
                        <MetricCell value={am.cpm} suffix=" SEK" />
                        <MetricCell value={am.hookRate} suffix="%" />
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => handleDuplicate(as)}
                            className="p-1.5 rounded hover:bg-cyan-500/10 text-slate-500 hover:text-cyan-400 transition-all"
                            title="Duplicate to another campaign"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
            {campaigns.length === 0 && !loading && (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-500">
                  No campaigns found. Connect your Meta account and create campaigns first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Duplicate Ad Set Dialog */}
      <Dialog open={showDuplicate} onOpenChange={setShowDuplicate}>
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
              <p className="text-sm font-medium text-white">{duplicateSource?.name}</p>
              <p className="text-xs text-slate-600 font-mono mt-1">ID: {duplicateSource?.id}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">New Name</label>
              <Input value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} className="bg-white/5 border-white/10 placeholder:text-slate-600" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Target Campaign</label>
              <Select value={duplicateTarget} onValueChange={setDuplicateTarget}>
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Select target campaign..." /></SelectTrigger>
                <SelectContent className="bg-[#111827] border-white/10">
                  {campaigns.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowDuplicate(false)} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all">Cancel</button>
            <button onClick={handleDuplicateSubmit} disabled={duplicating || !duplicateTarget}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50">
              {duplicating ? <><Loader2 className="h-4 w-4 animate-spin" /> Duplicating...</> : <><Copy className="h-4 w-4" /> Duplicate</>}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
