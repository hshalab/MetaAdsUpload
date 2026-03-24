"use client";

import { Upload, SearchX } from "lucide-react";

interface LibraryEmptyStateProps {
  hasFilters: boolean;
  onUploadClick: () => void;
}

export function LibraryEmptyState({ hasFilters, onUploadClick }: LibraryEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="col-span-full py-20 text-center">
        <SearchX className="h-10 w-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-medium">No assets match your filters</p>
        <p className="text-slate-600 text-xs mt-1">Try adjusting your search or filter criteria</p>
      </div>
    );
  }

  return (
    <div className="col-span-full py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
        <Upload className="h-7 w-7 text-cyan-400" />
      </div>
      <p className="text-slate-300 text-sm font-medium">Your library is empty</p>
      <p className="text-slate-600 text-xs mt-1 mb-4">Drag & drop files here or click the button below</p>
      <button
        onClick={onUploadClick}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
      >
        Upload Files
      </button>
    </div>
  );
}
