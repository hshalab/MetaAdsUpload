"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  History,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
  Copy,
  Bug,
  ShieldAlert,
  Timer,
  FileVideo,
  ImageIcon,
  Filter,
} from "lucide-react";

interface ErrorDetails {
  message: string;
  failedStep: number;
  failedStepName: string;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
  httpStatus?: number;
  isAuthError?: boolean;
  isRateLimitError?: boolean;
  suggestion?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

interface DbJob {
  id: number;
  filename: string;
  mediaType: string;
  status: string;
  totalSteps: number;
  currentStep: number;
  stepLabel: string;
  r2Key?: string;
  r2Url?: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  creativeId?: string;
  videoId?: string;
  imageHash?: string;
  config?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

const STEP_LABELS = [
  "Upload media",
  "Create creative",
  "Set up ad set",
  "Create ad",
];

export default function UploadLogPage() {
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/upload-jobs");
      if (res.ok) {
        const { data } = await res.json();
        setJobs(data || []);
      }
    } catch {
      toast.error("Kunde inte ladda uppladdningsloggen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyError = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopierat!");
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just nu";
    if (mins < 60) return `${mins}m sedan`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h sedan`;
    const days = Math.floor(hours / 24);
    return `${days}d sedan`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("sv-SE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filtered = jobs.filter((j) => {
    if (filter === "completed") return j.status === "completed";
    if (filter === "failed") return j.status === "failed";
    return true;
  });

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <History className="h-6 w-6 text-cyan-400" />
            Upload Log
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Alla uppladdningar till Meta med status och feldetaljer
          </p>
        </div>
        <button
          onClick={fetchJobs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-all"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Uppdatera
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Totalt</p>
          <p className="text-2xl font-bold text-white mt-1">{jobs.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/10 bg-[#111827] p-4">
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider">Lyckade</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-red-500/10 bg-[#111827] p-4">
          <p className="text-[10px] text-red-400 uppercase tracking-wider">Misslyckade</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-slate-500" />
        {(["all", "completed", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
              filter === f
                ? f === "failed"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : f === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                : "text-slate-500 hover:text-slate-300 bg-white/[0.02] border-white/[0.06] hover:bg-white/5"
            )}
          >
            {f === "all" ? "Alla" : f === "completed" ? "Lyckade" : "Misslyckade"}
            {f === "failed" && failedCount > 0 && (
              <span className="ml-1.5 px-1 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px]">{failedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111827] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <History className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              {filter === "all" ? "No uploads yet" : `Inga ${filter === "failed" ? "misslyckade" : "lyckade"} uppladdningar`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filtered.map((job) => {
              const isExpanded = expandedIds.has(job.id);
              const config = job.config as Record<string, unknown> | null;
              const ed = config?.errorDetails as ErrorDetails | undefined;

              return (
                <div key={job.id} className="px-5 py-4">
                  {/* Main row */}
                  <div className="flex items-center gap-3">
                    {/* Status icon */}
                    {job.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : job.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-cyan-400 shrink-0" />
                    )}

                    {/* Media type icon */}
                    {job.mediaType === "video" ? (
                      <FileVideo className="h-4 w-4 text-cyan-400/60 shrink-0" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-purple-400/60 shrink-0" />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white truncate font-medium">{job.filename}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {job.status === "completed" && (
                          <>
                            <span className="text-[11px] text-emerald-400">Ad: {job.adId}</span>
                            {job.creativeId && <span className="text-[11px] text-slate-500">Creative: {job.creativeId}</span>}
                            {job.adsetId && <span className="text-[11px] text-slate-500">AdSet: {job.adsetId}</span>}
                          </>
                        )}
                        {job.status === "failed" && (
                          <span className="text-[11px] text-red-400 truncate max-w-[400px]">{job.error}</span>
                        )}
                        {job.status !== "completed" && job.status !== "failed" && (
                          <span className="text-[11px] text-slate-500">
                            Step {job.currentStep}/{job.totalSteps}: {job.stepLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Step progress dots */}
                      {job.status !== "failed" && (
                        <div className="flex gap-0.5">
                          {STEP_LABELS.map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1.5 w-4 rounded-full",
                                i + 1 <= job.currentStep
                                  ? job.status === "completed" ? "bg-emerald-400" : "bg-cyan-400"
                                  : "bg-white/[0.06]"
                              )}
                            />
                          ))}
                        </div>
                      )}

                      {/* Error detail button */}
                      {job.status === "failed" && (
                        <button
                          onClick={() => toggleExpand(job.id)}
                          className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-2 py-1.5 rounded-md bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all"
                        >
                          <Bug className="h-3 w-3" />
                          Detaljer
                          <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      )}

                      {/* View in Meta */}
                      {job.status === "completed" && job.adId && (
                        <a
                          href={`https://business.facebook.com/adsmanager/manage/ads?act=261297039993717&selected_ad_ids=${job.adId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 px-2 py-1.5 rounded-md bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 transition-all"
                        >
                          Meta <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}

                      {/* Timestamp */}
                      <div className="text-right min-w-[70px]">
                        <div className="text-[10px] text-slate-500">{formatDate(job.createdAt)}</div>
                        <div className="flex items-center gap-1 text-[9px] text-slate-600 justify-end">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(job.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded error details */}
                  {job.status === "failed" && isExpanded && (
                    <div className="mt-3 ml-10 rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                      {/* Suggestion */}
                      {ed?.suggestion && (
                        <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-400 mb-0.5">Hur du löser detta</p>
                            <p className="text-xs text-amber-300/80 leading-relaxed">{ed.suggestion}</p>
                          </div>
                        </div>
                      )}

                      {/* Error info grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ed?.failedStepName && (
                          <div className="p-2.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-[9px] text-slate-500 mb-0.5">Steg som misslyckades</p>
                            <p className="text-xs text-red-400 font-medium">
                              {ed.failedStep}/4: {ed.failedStepName}
                            </p>
                          </div>
                        )}
                        {ed?.metaErrorCode && (
                          <div className="p-2.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-[9px] text-slate-500 mb-0.5">Meta felkod</p>
                            <p className="text-xs text-white font-mono">
                              {ed.metaErrorCode}
                              {ed.metaErrorSubcode ? ` / ${ed.metaErrorSubcode}` : ""}
                            </p>
                          </div>
                        )}
                        {ed?.httpStatus && (
                          <div className="p-2.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-[9px] text-slate-500 mb-0.5">HTTP Status</p>
                            <p className="text-xs text-white font-mono">{ed.httpStatus}</p>
                          </div>
                        )}
                        {ed?.isAuthError && (
                          <div className="p-2.5 rounded-md bg-red-500/5 border border-red-500/10 flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-red-400" />
                            <p className="text-xs text-red-400 font-medium">Auth-fel</p>
                          </div>
                        )}
                        {ed?.isRateLimitError && (
                          <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/10 flex items-center gap-2">
                            <Timer className="h-4 w-4 text-amber-400" />
                            <p className="text-xs text-amber-400 font-medium">Rate limit</p>
                          </div>
                        )}
                      </div>

                      {/* Full error message */}
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Fullständigt felmeddelande</p>
                        <div className="p-3 rounded-md bg-black/30 border border-white/[0.04]">
                          <p className="text-xs text-red-300 font-mono break-all leading-relaxed">{job.error}</p>
                        </div>
                      </div>

                      {/* Payload */}
                      {ed?.payload && (
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Data som skickades till Meta</p>
                          <div className="p-3 rounded-md bg-black/30 border border-white/[0.04] max-h-[200px] overflow-y-auto">
                            <pre className="text-[11px] text-slate-400 font-mono break-all whitespace-pre-wrap">
                              {JSON.stringify(ed.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Copy button */}
                      <button
                        onClick={() =>
                          copyError(
                            [
                              `Fil: ${job.filename}`,
                              `Fel: ${job.error}`,
                              ed?.failedStepName ? `Steg: ${ed.failedStep}/4 — ${ed.failedStepName}` : "",
                              ed?.metaErrorCode ? `Meta felkod: ${ed.metaErrorCode}${ed.metaErrorSubcode ? ` / ${ed.metaErrorSubcode}` : ""}` : "",
                              ed?.httpStatus ? `HTTP: ${ed.httpStatus}` : "",
                              ed?.suggestion ? `Suggestion: ${ed.suggestion}` : "",
                              ed?.payload ? `Payload:\n${JSON.stringify(ed.payload, null, 2)}` : "",
                              `Tid: ${job.createdAt}`,
                            ]
                              .filter(Boolean)
                              .join("\n")
                          )
                        }
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        Kopiera all felinformation
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
