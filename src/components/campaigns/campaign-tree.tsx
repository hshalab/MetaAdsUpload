"use client";

import { useState, useEffect } from "react";
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
import { ChevronDown, ChevronRight, RefreshCw, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
}

interface AdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  daily_budget?: string;
}

export function CampaignTree() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<Record<string, AdSet[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editBudget, setEditBudget] = useState<{ id: string; type: "campaign" | "adset"; value: string } | null>(null);

  // Duplicate state
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<AdSet | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState("");
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta/campaigns");
      const data = await res.json();
      setCampaigns(data.data || []);
    } catch {
      toast.error("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const toggleExpand = async (campaignId: string) => {
    const next = new Set(expanded);
    if (next.has(campaignId)) {
      next.delete(campaignId);
    } else {
      next.add(campaignId);
      if (!adsets[campaignId]) {
        const res = await fetch(`/api/meta/adsets?campaign_id=${campaignId}`);
        const data = await res.json();
        setAdsets((prev) => ({ ...prev, [campaignId]: data.data || [] }));
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
      // Refresh the target campaign's adsets
      const targetRes = await fetch(`/api/meta/adsets?campaign_id=${duplicateTarget}`);
      const targetData = await targetRes.json();
      setAdsets((prev) => ({ ...prev, [duplicateTarget]: targetData.data || [] }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={fetchCampaigns}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="w-10 px-4 py-3" />
              <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Name</th>
              <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Objective</th>
              <th className="text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Daily Budget</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <>
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
                    >
                      {expanded.has(c.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={c.status === "ACTIVE"} onCheckedChange={() => toggleStatus(c.id, "campaign", c.status)} />
                      <span className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                        c.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-white/5 text-slate-400 border-white/10"
                      )}>
                        {c.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.objective?.replace("OUTCOME_", "") || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {editBudget?.id === c.id ? (
                      <Input
                        className="ml-auto w-28 h-7 text-right bg-white/5 border-white/10"
                        value={editBudget.value}
                        onChange={(e) => setEditBudget({ ...editBudget, value: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                        onBlur={saveBudget}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer text-slate-300 hover:text-white transition-colors"
                        onClick={() => setEditBudget({ id: c.id, type: "campaign", value: String(parseFloat(c.daily_budget || "0") / 100) })}
                      >
                        {c.daily_budget ? `${(parseFloat(c.daily_budget) / 100).toFixed(0)} SEK` : "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] text-slate-600">{c.id}</span>
                  </td>
                </tr>
                {expanded.has(c.id) && adsets[c.id]?.map((as) => (
                  <tr key={as.id} className="border-b border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 pl-12 text-slate-300">{as.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Switch checked={as.status === "ACTIVE"} onCheckedChange={() => toggleStatus(as.id, "adset", as.status)} />
                        <span className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          as.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-white/5 text-slate-400 border-white/10"
                        )}>
                          {as.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-right">
                      {editBudget?.id === as.id ? (
                        <Input
                          className="ml-auto w-28 h-7 text-right bg-white/5 border-white/10"
                          value={editBudget.value}
                          onChange={(e) => setEditBudget({ ...editBudget, value: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                          onBlur={saveBudget}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer text-slate-400 hover:text-white transition-colors"
                          onClick={() => setEditBudget({ id: as.id, type: "adset", value: String(parseFloat(as.daily_budget || "0") / 100) })}
                        >
                          {as.daily_budget ? `${(parseFloat(as.daily_budget) / 100).toFixed(0)} SEK` : "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDuplicate(as)}
                          className="p-1.5 rounded hover:bg-cyan-500/10 text-slate-500 hover:text-cyan-400 transition-all"
                          title="Duplicate to another campaign"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <span className="font-mono text-[10px] text-slate-600">{as.id}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            ))}
            {campaigns.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No campaigns found. Publish an assignment or create a campaign from the Upload page.
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
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                className="bg-white/5 border-white/10 placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Target Campaign</label>
              <Select value={duplicateTarget} onValueChange={setDuplicateTarget}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Select target campaign..." />
                </SelectTrigger>
                <SelectContent className="bg-[#111827] border-white/10">
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowDuplicate(false)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDuplicateSubmit}
              disabled={duplicating || !duplicateTarget}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
            >
              {duplicating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Duplicating...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Duplicate
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
