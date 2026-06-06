"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  Trophy,
  DollarSign,
  TrendingUp,
  Target,
  Zap,
  Clock,
  CheckCircle2,
  Lock,
  Flame,
  Video,
  Lightbulb,
  Medal,
} from "lucide-react";
import { nextTierProgress, bonusTierColor, type BonusTier } from "@/lib/bonus";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Ad {
  id: string;
  name: string;
  source: string;
  strategistName: string | null;
  spend: number;
  impressions: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  hookRate: number;
  bonus: number;
  bonusTier: number;
  paidForAd: number;
  outstanding: number;
  lifetimeSpend: number;
  lifetimeRoas: number;
  isWinner: boolean;
}
interface Editor {
  editorId: string;
  editor: string;
  fullName: string;
  slug: string | null;
  userType: string;
  totalSpend: number;
  totalPurchaseValue: number;
  totalPurchases: number;
  roas: number;
  ctr: number;
  hookRate: number;
  totalBonus: number;
  paidAmount: number;
  unpaidAmount: number;
  adCount: number;
  winnerCount: number;
  ads: Ad[];
}
interface LeaderEntry { editorId: string; name: string; winners: number; hookRate: number }
interface ApiResponse {
  editor: Editor;
  timeseries: Array<{ date: string; spend: number; revenue: number; roas: number; purchases: number }>;
  leaderboard: LeaderEntry[];
  bonusTiers: BonusTier[];
  dateRange: { from: string; to: string };
  passwordRequired?: boolean;
}

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
}
function hookColor(h: number) {
  return h >= 30 ? "text-emerald-400" : h >= 20 ? "text-amber-400" : h > 0 ? "text-red-400" : "text-slate-600";
}

export default function PublicEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pwRequired, setPwRequired] = useState(false);
  const [pw, setPw] = useState("");

  const load = useCallback(async (password?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from: isoDaysAgo(days), to: isoDaysAgo(0) });
      if (password) qs.set("pw", password);
      const res = await fetch(`/api/e/${slug}?${qs}`);
      if (res.status === 401) {
        const j = await res.json().catch(() => ({}));
        setPwRequired(true);
        setError(j.error || null);
        setData(null);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Kunde inte ladda");
      }
      setPwRequired(false);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }, [slug, days]);

  useEffect(() => { load(); }, [load]);

  const editor = data?.editor;

  const { winners, inflight } = useMemo(() => {
    const ads = editor?.ads || [];
    return {
      winners: ads.filter((a) => a.bonus > 0).sort((a, b) => b.bonus - a.bonus),
      inflight: ads
        .filter((a) => a.bonus === 0 && a.lifetimeSpend > 0)
        .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
        .slice(0, 6),
    };
  }, [editor]);

  // ── Password gate ──
  if (pwRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111827] p-6 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Lock className="h-5 w-5" />
            <h1 className="text-lg font-semibold text-white">Skyddad sida</h1>
          </div>
          <p className="text-sm text-slate-400">Den här prestationssidan kräver ett lösenord.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(pw)}
            placeholder="Lösenord"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={() => load(pw)}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-all"
          >
            Visa min sida
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12 space-y-8">
      {/* Hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl font-bold text-white shadow-lg shadow-cyan-500/20">
            {(editor?.editor || slug).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
              {editor?.userType === "creative_strategist" ? <Lightbulb className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {editor?.userType === "creative_strategist" ? "Creative Strategist" : "Video Editor"}
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight">{editor?.fullName || slug}</h1>
            <p className="text-sm text-slate-500">Din prestation &amp; bonusöversikt</p>
          </div>
        </div>
        <div className="flex rounded-xl border border-white/10 overflow-hidden self-start">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3.5 py-2 text-xs font-medium transition-all ${
                days === p.days ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/5 bg-[#111827] py-16 text-center text-slate-400">{error}</div>
      ) : editor ? (
        <>
          {/* Bonus headline band */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] p-5">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Trophy className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Intjänad bonus (livstid)</span>
              </div>
              <div className="text-4xl font-bold text-white">${fmt(editor.totalBonus)}</div>
              <p className="text-xs text-slate-500 mt-1">{editor.winnerCount} kvalificerande annonser</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#111827] p-5">
              <div className="flex items-center gap-2 text-cyan-400 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Utbetalt</span>
              </div>
              <div className="text-4xl font-bold text-emerald-400">${fmt(editor.paidAmount)}</div>
              <p className="text-xs text-slate-500 mt-1">redan utbetalt till dig</p>
            </div>
            <div className={`rounded-2xl border p-5 ${editor.unpaidAmount > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-white/5 bg-[#111827]"}`}>
              <div className={`flex items-center gap-2 mb-1 ${editor.unpaidAmount > 0 ? "text-amber-400" : "text-slate-500"}`}>
                <Clock className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Kvar att betala</span>
              </div>
              <div className={`text-4xl font-bold ${editor.unpaidAmount > 0 ? "text-amber-400" : "text-slate-500"}`}>
                ${fmt(editor.unpaidAmount)}
              </div>
              <p className="text-xs text-slate-500 mt-1">väntar på utbetalning</p>
            </div>
          </div>

          {/* KPI cards (period) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={DollarSign} label="Spend" value={`$${fmt(editor.totalSpend, 0)}`} tint="text-purple-400" />
            <Kpi
              icon={TrendingUp}
              label="ROAS"
              value={`${editor.roas.toFixed(2)}x`}
              tint={editor.roas >= 2.5 ? "text-emerald-400" : editor.roas >= 2.0 ? "text-amber-400" : "text-red-400"}
            />
            <Kpi icon={Flame} label="Hook Rate" value={`${editor.hookRate.toFixed(1)}%`} tint={hookColor(editor.hookRate)} sub="mål 30%+" />
            <Kpi icon={Zap} label="Köp" value={fmt(editor.totalPurchases)} tint="text-cyan-400" />
          </div>

          {/* Performance chart */}
          <div className="rounded-2xl border border-white/5 bg-[#111827] p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Din prestation över tid</h2>
              <span className="text-xs text-slate-600">spend (staplar) &amp; ROAS (linje)</span>
            </div>
            {data && data.timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.timeseries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                  <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#0f1629", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <ReferenceLine yAxisId="right" y={2.0} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Bar yAxisId="left" dataKey="spend" name="Spend ($)" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#34d399" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center text-sm text-slate-600">Ingen data i perioden ännu.</div>
            )}
          </div>

          {/* Winners + In-flight */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Winners */}
            <div className="rounded-2xl border border-white/5 bg-[#111827] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                <Trophy className="h-4 w-4 text-yellow-400" />
                <h2 className="text-sm font-semibold text-white">Dina vinnare ({winners.length})</h2>
              </div>
              <div className="divide-y divide-white/5 max-h-[360px] overflow-y-auto">
                {winners.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-slate-600">Inga kvalificerade annonser ännu — fortsätt skapa! 💪</p>
                )}
                {winners.map((ad) => (
                  <div key={ad.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{ad.name}</p>
                      <p className="text-[11px] text-slate-500">
                        ${fmt(ad.lifetimeSpend)} spend · {ad.lifetimeRoas.toFixed(2)}x ROAS
                        {ad.outstanding === 0 && ad.bonus > 0 && <span className="text-emerald-500"> · betald</span>}
                        {ad.outstanding > 0 && <span className="text-amber-400"> · ${fmt(ad.outstanding)} kvar</span>}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold ${bonusTierColor(ad.bonus)}`}>
                      ${ad.bonus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* In-flight toward next bonus */}
            <div className="rounded-2xl border border-white/5 bg-[#111827] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                <Target className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">På väg mot bonus</h2>
              </div>
              <div className="divide-y divide-white/5 max-h-[360px] overflow-y-auto">
                {inflight.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-slate-600">Inga aktiva annonser nära en tier just nu.</p>
                )}
                {inflight.map((ad) => {
                  const prog = nextTierProgress(ad.lifetimeSpend, ad.lifetimeRoas, ad.bonus);
                  return (
                    <div key={ad.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm text-slate-300 truncate">{ad.name}</p>
                        {prog.next && (
                          <span className="shrink-0 text-[11px] font-medium text-cyan-400">→ ${prog.next.bonus}</span>
                        )}
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${prog.roasMet ? "bg-cyan-400" : "bg-slate-600"}`}
                          style={{ width: `${Math.round(prog.spendProgress * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{prog.hint}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leaderboard (positive-sum: winners + hook rate only, no money) */}
          {data && data.leaderboard.length > 1 && (
            <div className="rounded-2xl border border-white/5 bg-[#111827] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                <Medal className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Topplista — flest vinnare</h2>
                <span className="text-xs text-slate-600">vänlig jämförelse, ingen lön visas</span>
              </div>
              <div className="divide-y divide-white/5">
                {data.leaderboard.slice(0, 8).map((l, i) => {
                  const isMe = l.editorId === editor.editorId;
                  return (
                    <div key={l.editorId} className={`flex items-center gap-3 px-5 py-2.5 ${isMe ? "bg-cyan-500/5" : ""}`}>
                      <span className={`w-6 text-center text-sm font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-600"}`}>
                        {i + 1}
                      </span>
                      <span className={`flex-1 text-sm ${isMe ? "text-cyan-300 font-semibold" : "text-slate-300"}`}>
                        {isMe ? `${l.name} (du)` : l.name}
                      </span>
                      <span className="text-xs text-slate-500">{l.hookRate.toFixed(1)}% hook</span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
                        <Trophy className="h-3.5 w-3.5" /> {l.winners}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All ads */}
          <div className="rounded-2xl border border-white/5 bg-[#111827] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">Alla dina annonser ({editor.adCount})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Annons", "Spend", "ROAS", "Hook", "Köp", "Bonus"].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${i > 0 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editor.ads.map((ad) => (
                    <tr key={ad.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-sm text-slate-300 max-w-[280px] truncate">
                        {ad.name}
                        {ad.strategistName && <span className="ml-2 text-[10px] text-purple-400/70">💡 {ad.strategistName}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-slate-400">${fmt(ad.spend)}</td>
                      <td className="px-4 py-2.5 text-right text-sm">
                        <span className={ad.roas >= 2.5 ? "text-emerald-400" : ad.roas >= 2.0 ? "text-amber-400" : ad.spend > 0 ? "text-red-400" : "text-slate-600"}>
                          {ad.roas.toFixed(2)}x
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right text-sm ${hookColor(ad.hookRate)}`}>{ad.hookRate.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right text-sm text-slate-400">{ad.purchases}</td>
                      <td className="px-4 py-2.5 text-right">
                        {ad.bonus > 0 ? (
                          <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${bonusTierColor(ad.bonus)}`}>${ad.bonus}</span>
                        ) : (
                          <span className="text-slate-600 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {editor.ads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-600">
                        Inga annonser tilldelade dig ännu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 pt-4">
            Bonusnivåer: $10 (500$/2.5x) · $20 (1 000$/2.5x) · $30 (3 750$/2.0x) · $50 (7 500$/2.0x) — låses livstid per annons.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tint, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tint: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#111827] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className={`h-4 w-4 ${tint}`} />
      </div>
      <div className={`text-2xl font-bold ${tint}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}
