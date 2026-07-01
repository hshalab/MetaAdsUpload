"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Trophy } from "lucide-react";

interface Scorecard {
  userId: string;
  name: string;
  newVideos: number;
  revisions: number;
  outputMinutes: number;
  loggedHours: number;
  minutesPerLoggedHour: number | null;
  avgTurnaroundHours: number | null;
  onTimePct: number | null;
  firstTryApprovalPct: number | null;
  honestyFlags: { longSessions: number; loggedButNoOutput: number };
}

const WINDOWS = [
  { days: 7, label: "This week" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function fmt(v: number | null, suffix = ""): string {
  return v == null ? "—" : `${v}${suffix}`;
}

export default function ScorecardsPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Scorecard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/editors/scorecard?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((d) => { if (!cancelled) { setData(d.scorecards); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [days]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Editor Scorecards</h1>
          <p className="text-sm text-slate-500 mt-1">Output, speed, quality and consistency — per editor.</p>
        </div>
        <div className="flex gap-1 border border-white/[0.06] rounded-lg p-1">
          {WINDOWS.map((w) => (
            <button key={w.days} onClick={() => setDays(w.days)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                days === w.days ? "bg-cyan-500/10 text-cyan-400" : "text-slate-500 hover:text-slate-300")}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Loading…</p>}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-500 text-left">
                <th className="px-4 py-3 font-medium">Editor</th>
                <th className="px-3 py-3 font-medium text-right">New videos</th>
                <th className="px-3 py-3 font-medium text-right">Revisions</th>
                <th className="px-3 py-3 font-medium text-right">Output (min)</th>
                <th className="px-3 py-3 font-medium text-right">Logged (h)</th>
                <th className="px-3 py-3 font-medium text-right" title="Edited output minutes per logged hour">Min/h</th>
                <th className="px-3 py-3 font-medium text-right" title="Average assigned → completed">Turnaround (h)</th>
                <th className="px-3 py-3 font-medium text-right">On-time</th>
                <th className="px-3 py-3 font-medium text-right" title="Assignments approved with a single version">1st-try ✓</th>
                <th className="px-3 py-3 font-medium text-right" title="Timer entries >6h, or 1h+ logged with zero output">Flags</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => {
                const flags = s.honestyFlags.longSessions + s.honestyFlags.loggedButNoOutput;
                return (
                  <tr key={s.userId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium flex items-center gap-2">
                      {i === 0 && s.outputMinutes > 0 && <Trophy className="h-3.5 w-3.5 text-yellow-400" />}
                      {s.name}
                    </td>
                    <td className="px-3 py-3 text-right text-white font-mono">{s.newVideos}</td>
                    <td className="px-3 py-3 text-right text-slate-400 font-mono">{s.revisions}</td>
                    <td className="px-3 py-3 text-right text-white font-mono">{s.outputMinutes}</td>
                    <td className="px-3 py-3 text-right text-slate-400 font-mono">{s.loggedHours}</td>
                    <td className="px-3 py-3 text-right text-slate-400 font-mono">{fmt(s.minutesPerLoggedHour)}</td>
                    <td className="px-3 py-3 text-right text-slate-400 font-mono">{fmt(s.avgTurnaroundHours)}</td>
                    <td className={cn("px-3 py-3 text-right font-mono",
                      s.onTimePct == null ? "text-slate-600" : s.onTimePct >= 80 ? "text-emerald-400" : s.onTimePct >= 50 ? "text-yellow-400" : "text-red-400")}>
                      {fmt(s.onTimePct, "%")}
                    </td>
                    <td className={cn("px-3 py-3 text-right font-mono",
                      s.firstTryApprovalPct == null ? "text-slate-600" : s.firstTryApprovalPct >= 70 ? "text-emerald-400" : "text-yellow-400")}>
                      {fmt(s.firstTryApprovalPct, "%")}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {flags > 0 ? (
                        <span className="inline-flex items-center gap-1 text-yellow-400 font-mono"
                          title={`${s.honestyFlags.longSessions} sessions over 6h · ${s.honestyFlags.loggedButNoOutput} entries with 1h+ logged but no output`}>
                          <AlertTriangle className="h-3 w-3" /> {flags}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-600 max-w-2xl">
        Min/h = edited output minutes per logged hour (higher = more efficient). Flags are signals to look into, not verdicts —
        a 7-hour timer can be legit on a heavy edit. Compare trends between editors and weeks rather than single numbers.
      </p>
    </div>
  );
}
