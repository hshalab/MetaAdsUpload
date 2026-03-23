"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Image, Video, Search, Film, X, Tag, Filter,
  ChevronDown, Loader2, Trash2, Eye, CheckSquare, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Creative {
  id: number;
  name: string;
  type: string;
  source: string;
  thumbnailUrl: string | null;
  r2Url: string | null;
  r2Key: string | null;
  fileSize: number | null;
  tags: string[];
  editorName: string | null;
  batchNumber: number | null;
  status: string;
  assignmentId: string | null;
  createdAt: string;
}

type StatusFilter = "all" | "uploaded" | "in_review" | "approved" | "archived";
type TypeFilter = "all" | "video" | "image";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editorFilter, setEditorFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailAsset, setDetailAsset] = useState<Creative | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ─── Fetch ───
  const fetchCreatives = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (editorFilter) params.set("editor", editorFilter);
    if (batchFilter) params.set("batch", batchFilter);

    try {
      const res = await fetch(`/api/library?${params}`);
      const data = await res.json();
      setCreatives(data.data || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch {
      toast.error("Failed to load library");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, editorFilter, batchFilter]);

  useEffect(() => { fetchCreatives(); }, [fetchCreatives]);

  // ─── Upload ───
  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      try {
        // 1. Get presigned URL
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
            purpose: "library",
          }),
        });
        if (!presignRes.ok) throw new Error("Presign failed");
        const { uploadUrl } = await presignRes.json();

        // 2. Upload to R2
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        uploaded++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} file${uploaded > 1 ? "s" : ""} uploaded`);
      fetchCreatives();
    }
    setUploading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = "";
  };

  // ─── Drag & Drop ───
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  // ─── Selection ───
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (selectedIds.size === creatives.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(creatives.map((c) => c.id)));
  };

  // ─── Bulk actions ───
  const bulkUpdateStatus = async (status: string) => {
    for (const id of selectedIds) {
      await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    }
    toast.success(`${selectedIds.size} assets updated`);
    setSelectedIds(new Set());
    fetchCreatives();
  };

  const bulkAddTag = async (tag: string) => {
    for (const id of selectedIds) {
      const creative = creatives.find((c) => c.id === id);
      if (!creative) continue;
      const newTags = creative.tags.includes(tag) ? creative.tags : [...creative.tags, tag];
      await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tags: newTags }),
      });
    }
    toast.success(`Tag "${tag}" added to ${selectedIds.size} assets`);
    setSelectedIds(new Set());
    fetchCreatives();
  };

  // ─── Detail panel actions ───
  const openDetail = (c: Creative) => {
    setDetailAsset(c);
    setEditTags([...c.tags]);
    setNewTag("");
  };

  const saveDetailTags = async () => {
    if (!detailAsset) return;
    await fetch("/api/library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: detailAsset.id, tags: editTags }),
    });
    toast.success("Tags updated");
    fetchCreatives();
    setDetailAsset({ ...detailAsset, tags: editTags });
  };

  const updateDetailStatus = async (status: string) => {
    if (!detailAsset) return;
    await fetch("/api/library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: detailAsset.id, status }),
    });
    toast.success("Status updated");
    fetchCreatives();
    setDetailAsset({ ...detailAsset, status });
  };

  // ─── Render ───
  return (
    <div className="space-y-6" ref={dropRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Film className="h-6 w-6 text-cyan-400" />
            Creative Library
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pagination.total} asset{pagination.total !== 1 ? "s" : ""} in library
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFileInput} multiple />
        </div>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-cyan-500/10 border-2 border-dashed border-cyan-400 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="h-12 w-12 text-cyan-400 mx-auto mb-3" />
            <p className="text-lg font-semibold text-cyan-400">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
              placeholder="Search by name or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Type pills */}
          <div className="flex gap-1">
            {(["all", "video", "image"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
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
                onClick={() => setStatusFilter(s)}
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
              showFilters ? "border-cyan-500/30 text-cyan-400" : "border-white/[0.06] text-slate-500 hover:text-slate-300"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            More
            <ChevronDown className={cn("h-3 w-3 transition-transform", showFilters && "rotate-180")} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex gap-3">
            <input
              className="w-40 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              placeholder="Editor name..."
              value={editorFilter}
              onChange={(e) => setEditorFilter(e.target.value)}
            />
            <input
              className="w-28 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              placeholder="Batch #"
              type="number"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-sm font-medium text-cyan-400">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkUpdateStatus("approved")}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-all">
              Approve
            </button>
            <button onClick={() => bulkUpdateStatus("in_review")}
              className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 transition-all">
              Mark Review
            </button>
            <button onClick={() => {
              const tag = prompt("Enter tag to add:");
              if (tag) bulkAddTag(tag.trim());
            }}
              className="px-3 py-1 rounded-lg bg-white/10 text-slate-300 text-xs font-medium hover:bg-white/15 transition-all">
              <Tag className="h-3 w-3 inline mr-1" /> Add Tag
            </button>
            <button onClick={() => bulkUpdateStatus("archived")}
              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all">
              <Trash2 className="h-3 w-3 inline mr-1" /> Archive
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 rounded-lg bg-white/5 text-slate-500 text-xs hover:text-slate-300 transition-all">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Select all toggle */}
      {creatives.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-all">
            {selectedIds.size === creatives.length
              ? <CheckSquare className="h-3.5 w-3.5 text-cyan-400" />
              : <Square className="h-3.5 w-3.5" />}
            {selectedIds.size === creatives.length ? "Deselect all" : "Select all"}
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {creatives.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group relative rounded-xl border overflow-hidden transition-all cursor-pointer",
                selectedIds.has(c.id)
                  ? "border-cyan-500/40 bg-cyan-500/5"
                  : "border-white/5 bg-[#111827] hover:border-white/10"
              )}
              onClick={() => openDetail(c)}
            >
              {/* Select checkbox */}
              <button
                className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
              >
                {selectedIds.has(c.id)
                  ? <CheckSquare className="h-5 w-5 text-cyan-400" />
                  : <Square className="h-5 w-5 text-white/50 hover:text-white/80" />}
              </button>

              {/* Thumbnail / Preview */}
              <div className="relative aspect-video bg-white/[0.02] flex items-center justify-center overflow-hidden">
                {c.r2Url && c.type === "image" ? (
                  <img src={c.r2Url} alt={c.name} className="h-full w-full object-cover" />
                ) : c.r2Url && c.type === "video" ? (
                  <video
                    src={c.r2Url}
                    className="h-full w-full object-cover"
                    muted
                    preload="metadata"
                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                    onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                  />
                ) : c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-cover" />
                ) : c.type === "video" ? (
                  <Video className="h-10 w-10 text-slate-600" />
                ) : (
                  <Image className="h-10 w-10 text-slate-600" />
                )}

                {/* Status badge */}
                <span className={cn(
                  "absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                  STATUS_COLORS[c.status] || STATUS_COLORS.uploaded
                )}>
                  {c.status === "in_review" ? "review" : c.status}
                </span>
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="truncate text-xs font-medium text-white">{c.name}</p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className={cn(
                    "text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                    c.type === "video" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-pink-500/10 text-pink-400 border-pink-500/20"
                  )}>
                    {c.type}
                  </span>
                  {c.editorName && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-500 border border-white/10">
                      {c.editorName}
                    </span>
                  )}
                  {c.batchNumber && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-500 border border-white/10">
                      B{c.batchNumber}
                    </span>
                  )}
                </div>
                {c.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-slate-500">{tag}</span>
                    ))}
                    {c.tags.length > 3 && <span className="text-[9px] text-slate-600">+{c.tags.length - 3}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {creatives.length === 0 && !loading && (
            <div className="col-span-full py-16 text-center">
              <Upload className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                {search || typeFilter !== "all" || statusFilter !== "all" ? "No assets match your filters." : "No creatives yet. Drag & drop or click Upload."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchCreatives(p)}
              className={cn(
                "h-8 w-8 rounded-lg text-xs font-medium transition-all",
                pagination.page === p
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
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setDetailAsset(null)} />
          <div className="w-[420px] bg-[#0d1117] border-l border-white/[0.08] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white truncate">{detailAsset.name}</h3>
              <button onClick={() => setDetailAsset(null)} className="text-slate-500 hover:text-white transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="aspect-video bg-black/30 flex items-center justify-center">
              {detailAsset.r2Url && detailAsset.type === "video" ? (
                <video src={detailAsset.r2Url} controls className="h-full w-full object-contain" />
              ) : detailAsset.r2Url && detailAsset.type === "image" ? (
                <img src={detailAsset.r2Url} alt={detailAsset.name} className="h-full w-full object-contain" />
              ) : detailAsset.thumbnailUrl ? (
                <img src={detailAsset.thumbnailUrl} alt={detailAsset.name} className="h-full w-full object-contain" />
              ) : (
                <Film className="h-16 w-16 text-slate-700" />
              )}
            </div>

            {/* Metadata */}
            <div className="px-5 py-4 space-y-4">
              {/* Status */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Status</label>
                <div className="flex gap-1.5 mt-1.5">
                  {(["uploaded", "in_review", "approved"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateDetailStatus(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all",
                        detailAsset.status === s
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
                  <p className="text-white mt-0.5">{detailAsset.type}</p>
                </div>
                <div>
                  <span className="text-slate-600">Size</span>
                  <p className="text-white mt-0.5">
                    {detailAsset.fileSize ? `${(detailAsset.fileSize / 1024 / 1024).toFixed(1)} MB` : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-600">Editor</span>
                  <p className="text-white mt-0.5">{detailAsset.editorName || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-600">Batch</span>
                  <p className="text-white mt-0.5">{detailAsset.batchNumber || "—"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-600">Uploaded</span>
                  <p className="text-white mt-0.5">{new Date(detailAsset.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {/* R2 URL */}
              {detailAsset.r2Url && (
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">R2 URL</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      readOnly
                      value={detailAsset.r2Url}
                      className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-slate-400 truncate"
                    />
                    <button
                      onClick={() => { navigator.clipboard.writeText(detailAsset.r2Url!); toast.success("URL copied"); }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Tags</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {editTags.map((tag, i) => (
                    <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                      {tag}
                      <button onClick={() => { setEditTags(editTags.filter((_, j) => j !== i)); }}
                        className="text-slate-600 hover:text-red-400">
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
                    onClick={saveDetailTags}
                    className="px-3 py-1 rounded bg-cyan-600 text-xs text-white hover:bg-cyan-500 transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Archive */}
              <button
                onClick={async () => {
                  await updateDetailStatus("archived");
                  setDetailAsset(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" /> Archive Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
