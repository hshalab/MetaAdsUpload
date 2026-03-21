"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  Trophy,
  ChevronDown,
  ChevronRight,
  Users,
  CheckCircle2,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorAd {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  hookRate: number;
  bonus: number;
  bonusTier: string | null;
}

interface EditorData {
  editor: string;
  totalSpend: number;
  totalPurchaseValue: number;
  totalPurchases: number;
  totalImpressions: number;
  roas: number;
  ctr: number;
  totalBonus: number;
  adCount: number;
  ads: EditorAd[];
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function BonusBadge({ bonus }: { bonus: number }) {
  if (bonus === 0) return <span className="text-slate-500 text-sm">-</span>;
  const color =
    bonus >= 50 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
    bonus >= 30 ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
    bonus >= 20 ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

  return (
    <Badge variant="outline" className={color}>
      <Trophy className="h-3 w-3 mr-1" />
      ${bonus}
    </Badge>
  );
}

function EditorRow({ editor }: { editor: EditorData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 font-medium text-slate-200">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            )}
            {editor.editor}
            <span className="text-xs text-slate-500">
              ({editor.adCount} ad{editor.adCount !== 1 ? "s" : ""})
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-300">${fmt(editor.totalSpend, 2)}</td>
        <td className="px-4 py-3 text-right text-sm text-slate-300">${fmt(editor.totalPurchaseValue, 2)}</td>
        <td className="px-4 py-3 text-right text-sm font-semibold">
          <span className={editor.roas >= 2.5 ? "text-emerald-400" : editor.roas >= 2.0 ? "text-amber-400" : "text-red-400"}>
            {editor.roas.toFixed(2)}x
          </span>
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-300">{editor.totalPurchases}</td>
        <td className="px-4 py-3 text-right text-sm text-slate-400">{editor.ctr.toFixed(2)}%</td>
        <td className="px-4 py-3 text-right">
          <span className="font-semibold text-emerald-400">${fmt(editor.totalBonus)}</span>
        </td>
      </tr>
      {expanded &&
        editor.ads.map((ad) => (
          <tr key={ad.id} className="border-b border-white/5 bg-white/[0.01]">
            <td className="px-4 py-2.5 pl-12 text-sm text-slate-500">{ad.name}</td>
            <td className="px-4 py-2.5 text-right text-sm text-slate-400">${fmt(ad.spend, 2)}</td>
            <td className="px-4 py-2.5 text-right text-sm text-slate-400">${fmt(ad.purchaseValue, 2)}</td>
            <td className="px-4 py-2.5 text-right text-sm">
              <span className={ad.roas >= 2.5 ? "text-emerald-400" : ad.roas >= 2.0 ? "text-amber-400" : "text-red-400"}>
                {ad.roas.toFixed(2)}x
              </span>
            </td>
            <td className="px-4 py-2.5 text-right text-sm text-slate-400">{ad.purchases}</td>
            <td className="px-4 py-2.5 text-right text-sm text-slate-500">{ad.ctr.toFixed(2)}%</td>
            <td className="px-4 py-2.5 text-right">
              <BonusBadge bonus={ad.bonus} />
            </td>
          </tr>
        ))}
    </>
  );
}

interface AssignmentStat {
  editorName: string;
  completedAssignments: number;
  avgEditingMinutes: number;
  revisionRate: number;
  totalTrackedHours: number;
}

export default function EditorsPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [editors, setEditors] = useState<EditorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStat[]>([]);

  const fetchEditors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
      });
      const [editorsRes, statsRes] = await Promise.all([
        fetch(`/api/editors?${params}`),
        fetch("/api/editors/assignment-stats").catch(() => null),
      ]);
      if (!editorsRes.ok) throw new Error("Failed to fetch");
      const data = await editorsRes.json();
      setEditors(data.editors);

      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        setAssignmentStats(statsData.editors || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchEditors();
  }, [fetchEditors]);

  const totalSpend = editors.reduce((s, e) => s + e.totalSpend, 0);
  const totalRevenue = editors.reduce((s, e) => s + e.totalPurchaseValue, 0);
  const totalBonus = editors.reduce((s, e) => s + e.totalBonus, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Editor Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ad performance and bonus tracking per video editor
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
          <button
            onClick={fetchEditors}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Editors", value: loading ? "..." : editors.length, icon: Users, glow: "glow-cyan", iconBg: "bg-cyan-500/10", iconColor: "text-cyan-400" },
          { title: "Total Ad Spend", value: loading ? "..." : `$${fmt(totalSpend, 2)}`, icon: DollarSign, glow: "glow-purple", iconBg: "bg-purple-500/10", iconColor: "text-purple-400" },
          { title: "Overall ROAS", value: loading ? "..." : `${overallRoas.toFixed(2)}x`, icon: TrendingUp, glow: "glow-green", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
          { title: "Total Bonuses", value: loading ? "..." : `$${fmt(totalBonus)}`, icon: Trophy, glow: "glow-amber", iconBg: "bg-amber-500/10", iconColor: "text-amber-400", valueColor: "text-emerald-400" },
        ].map((card) => (
          <div key={card.title} className={cn("rounded-xl border bg-[#111827] p-4 transition-all", card.glow)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{card.title}</span>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", card.iconBg)}>
                <card.icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
            </div>
            <div className={cn("text-2xl font-bold", card.valueColor || "text-white", loading && "animate-pulse")}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Payout Card */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 glow-green">
        <div className="flex items-center gap-2 mb-2">
          <Banknote className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Total Payouts</span>
        </div>
        <div className="text-3xl font-bold text-emerald-400">
          {loading ? "..." : `$${fmt(totalBonus)}`}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Total bonuses earned this period across {editors.length} editor{editors.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Assignment Stats */}
      {assignmentStats.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Assignment Performance</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["Editor", "Completed", "Avg Edit Time", "Revision Rate", "Total Hours"].map((h, i) => (
                  <th key={h} className={cn("px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignmentStats.map((stat) => (
                <tr key={stat.editorName} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm font-medium text-slate-200">{stat.editorName}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-300">{stat.completedAssignments}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-400">
                    {stat.avgEditingMinutes > 0 ? `${Math.round(stat.avgEditingMinutes)}m` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={stat.revisionRate > 30 ? "text-red-400" : stat.revisionRate > 15 ? "text-amber-400" : "text-emerald-400"}>
                      {stat.revisionRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-400">{stat.totalTrackedHours.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bonus Tiers */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Bonus Tiers</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "$10 — $500+ spend, 2.5+ ROAS", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
            { label: "$20 — $1,000+ spend, 2.5+ ROAS", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            { label: "$30 — $3,750+ spend, 2.0+ ROAS", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
            { label: "$50 — $7,500+ spend, 2.0+ ROAS", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
          ].map((tier) => (
            <Badge key={tier.label} variant="outline" className={tier.color}>{tier.label}</Badge>
          ))}
        </div>
      </div>

      {/* Editor Table */}
      <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Editor Breakdown</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {["Editor", "Spend", "Revenue", "ROAS", "Purchases", "CTR", "Bonus"].map((h, i) => (
                <th key={h} className={cn("px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider", i > 0 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  Loading editor data...
                </td>
              </tr>
            ) : editors.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  No editor data found. Ads must follow naming convention: &quot;SE EditorName ...&quot;
                </td>
              </tr>
            ) : (
              editors.map((editor) => (
                <EditorRow key={editor.editor} editor={editor} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
