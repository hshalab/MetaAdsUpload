"use client";

import { ExternalLink } from "lucide-react";

const TRUEPROFIT_URL = "https://trueprofit-production.up.railway.app/dashboard";

export default function TrueProfitPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-emerald-500/20">
        TP
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">TrueProfit</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time profit tracking dashboard</p>
      </div>
      <a
        href={TRUEPROFIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-medium text-white hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
      >
        <ExternalLink className="h-4 w-4" />
        Open TrueProfit Dashboard
      </a>
      <p className="text-xs text-slate-600 max-w-sm text-center">
        Opens in a new tab. Iframe embedding is blocked by browser security policies (cross-origin cookies).
      </p>
    </div>
  );
}
