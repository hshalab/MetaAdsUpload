"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
  Users,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DailyStat {
  id: number;
  date: string;
  totalOrders: number;
  totalRevenue: number;
  newCustomerOrders: number;
  newCustomerRevenue: number;
  returningCustomerOrders: number;
  returningCustomerRevenue: number;
}

interface ShopifyData {
  stats: DailyStat[];
  kpi: {
    ncRoas7d: number | null;
    blendedRoas7d: number | null;
    newCustomerPct7d: number;
    newCustomerOrders7d: number;
    totalSpend7d: number;
  };
}

interface SyncResult {
  synced: boolean;
  days: number;
  orders: number;
  ordersWithUtm: number;
  summary: {
    newOrders: number;
    totalOrders: number;
    newRevenue: number;
    totalRevenue: number;
  };
}

export default function ShopifyPage() {
  const [data, setData] = useState<ShopifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify/stats");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);

      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }

      const result = await res.json();
      setSyncResult(result);
      // Refresh data after sync
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error(`Shopify sync misslyckades: ${msg}`);
      console.error("Shopify sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#111827] py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Kunde inte ladda Shopify-data</h3>
        <p className="text-slate-500 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all">
          Försök igen
        </button>
      </div>
    );
  }

  const kpi = data?.kpi;
  const stats = data?.stats || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-emerald-400" />
            Shopify — New Customer Tracking
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            ncROAS visar om dina ads driver nykunder eller bara konverterar befintliga
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Synkar..." : "Synka senaste 30 dagarna"}
          </button>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          Synkat {syncResult.days} dagar, {syncResult.orders} orders ({syncResult.summary.newOrders} nya kunder),{" "}
          {syncResult.summary.totalRevenue.toLocaleString("sv-SE")} SEK total ({syncResult.summary.newRevenue.toLocaleString("sv-SE")} SEK nykunder).
          {syncResult.ordersWithUtm > 0 && ` ${syncResult.ordersWithUtm} orders med UTM-data.`}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/5 bg-[#111827] p-4">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">ncROAS (7d)</span>
          <div className={cn(
            "text-2xl font-bold mt-1",
            kpi?.ncRoas7d != null && kpi.ncRoas7d >= 2 ? "text-emerald-400" : kpi?.ncRoas7d != null ? "text-red-400" : "text-slate-500"
          )}>
            {kpi?.ncRoas7d != null ? `${kpi.ncRoas7d.toFixed(2)}x` : "—"}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">New Customer ROAS</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#111827] p-4">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Blended ROAS (7d)</span>
          <div className={cn(
            "text-2xl font-bold mt-1",
            kpi?.blendedRoas7d != null && kpi.blendedRoas7d >= 2 ? "text-emerald-400" : kpi?.blendedRoas7d != null ? "text-amber-400" : "text-slate-500"
          )}>
            {kpi?.blendedRoas7d != null ? `${kpi.blendedRoas7d.toFixed(2)}x` : "—"}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">Alla kunder</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#111827] p-4">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Ny-kund-andel (7d)</span>
          <div className={cn(
            "text-2xl font-bold mt-1",
            kpi?.newCustomerPct7d != null && kpi.newCustomerPct7d >= 30 ? "text-emerald-400" : "text-amber-400"
          )}>
            {kpi?.newCustomerPct7d != null ? `${kpi.newCustomerPct7d.toFixed(0)}%` : "—"}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">Ny-kund revenue / total revenue</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#111827] p-4">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Nya kunder (7d)</span>
          <div className="text-2xl font-bold mt-1 text-white">
            {kpi?.newCustomerOrders7d ?? "—"}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">Antal orders från nykunder</div>
        </div>
      </div>

      {/* Daily Table */}
      <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            Daglig Statistik
          </h3>
        </div>
        {stats.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Ingen data ännu. Tryck &quot;Synka senaste 30 dagarna&quot; för att hämta orders från Shopify.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Datum</th>
                  <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Orders</th>
                  <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Nykund</th>
                  <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Revenue</th>
                  <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Nykund Rev</th>
                  <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Ny %</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => {
                  const newPct = row.totalRevenue > 0 ? (row.newCustomerRevenue / row.totalRevenue) * 100 : 0;
                  return (
                    <tr key={row.date} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-slate-300">{row.date}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{row.totalOrders}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">{row.newCustomerOrders}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{row.totalRevenue.toLocaleString("sv-SE", { maximumFractionDigits: 0 })} SEK</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">{row.newCustomerRevenue.toLocaleString("sv-SE", { maximumFractionDigits: 0 })} SEK</td>
                      <td className={cn(
                        "px-4 py-2.5 text-right font-medium",
                        newPct >= 30 ? "text-emerald-400" : "text-amber-400"
                      )}>
                        {newPct.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
