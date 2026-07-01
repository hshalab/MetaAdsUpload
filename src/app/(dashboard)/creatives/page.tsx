"use client";

import { useEffect, useRef, useCallback } from "react";
import { Upload, Film, Tag, Trash2, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { useLibraryStore, type Creative, type UploadItem } from "@/components/library/use-library-store";
import { useLibraryKeyboard } from "@/components/library/use-library-keyboard";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { LibraryGrid } from "@/components/library/library-grid";
import { LibraryCard } from "@/components/library/library-card";
import { LibraryList } from "@/components/library/library-list";
import { LibraryListRow } from "@/components/library/library-list-row";
import { LibraryDetailPanel } from "@/components/library/library-detail-panel";
import { LibraryPreviewModal } from "@/components/library/library-preview-modal";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { LibraryEmptyState } from "@/components/library/library-empty-state";
import { LibraryDragOverlay, UploadProgressPanel } from "@/components/library/library-upload-overlay";

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CreativesPage() {
  const { state, dispatch, getCreativeById } = useLibraryStore();
  useLibraryKeyboard(state, dispatch);

  const fileRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);
  const dragOverRef = useRef(false);

  // ─── Fetch ───
  const fetchCreatives = useCallback(
    async (page = 1) => {
      dispatch({ type: "SET_LOADING", loading: true });
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (state.search) params.set("search", state.search);
      if (state.typeFilter !== "all") params.set("type", state.typeFilter);
      if (state.statusFilter !== "all") params.set("status", state.statusFilter);
      if (state.editorFilter) params.set("editor", state.editorFilter);
      if (state.batchFilter) params.set("batch", state.batchFilter);
      if (state.sort !== "date_desc") params.set("sort", state.sort);
      params.set("days", String(state.metricDays));

      try {
        const res = await fetch(`/api/library?${params}`);
        const data = await res.json();
        dispatch({
          type: "SET_CREATIVES",
          creatives: data.data || [],
          pagination: data.pagination || { page: 1, total: 0, totalPages: 0 },
        });
      } catch {
        toast.error("Failed to load library");
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [state.search, state.typeFilter, state.statusFilter, state.editorFilter, state.batchFilter, state.sort, state.metricDays, dispatch]
  );

  useEffect(() => {
    fetchCreatives();
  }, [fetchCreatives]);

  // ─── Upload with XHR progress ───
  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const items: UploadItem[] = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "pending" as const,
      }));
      dispatch({ type: "ADD_UPLOADS", items });

      for (const item of items) {
        dispatch({ type: "UPDATE_UPLOAD", id: item.id, status: "uploading", progress: 0 });
        try {
          // 1. Presign
          const presignRes = await fetch("/api/upload/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: item.file.name,
              contentType: item.file.type,
              fileSize: item.file.size,
              purpose: "library",
            }),
          });
          if (!presignRes.ok) throw new Error("Presign failed");
          const { uploadUrl } = await presignRes.json();

          // 2. Upload with XHR for progress
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", item.file.type);

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                dispatch({ type: "UPDATE_UPLOAD", id: item.id, progress: pct });
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`Upload failed: ${xhr.status}`));
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(item.file);
          });

          dispatch({ type: "UPDATE_UPLOAD", id: item.id, status: "done", progress: 100 });
        } catch {
          dispatch({ type: "UPDATE_UPLOAD", id: item.id, status: "error", error: `Failed to upload ${item.file.name}` });
          toast.error(`Failed to upload ${item.file.name}`);
        }
      }

      const doneCount = items.length;
      if (doneCount > 0) {
        toast.success(`${doneCount} file${doneCount > 1 ? "s" : ""} uploaded`);
        fetchCreatives();
      }
    },
    [dispatch, fetchCreatives]
  );

  // ─── Drag & Drop (using counter for nested elements) ───
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current++;
    if (!dragOverRef.current) {
      dragOverRef.current = true;
      // Force re-render for overlay
      dispatch({ type: "SET_SHOW_FILTERS", show: state.showFilters }); // no-op dispatch to trigger render
    }
  }, [dispatch, state.showFilters]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      dragOverRef.current = false;
      dispatch({ type: "SET_SHOW_FILTERS", show: state.showFilters });
    }
  }, [dispatch, state.showFilters]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      dragOverRef.current = false;
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles]
  );

  // ─── Bulk actions ───
  const bulkUpdateStatus = useCallback(
    async (status: string) => {
      for (const id of state.selectedIds) {
        await fetch("/api/library", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
      }
      toast.success(`${state.selectedIds.size} assets updated`);
      dispatch({ type: "CLEAR_SELECTION" });
      fetchCreatives();
    },
    [state.selectedIds, dispatch, fetchCreatives]
  );

  const bulkAddTag = useCallback(
    async (tag: string) => {
      for (const id of state.selectedIds) {
        const creative = state.creatives.find((c) => c.id === id);
        if (!creative) continue;
        const newTags = creative.tags.includes(tag) ? creative.tags : [...creative.tags, tag];
        await fetch("/api/library", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, tags: newTags }),
        });
      }
      toast.success(`Tag "${tag}" added to ${state.selectedIds.size} assets`);
      dispatch({ type: "CLEAR_SELECTION" });
      fetchCreatives();
    },
    [state.selectedIds, state.creatives, dispatch, fetchCreatives]
  );

  // ─── Rename ───
  const handleRename = useCallback(
    async (id: number, newName: string) => {
      await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName }),
      });
      toast.success("Renamed");
      dispatch({ type: "SET_RENAMING", id: null });
      fetchCreatives();
    },
    [dispatch, fetchCreatives]
  );

  // ─── Derived data ───
  const detailAsset = getCreativeById(state.detailAssetId);
  const previewAsset = getCreativeById(state.previewAssetId);
  const previewIndex = previewAsset ? state.creatives.findIndex((c) => c.id === previewAsset.id) : -1;
  const hasFilters = state.search !== "" || state.typeFilter !== "all" || state.statusFilter !== "all";

  return (
    <div
      className="space-y-6"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Film className="h-6 w-6 text-cyan-400" />
            Creative Library
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {state.pagination.total} asset{state.pagination.total !== 1 ? "s" : ""} in library
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={state.uploads.some((u) => u.status === "uploading")}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
          multiple
        />
      </div>

      {/* Drag overlay */}
      <LibraryDragOverlay dragOver={dragOverRef.current} />

      {/* Toolbar: search, filters, sort, view/density toggle */}
      <LibraryToolbar
        search={state.search}
        typeFilter={state.typeFilter}
        statusFilter={state.statusFilter}
        sort={state.sort}
        viewMode={state.viewMode}
        density={state.density}
        showFilters={state.showFilters}
        editorFilter={state.editorFilter}
        batchFilter={state.batchFilter}
        metricDays={state.metricDays}
        dispatch={dispatch}
      />

      {/* Bulk actions bar */}
      {state.selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-sm font-medium text-cyan-400">{state.selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkUpdateStatus("approved")}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-all">
              Approve
            </button>
            <button onClick={() => bulkUpdateStatus("in_review")}
              className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 transition-all">
              Mark Review
            </button>
            <button
              onClick={() => {
                const tag = prompt("Enter tag to add:");
                if (tag) bulkAddTag(tag.trim());
              }}
              className="px-3 py-1 rounded-lg bg-white/10 text-slate-300 text-xs font-medium hover:bg-white/15 transition-all"
            >
              <Tag className="h-3 w-3 inline mr-1" /> Add Tag
            </button>
            <button onClick={() => bulkUpdateStatus("archived")}
              className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 transition-all">
              <Trash2 className="h-3 w-3 inline mr-1" /> Arkivera
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Ta bort ${state.selectedIds.size} filer permanent? De raderas från R2 och kan inte återställas.`)) return;
                await fetch("/api/library", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ids: Array.from(state.selectedIds), hard: true }),
                });
                toast.success(`${state.selectedIds.size} filer borttagna`);
                dispatch({ type: "CLEAR_SELECTION" });
                fetchCreatives();
              }}
              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all">
              <Trash2 className="h-3 w-3 inline mr-1" /> Ta bort
            </button>
            <button onClick={() => dispatch({ type: "CLEAR_SELECTION" })}
              className="px-3 py-1 rounded-lg bg-white/5 text-slate-500 text-xs hover:text-slate-300 transition-all">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Select all toggle */}
      {state.creatives.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: "SELECT_ALL" })}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-all"
          >
            {state.selectedIds.size === state.creatives.length ? (
              <CheckSquare className="h-3.5 w-3.5 text-cyan-400" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {state.selectedIds.size === state.creatives.length ? "Deselect all" : "Select all"}
          </button>
        </div>
      )}

      {/* Content: Grid or List */}
      {state.loading ? (
        <LibrarySkeleton density={state.density} />
      ) : state.creatives.length === 0 ? (
        <LibraryEmptyState
          hasFilters={hasFilters}
          onUploadClick={() => fileRef.current?.click()}
        />
      ) : state.viewMode === "grid" ? (
        (() => {
          // Group creatives by batch for visual grouping
          const batches = new Map<string, typeof state.creatives>();
          for (const c of state.creatives) {
            const key = c.batchNumber || "__none__";
            if (!batches.has(key)) batches.set(key, []);
            batches.get(key)!.push(c);
          }
          const hasBatches = batches.size > 1 || !batches.has("__none__");

          if (!hasBatches) {
            // No batch grouping — render flat grid
            return (
              <LibraryGrid density={state.density}>
                {state.creatives.map((c, i) => (
                  <LibraryCard
                    key={c.id}
                    creative={c}
                    selected={state.selectedIds.has(c.id)}
                    focused={state.focusIndex === i}
                    renamingId={state.renamingId}
                    onSelect={(id) => dispatch({ type: "TOGGLE_SELECT", id })}
                    onClick={(creative) => dispatch({ type: "SET_DETAIL", id: creative.id })}
                    onDoubleClickName={(id) => dispatch({ type: "SET_RENAMING", id })}
                    onRename={handleRename}
                  />
                ))}
              </LibraryGrid>
            );
          }

          // Render grouped by batch
          let globalIdx = 0;
          return (
            <div className="space-y-6">
              {Array.from(batches.entries()).map(([batchKey, items]) => {
                const startIdx = globalIdx;
                globalIdx += items.length;
                return (
                  <div key={batchKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                        {batchKey === "__none__" ? "Utan batch" : `Batch ${batchKey}`}
                      </span>
                      <span className="text-[10px] text-slate-600">{items.length} filer</span>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                    </div>
                    <LibraryGrid density={state.density}>
                      {items.map((c, i) => (
                        <LibraryCard
                          key={c.id}
                          creative={c}
                          selected={state.selectedIds.has(c.id)}
                          focused={state.focusIndex === startIdx + i}
                          renamingId={state.renamingId}
                          onSelect={(id) => dispatch({ type: "TOGGLE_SELECT", id })}
                          onClick={(creative) => dispatch({ type: "SET_DETAIL", id: creative.id })}
                          onDoubleClickName={(id) => dispatch({ type: "SET_RENAMING", id })}
                          onRename={handleRename}
                        />
                      ))}
                    </LibraryGrid>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
        <LibraryList sort={state.sort} dispatch={dispatch}>
          {state.creatives.map((c, i) => (
            <LibraryListRow
              key={c.id}
              creative={c}
              selected={state.selectedIds.has(c.id)}
              focused={state.focusIndex === i}
              onClick={(creative) => dispatch({ type: "SET_DETAIL", id: creative.id })}
            />
          ))}
        </LibraryList>
      )}

      {/* Pagination */}
      {state.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: state.pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchCreatives(p)}
              className={cn(
                "h-8 w-8 rounded-lg text-xs font-medium transition-all",
                state.pagination.page === p
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Detail Side Panel */}
      {detailAsset && (
        <LibraryDetailPanel
          metricDays={state.metricDays}
          creative={detailAsset}
          onClose={() => dispatch({ type: "SET_DETAIL", id: null })}
          onRefresh={fetchCreatives}
        />
      )}

      {/* Preview Lightbox */}
      {previewAsset && (
        <LibraryPreviewModal
          creative={previewAsset}
          onClose={() => dispatch({ type: "SET_PREVIEW", id: null })}
          onPrev={() => {
            if (previewIndex > 0) dispatch({ type: "SET_PREVIEW", id: state.creatives[previewIndex - 1].id });
          }}
          onNext={() => {
            if (previewIndex < state.creatives.length - 1) dispatch({ type: "SET_PREVIEW", id: state.creatives[previewIndex + 1].id });
          }}
          hasPrev={previewIndex > 0}
          hasNext={previewIndex < state.creatives.length - 1}
        />
      )}

      {/* Upload Progress Panel */}
      <UploadProgressPanel uploads={state.uploads} dispatch={dispatch} />
    </div>
  );
}
