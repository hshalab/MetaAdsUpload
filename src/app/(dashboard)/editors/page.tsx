"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EditorAd {
  id: string;
  name: string;
  assignmentId: string | null;
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

interface Payout {
  id: number;
  editorId: string;
  amount: number;
  currency: string;
  periodFrom: string;
  periodTo: string;
  status: string;
  paidAt: string | null;
  notes: string | null;
  breakdown: Array<{ adId: string; adName: string; spend: number; roas: number; bonus: number }>;
}

interface EditorData {
  editorId: string;
  editor: string;
  totalSpend: number;
  totalPurchaseValue: number;
  totalPurchases: number;
  totalImpressions: number;
  roas: number;
  ctr: number;
  totalBonus: number;
  paidAmount: number;
  pendingAmount: number;
  unpaidAmount: number;
  adCount: number;
  ads: EditorAd[];
  payouts: Payout[];
}

interface AssignmentStat {
  editorId: string;
  editorName: string;
  completedAssignments: number;
  avgEditingMinutes: number;
  revisionRate: number;
  totalTrackedHours: number;
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

function PayoutStatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Check className="h-3 w-3" /> Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

function EditorRow({ editor, onCreatePayout, onMarkPaid }: {
  editor: EditorData;
  onCreatePayout: (editor: EditorData) => void;
  onMarkPaid: (payoutId: number) => void;
}) {
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
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {editor.paidAmount > 0 && (
              <span className="text-xs text-emerald-400">${fmt(editor.paidAmount)} paid</span>
            )}
            {editor.unpaidAmount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreatePayout(editor); }}
                className="text-[10px] font-medium px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all"
              >
                Create Payout
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <>
          {/* Ad rows */}
          {editor.ads.map((ad) => (
            <tr key={ad.id} className="border-b border-white/5 bg-white/[0.01]">
              <td className="px-4 py-2.5 pl-12 text-sm text-slate-500">
                {ad.name}
                {ad.assignmentId && (
                  <span className="ml-2 text-[10px] text-cyan-400/60">linked</span>
                )}
              </td>
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
              <td />
            </tr>
          ))}
          {/* Payout history */}
          {editor.payouts.length > 0 && (
            <tr className="border-b border-white/5 bg-emerald-500/[0.02]">
              <td colSpan={8} className="px-4 py-3 pl-12">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Payout History</div>
                <div className="space-y-1.5">
                  {editor.payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <PayoutStatusBadge status={p.status} />
                        <span className="text-slate-300 font-medium">${fmt(p.amount, 2)}</span>
                        <span className="text-xs text-slate-500">{p.periodFrom} — {p.periodTo}</span>
                        {p.notes && <span className="text-xs text-slate-600 italic">{p.notes}</span>}
                      </div>
                      {p.status === "pending" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onMarkPaid(p.id); }}
                          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                        >
                          <Check className="h-3 w-3" /> Mark Paid
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

export default function EditorsPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [editors, setEditors] = useState<EditorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStat[]>([]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutEditor, setPayoutEditor] = useState<EditorData | null>(null);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [creatingPayout, setCreatingPayout] = useState(false);

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

  useEffect(() => { fetchEditors(); }, [fetchEditors]);

  const handleCreatePayout = (editor: EditorData) => {
    setPayoutEditor(editor);
    setPayoutNotes("");
    setShowPayoutModal(true);
  };

  const handleSubmitPayout = async () => {
    if (!payoutEditor) return;
    setCreatingPayout(true);
    try {
      const breakdown = payoutEditor.ads
        .filter((a) => a.bonus > 0)
        .map((a) => ({
          adId: a.id,
          adName: a.name,
          spend: a.spend,
          roas: a.roas,
          bonus: a.bonus,
        }));

      const res = await fetch("/api/editors/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorId: payoutEditor.editorId,
          amount: payoutEditor.unpaidAmount,
          periodFrom: format(dateRange.from, "yyyy-MM-dd"),
          periodTo: format(dateRange.to, "yyyy-MM-dd"),
          adIds: payoutEditor.ads.filter((a) => a.bonus > 0).map((a) => a.id),
          assignmentIds: payoutEditor.ads.filter((a) => a.assignmentId).map((a) => a.assignmentId),
          breakdown,
          notes: payoutNotes || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create payout");
      toast.success(`Payout of $${fmt(payoutEditor.unpaidAmount)} created for ${payoutEditor.editor}`);
      setShowPayoutModal(false);
      fetchEditors();
    } catch {
      toast.error("Failed to create payout");
    } finally {
      setCreatingPayout(false);
    }
  };

  const handleMarkPaid = async (payoutId: number) => {
    try {
      const res = await fetch("/api/editors/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payoutId, status: "paid" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Payout marked as paid");
      fetchEditors();
    } catch {
      toast.error("Failed to update payout");
    }
  };

  const totalSpend = editors.reduce((s, e) => s + e.totalSpend, 0);
  const totalRevenue = editors.reduce((s, e) => s + e.totalPurchaseValue, 0);
  const totalBonus = editors.reduce((s, e) => s + e.totalBonus, 0);
  const totalPaid = editors.reduce((s, e) => s + e.paidAmount, 0);
  const totalUnpaid = editors.reduce((s, e) => s + e.unpaidAmount, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="h-6 w-6 text-cyan-400" />
            Editor Performance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ad performance, bonus tracking and payouts per video editor
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
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
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { title: "Editors", value: loading ? "..." : editors.length, icon: Users, glow: "glow-cyan", iconBg: "bg-cyan-500/10", iconColor: "text-cyan-400" },
          { title: "Total Ad Spend", value: loading ? "..." : `$${fmt(totalSpend, 2)}`, icon: DollarSign, glow: "glow-purple", iconBg: "bg-purple-500/10", iconColor: "text-purple-400" },
          { title: "Overall ROAS", value: loading ? "..." : `${overallRoas.toFixed(2)}x`, icon: TrendingUp, glow: "glow-green", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
          { title: "Total Bonuses", value: loading ? "..." : `$${fmt(totalBonus)}`, icon: Trophy, glow: "glow-amber", iconBg: "bg-amber-500/10", iconColor: "text-amber-400", valueColor: "text-emerald-400" },
          { title: "Unpaid", value: loading ? "..." : `$${fmt(totalUnpaid)}`, icon: AlertCircle, glow: totalUnpaid > 0 ? "glow-amber" : "", iconBg: totalUnpaid > 0 ? "bg-red-500/10" : "bg-white/5", iconColor: totalUnpaid > 0 ? "text-red-400" : "text-slate-500", valueColor: totalUnpaid > 0 ? "text-red-400" : "text-slate-400" },
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

      {/* Payout Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 glow-green">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Total Paid</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400">
            {loading ? "..." : `$${fmt(totalPaid)}`}
          </div>
          <p className="text-xs text-slate-500 mt-1">Bonuses marked as paid this period</p>
        </div>
        <div className={cn(
          "rounded-xl border p-5",
          totalUnpaid > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-white/5 bg-[#111827]"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className={cn("h-4 w-4", totalUnpaid > 0 ? "text-amber-400" : "text-slate-500")} />
            <span className={cn("text-xs font-medium uppercase tracking-wider", totalUnpaid > 0 ? "text-amber-400" : "text-slate-500")}>Pending / Unpaid</span>
          </div>
          <div className={cn("text-3xl font-bold", totalUnpaid > 0 ? "text-amber-400" : "text-slate-500")}>
            {loading ? "..." : `$${fmt(totalUnpaid)}`}
          </div>
          <p className="text-xs text-slate-500 mt-1">Bonuses not yet paid out</p>
        </div>
      </div>

      {/* Assignment Stats */}
      {assignmentStats.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
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
                <tr key={stat.editorId} className="border-b border-white/5 hover:bg-white/[0.02]">
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["Editor", "Spend", "Revenue", "ROAS", "Purchases", "CTR", "Bonus", "Payouts"].map((h, i) => (
                  <th key={h} className={cn("px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    Loading editor data...
                  </td>
                </tr>
              ) : editors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No editor data found. Publish assignments to Meta to see performance data here.
                  </td>
                </tr>
              ) : (
                editors.map((editor) => (
                  <EditorRow
                    key={editor.editorId}
                    editor={editor}
                    onCreatePayout={handleCreatePayout}
                    onMarkPaid={handleMarkPaid}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Payout Modal */}
      <Dialog open={showPayoutModal} onOpenChange={setShowPayoutModal}>
        <DialogContent className="max-w-md bg-[#111827] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Create Payout</DialogTitle>
          </DialogHeader>
          {payoutEditor && (
            <div className="space-y-4">
              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-400">Editor</span>
                  <span className="text-sm font-medium text-white">{payoutEditor.editor}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-400">Period</span>
                  <span className="text-sm text-slate-300">
                    {format(dateRange.from, "yyyy-MM-dd")} — {format(dateRange.to, "yyyy-MM-dd")}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-400">Total Bonus</span>
                  <span className="text-sm font-medium text-emerald-400">${fmt(payoutEditor.totalBonus)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-400">Already Paid</span>
                  <span className="text-sm text-slate-300">${fmt(payoutEditor.paidAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/5">
                  <span className="text-sm font-medium text-white">Payout Amount</span>
                  <span className="text-lg font-bold text-emerald-400">${fmt(payoutEditor.unpaidAmount)}</span>
                </div>
              </div>

              {/* Bonus breakdown */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Ad Breakdown</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {payoutEditor.ads.filter((a) => a.bonus > 0).map((ad) => (
                    <div key={ad.id} className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-400 truncate max-w-[200px]">{ad.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">${fmt(ad.spend, 0)} / {ad.roas.toFixed(1)}x</span>
                        <span className="text-emerald-400 font-medium">${ad.bonus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Notes (optional)</label>
                <input
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Swish, bank transfer..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setShowPayoutModal(false)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitPayout}
              disabled={creatingPayout}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-medium text-white hover:from-emerald-400 hover:to-emerald-500 transition-all disabled:opacity-50"
            >
              {creatingPayout ? "Creating..." : "Create Payout"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
