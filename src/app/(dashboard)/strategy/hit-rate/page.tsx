"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type HitRateData = {
  totalTested: number;
  breakthroughs: number;
  hitRate: number;
  thisMonth: { tested: number; breakthroughs: number };
  weeklyTrend: { week: string; tested: number; breakthroughs: number; hitRate: number }[];
  perAuthor: { name: string; tested: number; breakthroughs: number; hitRate: number }[];
  perDesire: { name: string; tested: number; breakthroughs: number; hitRate: number }[];
};

export default function HitRatePage() {
  const [data, setData] = useState<HitRateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/strategy/hit-rate?months=${months}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Hit Rate</h1>
            <p className="text-sm text-slate-400">Andel ads som blir breakthroughs</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10 p-0.5">
          {[{ v: 3, l: "3 mån" }, { v: 6, l: "6 mån" }, { v: 12, l: "I år" }].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setMonths(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${months === v ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <div className="text-xs text-slate-500 mb-1">Hit Rate</div>
          <div className="text-2xl font-bold text-emerald-400">{data.hitRate.toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <div className="text-xs text-slate-500 mb-1">Totalt Testade</div>
          <div className="text-2xl font-bold text-white">{data.totalTested}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <div className="text-xs text-slate-500 mb-1">Breakthroughs</div>
          <div className="text-2xl font-bold text-emerald-400">{data.breakthroughs}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <div className="text-xs text-slate-500 mb-1">Denna Månad</div>
          <div className="text-2xl font-bold text-white">
            {data.thisMonth.breakthroughs}/{data.thisMonth.tested}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      {data.weeklyTrend.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <h2 className="text-sm font-semibold text-white mb-4">Hit Rate per vecka</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyTrend}>
                <defs>
                  <linearGradient id="hitRateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="week" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#10b981" }}
                />
                <Area type="monotone" dataKey="hitRate" stroke="#10b981" fill="url(#hitRateGrad)" strokeWidth={2} name="Hit Rate %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-2 gap-4">
        {/* Per Author */}
        <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Per Kreatör</h2>
          {data.perAuthor.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen data (koppla koncept till kreatörer i Roadmap)</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left pb-2 text-xs text-slate-500">Namn</th>
                  <th className="text-right pb-2 text-xs text-slate-500">Testade</th>
                  <th className="text-right pb-2 text-xs text-slate-500">BT</th>
                  <th className="text-right pb-2 text-xs text-slate-500">Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.perAuthor.map((a) => (
                  <tr key={a.name} className="border-b border-white/5">
                    <td className="py-2 text-slate-300">{a.name}</td>
                    <td className="py-2 text-right text-slate-400">{a.tested}</td>
                    <td className="py-2 text-right text-emerald-400">{a.breakthroughs}</td>
                    <td className="py-2 text-right text-white font-medium">{a.hitRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Per Desire */}
        <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Per Kundproblem</h2>
          {data.perDesire.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen data (koppla koncept till desires i Roadmap)</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left pb-2 text-xs text-slate-500">Desire</th>
                  <th className="text-right pb-2 text-xs text-slate-500">Testade</th>
                  <th className="text-right pb-2 text-xs text-slate-500">BT</th>
                  <th className="text-right pb-2 text-xs text-slate-500">Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.perDesire.map((d) => (
                  <tr key={d.name} className="border-b border-white/5">
                    <td className="py-2 text-slate-300 truncate max-w-[200px]">{d.name}</td>
                    <td className="py-2 text-right text-slate-400">{d.tested}</td>
                    <td className="py-2 text-right text-emerald-400">{d.breakthroughs}</td>
                    <td className="py-2 text-right text-white font-medium">{d.hitRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
