"use client";

import { useEffect, useState } from "react";
import {
  Search, Filter, ChevronDown, LayoutGrid, List,
  ArrowUpDown, Minus, Square as SquareIcon, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dispatch } from "react";
import type {
  LibraryAction, ViewMode, Density, SortOption,
  TypeFilter, StatusFilter,
} from "./use-library-store";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "spend_desc", label: "Top spend" },
  { value: "roas_desc", label: "Best ROAS" },
  { value: "hook_desc", label: "Best hook rate" },
  { value: "hold_desc", label: "Best hold rate" },
  { value: "ctr_desc", label: "Best CTR" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "size_desc", label: "Largest" },
  { value: "size_asc", label: "Smallest" },
];

const METRIC_WINDOWS: { days: number; label: string }[] = [
  { days: 7, label: "7D" },
  { days: 14, label: "14D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 0, label: "ALL" },
];

const DENSITY_ICONS: Record<Density, typeof Minus> = {
  sm: Minus,
  md: SquareIcon,
  lg: Maximize2,
};

interface LibraryToolbarProps {
  search: string;
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  sort: SortOption;
  viewMode: ViewMode;
  density: Density;
  showFilters: boolean;
  editorFilter: string;
  batchFilter: string;
  metricDays: number;
  winnersOnly: boolean;
  angleFilter: string;
  dispatch: Dispatch<LibraryAction>;
}

export function LibraryToolbar({
  search,
  typeFilter,
  statusFilter,
  sort,
  viewMode,
  density,
  showFilters,
  editorFilter,
  batchFilter,
  metricDays,
  winnersOnly,
  angleFilter,
  dispatch,
}: LibraryToolbarProps) {
  const currentSort = SORT_OPTIONS.find((o) => o.value === sort)!;
  const [angles, setAngles] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/options")
      .then((r) => (r.ok ? r.json() : { angles: [] }))
      .then((d) => setAngles(d.angles || []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 items-center flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
            placeholder="Search by name or tag...  ( / )"
            value={search}
            onChange={(e) => dispatch({ type: "SET_SEARCH", search: e.target.value })}
            data-library-search
          />
        </div>

        {/* Type pills */}
        <div className="flex gap-1">
          {(["all", "video", "image"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => dispatch({ type: "SET_TYPE_FILTER", filter: t })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                typeFilter === t
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                  : "border-white/[0.06] text-slate-500 hover:text-slate-300"
              )}
            >
              {t === "all" ? "All" : t === "video" ? "Video" : "Image"}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex gap-1">
          {(["all", "uploaded", "in_review", "approved"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => dispatch({ type: "SET_STATUS_FILTER", filter: s })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                statusFilter === s
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                  : "border-white/[0.06] text-slate-500 hover:text-slate-300"
              )}
            >
              {s === "all" ? "All" : s === "in_review" ? "Review" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Winners quick filter */}
        <button
          onClick={() => dispatch({ type: "SET_WINNERS_ONLY", on: !winnersOnly })}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
            winnersOnly
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
              : "border-white/[0.06] text-slate-500 hover:text-slate-300"
          )}
          title="Show only creatives classified as winners"
        >
          🏆 Winners
        </button>

        {/* More filters toggle */}
        <button
          onClick={() => dispatch({ type: "SET_SHOW_FILTERS", show: !showFilters })}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
            showFilters ? "border-cyan-500/30 text-cyan-400" : "border-white/[0.06] text-slate-500 hover:text-slate-300"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          More
          <ChevronDown className={cn("h-3 w-3 transition-transform", showFilters && "rotate-180")} />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Performance window */}
        <div className="flex gap-0.5 border border-white/[0.06] rounded-lg p-0.5" title="Performance data window">
          {METRIC_WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => dispatch({ type: "SET_METRIC_DAYS", days: w.days })}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                metricDays === w.days ? "bg-cyan-500/10 text-cyan-400" : "text-slate-600 hover:text-slate-400"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/[0.06] text-slate-500 hover:text-slate-300 transition-all">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {currentSort.label}
          </button>
          <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-[#111827] border border-white/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => dispatch({ type: "SET_SORT", sort: opt.value })}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs transition-all first:rounded-t-lg last:rounded-b-lg",
                  sort === opt.value
                    ? "text-cyan-400 bg-cyan-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Density control */}
        <div className="flex gap-0.5 border border-white/[0.06] rounded-lg p-0.5">
          {(["sm", "md", "lg"] as Density[]).map((d) => {
            const Icon = DENSITY_ICONS[d];
            return (
              <button
                key={d}
                onClick={() => dispatch({ type: "SET_DENSITY", density: d })}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  density === d ? "bg-cyan-500/10 text-cyan-400" : "text-slate-600 hover:text-slate-400"
                )}
                title={`Density: ${d.toUpperCase()}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="flex gap-0.5 border border-white/[0.06] rounded-lg p-0.5">
          <button
            onClick={() => dispatch({ type: "SET_VIEW_MODE", mode: "grid" })}
            className={cn(
              "p-1.5 rounded-md transition-all",
              viewMode === "grid" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-600 hover:text-slate-400"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => dispatch({ type: "SET_VIEW_MODE", mode: "list" })}
            className={cn(
              "p-1.5 rounded-md transition-all",
              viewMode === "list" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-600 hover:text-slate-400"
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex gap-3">
          <input
            className="w-40 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            placeholder="Editor name..."
            value={editorFilter}
            onChange={(e) => dispatch({ type: "SET_EDITOR_FILTER", filter: e.target.value })}
          />
          <input
            className="w-28 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            placeholder="Batch (Jan194)"
            value={batchFilter}
            onChange={(e) => dispatch({ type: "SET_BATCH_FILTER", filter: e.target.value })}
          />
          <select
            className="w-40 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500/50"
            value={angleFilter}
            onChange={(e) => dispatch({ type: "SET_ANGLE_FILTER", angleId: e.target.value })}
          >
            <option value="" className="bg-[#111827]">All angles</option>
            {angles.map((a) => (
              <option key={a.id} value={a.id} className="bg-[#111827]">{a.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
