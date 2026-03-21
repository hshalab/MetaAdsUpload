"use client";

import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const TRUEPROFIT_URL = "https://trueprofit-production.up.railway.app";
const TRUEPROFIT_DASHBOARD = `${TRUEPROFIT_URL}/dashboard`;

export default function TrueProfitPage() {
  const [fullscreen, setFullscreen] = useState(false);
  const [showIframe, setShowIframe] = useState(true);

  return (
    <div className={cn("space-y-4", fullscreen && "fixed inset-0 z-50 bg-[#0a0e1a] p-4")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
              TP
            </div>
            TrueProfit
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time profit tracking dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={TRUEPROFIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 hover:bg-emerald-500/20 transition-all"
            title="Log in via new tab first, then the embed will work"
          >
            <LogIn className="h-4 w-4" />
            Log In First
          </a>
          <button
            onClick={() => setShowIframe(!showIframe)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
          >
            {showIframe ? "Hide" : "Show"} Dashboard
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <a
            href={TRUEPROFIT_DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-2.5 flex items-center gap-3">
        <LogIn className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          <span className="text-emerald-400 font-medium">Första gången?</span> Klicka "Log In First" för att logga in i en ny flik. Efter det visas dashboarden här automatiskt.
        </p>
      </div>

      {/* Iframe */}
      {showIframe && (
        <div className={cn(
          "rounded-xl border border-white/5 bg-[#111827] overflow-hidden",
          fullscreen ? "flex-1 h-[calc(100vh-160px)]" : "h-[calc(100vh-260px)]"
        )}>
          <iframe
            src={TRUEPROFIT_DASHBOARD}
            className="w-full h-full border-0"
            title="TrueProfit Dashboard"
            allow="fullscreen"
          />
        </div>
      )}
    </div>
  );
}
