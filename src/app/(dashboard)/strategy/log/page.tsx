"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type LogEntry = {
  id: number;
  adId: string;
  classification: string;
  actionTaken: string;
  actionTakenAt: string;
  spend: number;
  roas: number;
  cpa: number;
  adName: string | null;
  adsetName: string | null;
  recommendation: string | null;
};

const classColors: Record<string, string> = {
  breakthrough: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  spend_winner: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  kpi_winner: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  loser: "bg-red-500/10 text-red-400 border-red-500/20",
  new: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const actionLabels: Record<string, string> = {
  move_zombie: "Graveyard",
  pause: "Pausad",
  let_run: "Låter köra",
  reviewed: "Granskad",
};

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/strategy/log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to, offset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatDate = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Extract a readable name from recommendation or fallback to adsetName/adId
  const getDisplayName = (e: LogEntry) => {
    // recommendation often contains the ad set name in quotes like "[GY] Name..." or "Graveyard (Name)"
    if (e.adsetName) return e.adsetName;
    if (e.adName) return e.adName;
    // Try to extract name from recommendation
    if (e.recommendation) {
      const match = e.recommendation.match(/["""]([^"""]+)["""]/);
      if (match) return match[1];
    }
    return e.adId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <ScrollText className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Aktivitetslogg</h1>
          <p className="text-sm text-slate-400">Historik över alla kill/post/pause-åtgärder</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Från</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setOffset(0); }}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Till</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setOffset(0); }}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
          />
        </div>
        <span className="text-xs text-slate-500">{total} åtgärder totalt</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-[#111827] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ad Set / Ad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Klassificering</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Åtgärd</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Detaljer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Spend</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ROAS</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">CPA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-cyan-400 mx-auto" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Inga åtgärder hittades</td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(e.actionTakenAt)}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200 font-medium truncate max-w-[250px]">{getDisplayName(e)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs border", classColors[e.classification] || "text-slate-400")}>
                        {e.classification}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{actionLabels[e.actionTaken] || e.actionTaken}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-500 truncate max-w-[300px]" title={e.recommendation || ""}>
                        {e.recommendation || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{e.spend?.toFixed(0)} kr</td>
                    <td className="px-4 py-3 text-right text-slate-300">{e.roas?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{e.cpa?.toFixed(0)} kr</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Visar {offset + 1}–{Math.min(offset + limit, total)} av {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
