"use client";

import { useState, useCallback } from "react";
import { Upload, Search, Link2, CheckCircle, AlertCircle, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BankTx {
  id: string;
  bankDate: string;
  description: string;
  amount: number;
  balance: number | null;
  bankFormat: string | null;
  matchedVoucherId: string | null;
  imported: boolean;
}

interface Voucher {
  id: string;
  series: string;
  number: number;
  date: string;
  description: string | null;
}

export default function BankPage() {
  const [transactions, setTransactions] = useState<BankTx[]>([]);
  const [uploading, setUploading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<{ high: number; medium: number; none: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [voucherSearch, setVoucherSearch] = useState<Voucher[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/bank/import");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setTransactions(data);
      }
    } catch { /* ignore */ }
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/bank/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Importerade ${data.imported} transaktioner (${data.format})`);
        // Reload transactions from import result
        await fetchTransactions();
      }

      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} fel vid import`);
      }
    } catch {
      toast.error("Import misslyckades");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleUpload(f);
  };

  const handleAutoMatch = async () => {
    setMatching(true);
    setMatchResults(null);
    try {
      const res = await fetch("/api/bank/import?action=auto-match", { method: "POST" });
      const data = await res.json();

      if (data.results) {
        const results = data.results as Array<{ confidence: string }>;
        const high = results.filter((r) => r.confidence === "high").length;
        const medium = results.filter((r) => r.confidence === "medium").length;
        const none = results.filter((r) => r.confidence === "none").length;
        setMatchResults({ high, medium, none });
        toast.success(`Matchade ${high + medium} transaktioner`);
        await fetchTransactions();
      }
    } catch {
      toast.error("Auto-matchning misslyckades");
    } finally {
      setMatching(false);
    }
  };

  const handleManualMatch = async (txId: string, voucherId: string) => {
    try {
      const res = await fetch("/api/bank/import?action=manual-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId, voucherId }),
      });
      if (res.ok) {
        toast.success("Transaktion matchad");
        setSelectedTx(null);
        await fetchTransactions();
      }
    } catch {
      toast.error("Matchning misslyckades");
    }
  };

  const searchVouchers = async (query: string) => {
    if (query.length < 2) {
      setVoucherSearch([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/bank/import?action=search-vouchers&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setVoucherSearch(Array.isArray(data) ? data : []);
    } catch {
      setVoucherSearch([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return amount >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="h-6 w-6 text-cyan-400" />
            Bankimport
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Importera banktransaktioner och matcha mot verifikationer</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoMatch}
            disabled={matching || transactions.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Auto-matcha
          </button>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
          dragOver
            ? "border-cyan-500/50 bg-cyan-500/5"
            : "border-white/10 hover:border-white/20 bg-[#111827]"
        )}
        onClick={() => document.getElementById("bank-csv-input")?.click()}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto" />
        ) : (
          <>
            <Upload className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-300">Dra och släpp bank-CSV här, eller klicka för att välja</p>
            <p className="text-xs text-slate-500 mt-1">Stöder SEB, Nordea, Swedbank</p>
          </>
        )}
        <input
          id="bank-csv-input"
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </div>

      {/* Match results summary */}
      {matchResults && (
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-lg font-bold text-emerald-400">{matchResults.high}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hög säkerhet</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <p className="text-lg font-bold text-amber-400">{matchResults.medium}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Medium</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/5 border border-red-500/10">
            <p className="text-lg font-bold text-red-400">{matchResults.none}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ej matchade</p>
          </div>
        </div>
      )}

      {/* Transactions table */}
      {transactions.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{transactions.length} transaktioner</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Datum</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Beskrivning</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Belopp</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Saldo</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={cn(
                      "hover:bg-white/[0.02] transition-colors",
                      selectedTx === tx.id && "bg-cyan-500/5"
                    )}
                  >
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{tx.bankDate}</td>
                    <td className="px-4 py-3 text-slate-200 max-w-xs truncate">{tx.description}</td>
                    <td className={cn(
                      "px-4 py-3 text-right font-mono text-xs",
                      tx.amount >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {formatAmount(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">
                      {tx.balance != null ? tx.balance.toLocaleString("sv-SE", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.matchedVoucherId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="h-3 w-3" /> Matchad
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertCircle className="h-3 w-3" /> Omatchad
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!tx.matchedVoucherId && (
                        <button
                          onClick={() => setSelectedTx(selectedTx === tx.id ? null : tx.id)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual match panel */}
      {selectedTx && (
        <div className="rounded-xl border border-cyan-500/20 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Manuell matchning</h3>
            <p className="text-xs text-slate-500 mt-0.5">Sök efter verifikation att koppla till transaktionen</p>
          </div>
          <div className="p-5 space-y-3">
            <input
              type="text"
              placeholder="Sök verifikation (serie, nummer, beskrivning)..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/30"
              onChange={(e) => searchVouchers(e.target.value)}
            />
            {searchLoading && <Loader2 className="h-5 w-5 animate-spin text-slate-500 mx-auto" />}
            {voucherSearch.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-auto">
                {voucherSearch.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleManualMatch(selectedTx, v.id)}
                    className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-mono text-cyan-400">{v.series} {v.number}</span>
                      <span className="text-xs text-slate-400 ml-2">{v.date}</span>
                      <span className="text-xs text-slate-300 ml-2">{v.description}</span>
                    </div>
                    <Link2 className="h-3 w-3 text-slate-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {transactions.length === 0 && !uploading && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Inga banktransaktioner importerade</p>
          <p className="text-slate-500 text-xs mt-1">Ladda upp en CSV-fil från din bank för att komma igång</p>
        </div>
      )}
    </div>
  );
}
