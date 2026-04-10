"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import Link from "next/link";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { useMetaInsights } from "@/hooks/use-meta-insights";
import {
  RefreshCw,
  AlertTriangle,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  BookOpen,
  Bot,
  FileText,
  PlusCircle,
  Upload,
  ArrowRight,
} from "lucide-react";

interface BookkeepingSummary {
  revenue: number;
  costs: number;
  result: number;
  assets: number;
  liabilities: number;
  equity: number;
  balanced: boolean;
}

interface RecentVoucher {
  id: string;
  series: string;
  number: number;
  date: string;
  description: string;
}

function formatSEK(n: number) {
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " kr";
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const { summary, campaigns, loading, error, refresh } = useMetaInsights({
    from: format(dateRange.from, "yyyy-MM-dd"),
    to: format(dateRange.to, "yyyy-MM-dd"),
  });

  const [bookkeeping, setBookkeeping] = useState<BookkeepingSummary | null>(null);
  const [recentVouchers, setRecentVouchers] = useState<RecentVoucher[]>([]);
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    const year = new Date().getFullYear();
    const from = `${year}0101`;
    const today = format(new Date(), "yyyyMMdd");

    // Fetch P&L summary
    fetch(`/api/reports/income?from=${from}&to=${today}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.groups) {
          const revenue = data.groups
            .filter((g: { class: string }) => g.class === "3")
            .reduce((sum: number, g: { total: number }) => sum + g.total, 0);
          const costs = data.groups
            .filter((g: { class: string }) => g.class !== "3")
            .reduce((sum: number, g: { total: number }) => sum + g.total, 0);
          setBookkeeping((prev) => ({
            ...(prev || { assets: 0, liabilities: 0, equity: 0, balanced: true }),
            revenue: Math.abs(revenue),
            costs: Math.abs(costs),
            result: data.resultat || 0,
          }));
        }
      })
      .catch(() => {});

    // Fetch balance summary
    fetch(`/api/reports/balance?date=${today}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tillgangar) {
          setBookkeeping((prev) => ({
            ...(prev || { revenue: 0, costs: 0, result: 0 }),
            assets: data.tillgangar.total || 0,
            liabilities: data.egetKapitalOchSkulder?.skulder?.reduce(
              (s: number, a: { balance: number }) => s + a.balance,
              0
            ) || 0,
            equity: data.egetKapitalOchSkulder?.egetKapital?.reduce(
              (s: number, a: { balance: number }) => s + a.balance,
              0
            ) || 0,
            balanced: data.balanced ?? true,
          }));
        }
      })
      .catch(() => {});

    // Fetch recent vouchers
    fetch("/api/vouchers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRecentVouchers(data.slice(0, 5));
          setHasData(data.length > 0);
        } else {
          setHasData(false);
        }
      })
      .catch(() => setHasData(false));
  }, []);

  const handleToggleStatus = async (id: string, newStatus: string) => {
    await fetch("/api/meta/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    refresh();
  };

  const handleUpdateBudget = async (id: string, budget: number) => {
    await fetch("/api/meta/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, daily_budget: Math.round(budget * 100) }),
    });
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-cyan-400" />
          Dashboard
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Failed to load data</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
            <button onClick={refresh} className="text-xs text-cyan-400 hover:underline mt-2">Try again</button>
          </div>
        </div>
      )}

      {/* Onboarding empty state */}
      {hasData === false && !bookkeeping && (
        <div className="rounded-xl border border-white/5 bg-[#111827] p-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
            <Upload className="h-8 w-8 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Välkommen till BookKeeper</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Kom igång genom att importera din bokföring från en SIE-fil, eller skapa din första verifikation manuellt.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sie-import"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
            >
              <Upload className="h-4 w-4" />
              Importera SIE-fil
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/vouchers/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              Skapa verifikation
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <Bot className="h-4 w-4" />
              Fråga AI-assistenten
            </Link>
          </div>
        </div>
      )}

      {/* Bookkeeping Summary Cards */}
      {bookkeeping && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* P&L Card */}
          <Link href="/reports/income" className="rounded-xl border border-white/5 bg-[#111827] p-5 hover:border-cyan-500/20 transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resultat YTD</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Intäkter</span>
                <span className="text-emerald-400">{formatSEK(bookkeeping.revenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Kostnader</span>
                <span className="text-red-400">-{formatSEK(bookkeeping.costs)}</span>
              </div>
              <div className="border-t border-white/5 pt-1.5 flex justify-between">
                <span className="text-sm font-medium text-slate-300">Nettoresultat</span>
                <span className={`text-sm font-bold ${bookkeeping.result >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatSEK(bookkeeping.result)}
                </span>
              </div>
            </div>
          </Link>

          {/* Balance Card */}
          <Link href="/reports/balance" className="rounded-xl border border-white/5 bg-[#111827] p-5 hover:border-cyan-500/20 transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Balans</span>
              {bookkeeping.balanced ? (
                <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  I balans
                </span>
              ) : (
                <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  Ej i balans
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Tillgångar</span>
                <span className="text-slate-200">{formatSEK(bookkeeping.assets)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Eget kapital</span>
                <span className="text-slate-200">{formatSEK(bookkeeping.equity)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Skulder</span>
                <span className="text-slate-200">{formatSEK(bookkeeping.liabilities)}</span>
              </div>
            </div>
          </Link>

          {/* Quick Actions Card */}
          <div className="rounded-xl border border-white/5 bg-[#111827] p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Snabbåtgärder</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/vouchers/new"
                className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <PlusCircle className="h-4 w-4 text-cyan-400" />
                Ny verifikation
              </Link>
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <Bot className="h-4 w-4 text-cyan-400" />
                Fråga AI
              </Link>
              <Link
                href="/reports/income"
                className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <FileText className="h-4 w-4 text-cyan-400" />
                Resultaträkning
              </Link>
              <Link
                href="/sie-import"
                className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <TrendingDown className="h-4 w-4 text-cyan-400" />
                SIE-import
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Vouchers */}
      {recentVouchers.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Senaste verifikationer</h3>
            </div>
            <Link href="/vouchers" className="text-xs text-cyan-400 hover:underline">
              Visa alla
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentVouchers.map((v) => (
              <Link
                key={v.id}
                href="/vouchers"
                className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500">
                    {v.series}{v.number}
                  </span>
                  <span className="text-sm text-slate-300">{v.description}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {v.date?.includes("-") ? v.date : `${v.date?.slice(0, 4)}-${v.date?.slice(4, 6)}-${v.date?.slice(6, 8)}`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Existing Meta Ads Section */}
      <KPICards summary={summary} loading={loading} />
      <PerformanceTable
        campaigns={campaigns}
        loading={loading}
        onToggleStatus={handleToggleStatus}
        onUpdateBudget={handleUpdateBudget}
      />
    </div>
  );
}
