"use client";

import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format-utils";
import type { UploadItem, LibraryAction } from "./use-library-store";
import type { Dispatch } from "react";

interface LibraryUploadOverlayProps {
  dragOver: boolean;
}

export function LibraryDragOverlay({ dragOver }: LibraryUploadOverlayProps) {
  if (!dragOver) return null;
  return (
    <div className="fixed inset-0 z-50 bg-cyan-500/10 border-2 border-dashed border-cyan-400 rounded-xl flex items-center justify-center pointer-events-none animate-in fade-in duration-150">
      <div className="text-center">
        <Upload className="h-12 w-12 text-cyan-400 mx-auto mb-3 animate-bounce" />
        <p className="text-lg font-semibold text-cyan-400">Drop files to upload</p>
        <p className="text-sm text-cyan-400/60 mt-1">Videos & images supported</p>
      </div>
    </div>
  );
}

interface UploadProgressPanelProps {
  uploads: UploadItem[];
  dispatch: Dispatch<LibraryAction>;
}

export function UploadProgressPanel({ uploads, dispatch }: UploadProgressPanelProps) {
  const active = uploads.filter((u) => u.status !== "done" || Date.now() - 0 < 3000);
  if (active.length === 0) return null;

  const allDone = uploads.every((u) => u.status === "done");

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 rounded-xl bg-[#0d1117] border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-xs font-medium text-white">
          {allDone ? "Upload complete" : `Uploading ${uploads.filter((u) => u.status === "uploading").length} file(s)...`}
        </span>
        <button
          onClick={() => dispatch({ type: "CLEAR_DONE_UPLOADS" })}
          className="text-slate-600 hover:text-white transition-all"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* File list */}
      <div className="max-h-48 overflow-y-auto">
        {uploads.map((u) => (
          <div key={u.id} className="px-3 py-2 flex items-center gap-2 border-b border-white/[0.03] last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white truncate">{u.file.name}</p>
              <p className="text-[9px] text-slate-600">{formatFileSize(u.file.size)}</p>
            </div>
            <div className="shrink-0">
              {u.status === "uploading" ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-cyan-400 w-8 text-right">{u.progress}%</span>
                </div>
              ) : u.status === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : u.status === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-slate-600 animate-spin" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
