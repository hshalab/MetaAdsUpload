"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X, Film, Download, Trash2, Tag, ExternalLink, Copy, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatFileSize, formatResolution } from "@/lib/format-utils";
import { VideoPlayer } from "@/components/review/video-player";
import type { Creative } from "./use-library-store";
import { toast } from "sonner";
import { CLASSIFICATION_BADGES, fmtSpend } from "./library-card";
import { StarRating } from "./star-rating";

interface AdBreakdownRow {
  adId: string;
  adName: string;
  adStatus: string;
  spend: number;
  roas: number;
  purchases: number;
  hookRate: number;
  holdRate: number;
  ctr: number;
  classification: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

interface LibraryDetailPanelProps {
  creative: Creative;
  metricDays: number;
  onClose: () => void;
  onRefresh: () => void;
}

export function LibraryDetailPanel({ creative: c, metricDays, onClose, onRefresh }: LibraryDetailPanelProps) {
  const [editTags, setEditTags] = useState<string[]>([...c.tags]);
  const [newTag, setNewTag] = useState("");
  // keyed by creative+window so switching assets shows "loading" without a
  // synchronous state reset inside the effect
  const [adsState, setAdsState] = useState<{ key: string; rows: AdBreakdownRow[] } | null>(null);
  const adsKey = `${c.id}:${metricDays}`;
  const ads = adsState && adsState.key === adsKey ? adsState.rows : null;

  useEffect(() => {
    let cancelled = false;
    const key = `${c.id}:${metricDays}`;
    fetch(`/api/library/${c.id}/ads?days=${metricDays}`)
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((data) => {
        if (!cancelled) setAdsState({ key, rows: data.ads || [] });
      })
      .catch(() => {
        if (!cancelled) setAdsState({ key, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [c.id, metricDays]);

  const patchAsset = useCallback(
    async (updates: Record<string, unknown>) => {
      await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, ...updates }),
      });
      onRefresh();
    },
    [c.id, onRefresh]
  );

  const saveTags = useCallback(async () => {
    await patchAsset({ tags: editTags });
    toast.success("Tags updated");
  }, [editTags, patchAsset]);

  const updateStatus = useCallback(
    async (status: string) => {
      await patchAsset({ status });
      toast.success("Status updated");
    },
    [patchAsset]
  );

  const handleDownload = useCallback(() => {
    if (!c.r2Url) return;
    const a = document.createElement("a");
    a.href = c.r2Url;
    a.download = c.name;
    a.click();
  }, [c.r2Url, c.name]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-[440px] bg-[#0d1117] border-l border-white/[0.08] overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white truncate flex-1 mr-3">{c.name}</h3>
          <div className="flex items-center gap-1.5">
            {c.r2Url && (
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            {c.r2Url && (
              <button
                onClick={() => window.open(c.r2Url!, "_blank")}
                className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/5 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="aspect-video bg-black/30 flex items-center justify-center">
          {c.r2Url && c.type === "video" ? (
            <VideoPlayer
              src={c.r2Url}
              contentType="video/mp4"
              posterUrl={c.thumbnailUrl || undefined}
              className="w-full h-full"
            />
          ) : c.r2Url && c.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.r2Url} alt={c.name} className="h-full w-full object-contain" />
          ) : c.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-contain" />
          ) : (
            <Film className="h-16 w-16 text-slate-700" />
          )}
        </div>

        {/* Metadata */}
        <div className="px-5 py-4 space-y-5">
          {/* Status */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Status</label>
            <div className="flex gap-1.5 mt-1.5">
              {(["uploaded", "in_review", "approved"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all",
                    c.status === s
                      ? STATUS_COLORS[s]
                      : "border-white/[0.06] text-slate-600 hover:text-slate-400"
                  )}
                >
                  {s === "in_review" ? "Review" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Performance (creative ↔ Meta ads) */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> Performance · {metricDays === 0 ? "lifetime" : `last ${metricDays}d`}
            </label>
            {c.metrics && c.metrics.adCount > 0 ? (
              <>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-500/[0.06] border border-amber-500/15 px-2.5 py-2">
                  <StarRating value={c.metrics.stars} size={16} showValue />
                  <span className="text-[10px] text-slate-500">
                    {c.metrics.stars == null
                      ? "Testing — needs more spend to rate"
                      : c.metrics.stars >= 4.5
                        ? "Proven winner"
                        : c.metrics.stars >= 3.5
                          ? "Strong performer"
                          : c.metrics.stars >= 2.5
                            ? "Around breakeven"
                            : "Underperforming"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Spend", value: fmtSpend(c.metrics.spend) },
                    { label: "ROAS", value: c.metrics.spend > 0 ? c.metrics.roas.toFixed(2) : "—" },
                    { label: "Purchases", value: String(c.metrics.purchases) },
                    { label: "Hook", value: c.metrics.hookRate > 0 ? `${c.metrics.hookRate.toFixed(1)}%` : "—" },
                    { label: "Hold", value: c.metrics.holdRate > 0 ? `${c.metrics.holdRate.toFixed(1)}%` : "—" },
                    { label: "CTR", value: c.metrics.ctr > 0 ? `${c.metrics.ctr.toFixed(2)}%` : "—" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-slate-600">{m.label}</p>
                      <p className="text-xs font-semibold text-white">{m.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-1.5">
                  {ads === null ? (
                    <p className="text-[10px] text-slate-600">Loading ads…</p>
                  ) : ads.length === 0 ? (
                    <p className="text-[10px] text-slate-600">No linked ads found.</p>
                  ) : (
                    ads.map((ad) => (
                      <div key={ad.adId} className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              ad.adStatus === "ACTIVE" ? "bg-emerald-400" : "bg-slate-600"
                            )}
                          />
                          <p className="text-[10px] text-white truncate flex-1" title={ad.adName}>{ad.adName}</p>
                          {ad.classification && CLASSIFICATION_BADGES[ad.classification] && (
                            <span className={cn("text-[8px] font-semibold px-1 py-0.5 rounded-full border shrink-0", CLASSIFICATION_BADGES[ad.classification].className)}>
                              {CLASSIFICATION_BADGES[ad.classification].label}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex gap-3 text-[9px] font-mono text-slate-500">
                          <span>Spend {fmtSpend(ad.spend)}</span>
                          <span>ROAS {ad.spend > 0 ? ad.roas.toFixed(2) : "—"}</span>
                          <span>Hook {ad.hookRate > 0 ? `${ad.hookRate.toFixed(1)}%` : "—"}</span>
                          <span>Hold {ad.holdRate > 0 ? `${ad.holdRate.toFixed(1)}%` : "—"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-[10px] text-slate-600">
                Not linked to any Meta ad yet — it links automatically when the asset is published (or on the next ads sync).
              </p>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-600">Type</span>
              <p className="text-white mt-0.5">{c.type}</p>
            </div>
            <div>
              <span className="text-slate-600">Size</span>
              <p className="text-white mt-0.5">{formatFileSize(c.fileSize)}</p>
            </div>
            {c.type === "video" && (
              <div>
                <span className="text-slate-600">Duration</span>
                <p className="text-white mt-0.5">{formatDuration(c.duration)}</p>
              </div>
            )}
            <div>
              <span className="text-slate-600">Resolution</span>
              <p className="text-white mt-0.5">{formatResolution(c.width, c.height)}</p>
            </div>
            <div>
              <span className="text-slate-600">Editor</span>
              <p className="text-white mt-0.5">{c.editorName || "—"}</p>
            </div>
            <div>
              <span className="text-slate-600">Batch</span>
              <p className="text-white mt-0.5">{c.batchNumber || "—"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-slate-600">Uploaded</span>
              <p className="text-white mt-0.5">{new Date(c.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* R2 URL */}
          {c.r2Url && (
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Asset URL</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={c.r2Url}
                  className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-slate-400 truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(c.r2Url!);
                    toast.success("URL copied");
                  }}
                  className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Tags
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {editTags.map((tag, i) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10"
                >
                  {tag}
                  <button
                    onClick={() => setEditTags(editTags.filter((_, j) => j !== i))}
                    className="text-slate-600 hover:text-red-400"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTag.trim()) {
                    setEditTags([...editTags, newTag.trim()]);
                    setNewTag("");
                  }
                }}
              />
              <button
                onClick={saveTags}
                className="px-3 py-1 rounded bg-cyan-600 text-xs text-white hover:bg-cyan-500 transition-all"
              >
                Save
              </button>
            </div>
          </div>

          {/* Delete actions */}
          <div className="space-y-2">
            {c.status !== "archived" ? (
              <button
                onClick={async () => {
                  await updateStatus("archived");
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" /> Archive
              </button>
            ) : null}
            <button
              onClick={async () => {
                if (!confirm("Delete permanently? The file is removed from R2 and cannot be restored.")) return;
                try {
                  const res = await fetch("/api/library", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: c.id, hard: true }),
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    toast.error(data.error || "Could not delete");
                    return;
                  }
                  toast.success("Deleted permanently");
                  onClose();
                  onRefresh();
                } catch {
                  toast.error("Could not delete");
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
