"use client";

import { useState, useCallback } from "react";
import {
  X, Film, Download, Trash2, Tag, ExternalLink, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatFileSize, formatResolution } from "@/lib/format-utils";
import { VideoPlayer } from "@/components/review/video-player";
import type { Creative } from "./use-library-store";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

interface LibraryDetailPanelProps {
  creative: Creative;
  onClose: () => void;
  onRefresh: () => void;
}

export function LibraryDetailPanel({ creative: c, onClose, onRefresh }: LibraryDetailPanelProps) {
  const [editTags, setEditTags] = useState<string[]>([...c.tags]);
  const [newTag, setNewTag] = useState("");

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
                <Trash2 className="h-3.5 w-3.5" /> Arkivera
              </button>
            ) : null}
            <button
              onClick={async () => {
                if (!confirm("Ta bort permanent? Filen raderas från R2 och kan inte återställas.")) return;
                try {
                  const res = await fetch("/api/library", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: c.id, hard: true }),
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    toast.error(data.error || "Kunde inte ta bort");
                    return;
                  }
                  toast.success("Borttagen permanent");
                  onClose();
                  onRefresh();
                } catch {
                  toast.error("Kunde inte ta bort");
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" /> Ta bort permanent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
