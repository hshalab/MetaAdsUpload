"use client";

import { useState, useCallback } from "react";
import { Video, Image as ImageIcon, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatFileSize, formatResolutionShort } from "@/lib/format-utils";
import { HoverScrubThumbnail } from "./hover-scrub-thumbnail";
import { StarRating } from "./star-rating";
import type { Creative } from "./use-library-store";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export const CLASSIFICATION_BADGES: Record<string, { label: string; className: string }> = {
  breakthrough: { label: "🏆 Breakthrough", className: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  spend_winner: { label: "🏆 Winner", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  kpi_winner: { label: "📈 KPI Winner", className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  new: { label: "🧪 Testing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  loser: { label: "💀 Loser", className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
export function fmtSpend(v: number): string {
  return v >= 10000 ? `${nf.format(Math.round(v / 1000))}k` : nf.format(Math.round(v));
}

interface LibraryCardProps {
  creative: Creative;
  selected: boolean;
  focused: boolean;
  renamingId: number | null;
  onSelect: (id: number) => void;
  onClick: (c: Creative) => void;
  onDoubleClickName: (id: number) => void;
  onRename: (id: number, newName: string) => void;
}

export function LibraryCard({
  creative: c,
  selected,
  focused,
  renamingId,
  onSelect,
  onClick,
  onDoubleClickName,
  onRename,
}: LibraryCardProps) {
  const [renameValue, setRenameValue] = useState(c.name);
  const isRenaming = renamingId === c.id;

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== c.name) {
      onRename(c.id, trimmed);
    }
  }, [renameValue, c.name, c.id, onRename]);

  const resBadge = formatResolutionShort(c.width, c.height);

  return (
    <div
      className={cn(
        "group relative rounded-xl border overflow-hidden transition-all cursor-pointer",
        selected
          ? "border-cyan-500/40 bg-cyan-500/5 ring-1 ring-cyan-500/20"
          : focused
            ? "border-cyan-500/30 bg-[#111827]"
            : "border-white/5 bg-[#111827] hover:border-white/10"
      )}
      onClick={() => onClick(c)}
      tabIndex={0}
      data-creative-id={c.id}
    >
      {/* Select checkbox */}
      <button
        className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(c.id);
        }}
      >
        {selected ? (
          <CheckSquare className="h-5 w-5 text-cyan-400" />
        ) : (
          <Square className="h-5 w-5 text-white/50 hover:text-white/80" />
        )}
      </button>

      {/* Thumbnail / Hover Scrub */}
      <div className="relative aspect-video bg-white/[0.02] flex items-center justify-center overflow-hidden">
        {c.r2Url && c.type === "video" ? (
          <HoverScrubThumbnail
            videoUrl={c.r2Url}
            thumbnailUrl={c.thumbnailUrl}
            duration={c.duration}
            alt={c.name}
            className="h-full w-full"
          />
        ) : c.r2Url && c.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.r2Url} alt={c.name} className="h-full w-full object-cover" />
        ) : c.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-cover" />
        ) : c.type === "video" ? (
          <Video className="h-10 w-10 text-slate-600" />
        ) : (
          <ImageIcon className="h-10 w-10 text-slate-600" />
        )}

        {/* Duration overlay (bottom-right) */}
        {c.type === "video" && c.duration && c.duration > 0 && (
          <span className="absolute bottom-1.5 right-1.5 text-[10px] font-mono font-medium bg-black/70 text-white px-1.5 py-0.5 rounded">
            {formatDuration(c.duration)}
          </span>
        )}

        {/* Resolution badge (top-right, behind status) */}
        {resBadge && (
          <span className="absolute top-2 right-2 text-[8px] font-semibold bg-black/60 text-white/80 px-1 py-0.5 rounded">
            {resBadge}
          </span>
        )}

        {/* Status badge */}
        <span
          className={cn(
            "absolute bottom-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
            STATUS_COLORS[c.status] || STATUS_COLORS.uploaded
          )}
        >
          {c.status === "in_review" ? "review" : c.status}
        </span>

        {/* Classification badge (from Evolve ad classifications) */}
        {c.metrics?.classification && CLASSIFICATION_BADGES[c.metrics.classification] && (
          <span
            className={cn(
              "absolute top-2 left-8 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
              CLASSIFICATION_BADGES[c.metrics.classification].className
            )}
          >
            {CLASSIFICATION_BADGES[c.metrics.classification].label}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        {isRenaming ? (
          <input
            autoFocus
            className="w-full text-xs font-medium text-white bg-white/5 border border-cyan-500/40 rounded px-1.5 py-0.5 focus:outline-none"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") onDoubleClickName(-1); // cancel
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p
            className="truncate text-xs font-medium text-white"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenameValue(c.name);
              onDoubleClickName(c.id);
            }}
            title={c.name}
          >
            {c.name}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-500">
          <span
            className={cn(
              "font-medium px-1.5 py-0.5 rounded-full border",
              c.type === "video"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : "bg-pink-500/10 text-pink-400 border-pink-500/20"
            )}
          >
            {c.type}
          </span>
          {c.fileSize && (
            <span className="text-slate-600">{formatFileSize(c.fileSize)}</span>
          )}
          {c.batchNumber && (
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-medium">
              {c.batchNumber}
            </span>
          )}
          {c.editorName && (
            <span className="px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 truncate max-w-[80px]">
              {c.editorName}
            </span>
          )}
        </div>
        {/* Performance — stars + metrics so the library reads as an ads library */}
        {c.metrics && c.metrics.adCount === 0 && (
          <div className="mt-1.5 flex items-center justify-between rounded-md bg-white/[0.02] border border-white/[0.04] px-1.5 py-1"
            title="Not linked to a Meta ad yet — publish it from the uploader">
            <StarRating value={null} size={11} />
            <p className="text-[9px] text-slate-600">Not published</p>
          </div>
        )}
        {c.metrics && c.metrics.adCount > 0 && (
          <>
            <div className="mt-1.5 flex items-center justify-between"
              title={`${c.metrics.adCount} linked ad${c.metrics.adCount === 1 ? "" : "s"} (${c.metrics.activeAdCount} active)`}>
              <StarRating value={c.metrics.stars} size={12} showValue />
              {c.metrics.stars == null ? (
                <span className="text-[9px] font-medium text-blue-400/80">🧪 Testing</span>
              ) : (
                <span className="text-[9px] text-slate-500">
                  {c.metrics.adCount} ad{c.metrics.adCount === 1 ? "" : "s"}
                  {c.metrics.activeAdCount > 0 && <span className="text-emerald-500"> · {c.metrics.activeAdCount} live</span>}
                </span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1 rounded-md bg-white/[0.03] border border-white/[0.05] px-1.5 py-1">
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-wide text-slate-600">Spend</p>
                <p className="text-[10px] font-semibold text-white truncate">{fmtSpend(c.metrics.spend)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-wide text-slate-600">ROAS</p>
                <p className={cn("text-[10px] font-semibold truncate", c.metrics.roas >= 2 ? "text-emerald-400" : c.metrics.roas >= 1.42 ? "text-yellow-400" : "text-red-400")}>
                  {c.metrics.spend > 0 ? c.metrics.roas.toFixed(2) : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-wide text-slate-600">Hook</p>
                <p className="text-[10px] font-semibold text-white truncate">
                  {c.metrics.hookRate > 0 ? `${c.metrics.hookRate.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-wide text-slate-600">Hold</p>
                <p className="text-[10px] font-semibold text-white truncate">
                  {c.metrics.holdRate > 0 ? `${c.metrics.holdRate.toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>
          </>
        )}

        {c.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {c.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-slate-500">
                {tag}
              </span>
            ))}
            {c.tags.length > 3 && (
              <span className="text-[9px] text-slate-600">+{c.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
