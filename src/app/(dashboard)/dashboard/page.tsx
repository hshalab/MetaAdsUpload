"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { useMetaInsights } from "@/hooks/use-meta-insights";
import { RefreshCw, AlertTriangle, LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const { summary, campaigns, loading, error, refresh } = useMetaInsights({
    from: format(dateRange.from, "yyyy-MM-dd"),
    to: format(dateRange.to, "yyyy-MM-dd"),
  });

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
      {/* Header row — stacks on mobile */}
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
