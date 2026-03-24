"use client";

import { Video, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatFileSize, formatResolution } from "@/lib/format-utils";
import { TableRow, TableCell } from "@/components/ui/table";
import type { Creative } from "./use-library-store";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

interface LibraryListRowProps {
  creative: Creative;
  selected: boolean;
  focused: boolean;
  onClick: (c: Creative) => void;
}

export function LibraryListRow({ creative: c, selected, focused, onClick }: LibraryListRowProps) {
  return (
    <TableRow
      className={cn(
        "cursor-pointer border-white/[0.04] transition-all",
        selected
          ? "bg-cyan-500/5 hover:bg-cyan-500/10"
          : focused
            ? "bg-white/[0.03] hover:bg-white/[0.05]"
            : "hover:bg-white/[0.03]"
      )}
      onClick={() => onClick(c)}
      data-creative-id={c.id}
    >
      {/* Mini thumbnail */}
      <TableCell className="w-16 p-1.5">
        <div className="w-12 h-8 rounded bg-white/[0.02] overflow-hidden flex items-center justify-center">
          {c.thumbnailUrl || (c.r2Url && c.type === "image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumbnailUrl || c.r2Url!} alt="" className="w-full h-full object-cover" />
          ) : c.type === "video" ? (
            <Video className="h-3.5 w-3.5 text-slate-600" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5 text-slate-600" />
          )}
        </div>
      </TableCell>

      {/* Name */}
      <TableCell className="font-medium text-white truncate max-w-[200px]" title={c.name}>
        {c.name}
      </TableCell>

      {/* Type */}
      <TableCell>
        <span
          className={cn(
            "text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
            c.type === "video" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-pink-500/10 text-pink-400 border-pink-500/20"
          )}
        >
          {c.type}
        </span>
      </TableCell>

      {/* Duration */}
      <TableCell className="text-slate-400 font-mono">
        {c.type === "video" ? formatDuration(c.duration) : "—"}
      </TableCell>

      {/* Resolution */}
      <TableCell className="text-slate-500 text-[10px]">
        {formatResolution(c.width, c.height)}
      </TableCell>

      {/* Size */}
      <TableCell className="text-slate-500">{formatFileSize(c.fileSize)}</TableCell>

      {/* Status */}
      <TableCell>
        <span
          className={cn(
            "text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
            STATUS_COLORS[c.status] || STATUS_COLORS.uploaded
          )}
        >
          {c.status === "in_review" ? "review" : c.status}
        </span>
      </TableCell>

      {/* Batch */}
      <TableCell>
        {c.batchNumber ? (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {c.batchNumber}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </TableCell>

      {/* Editor */}
      <TableCell className="text-slate-500 truncate max-w-[100px]">{c.editorName || "—"}</TableCell>

      {/* Date */}
      <TableCell className="text-slate-600 text-[10px]">
        {new Date(c.createdAt).toLocaleDateString("sv-SE")}
      </TableCell>
    </TableRow>
  );
}
