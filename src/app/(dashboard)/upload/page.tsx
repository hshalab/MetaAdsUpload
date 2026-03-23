"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Upload,
  Cloud,
  HardDrive,
  Folder,
  FolderOpen,
  FileVideo,
  ImageIcon,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  Trash2,
  Play,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
}

interface AdSetItem {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  optimization_goal?: string;
}

interface R2Folder {
  name: string;
  prefix: string;
  type: "folder";
}

interface R2File {
  key: string;
  name: string;
  size: number;
  lastModified?: string;
  url: string;
  type: "file";
  mediaType: "video" | "image";
}

interface UploadJob {
  id: string;
  filename: string;
  status: "pending" | "uploading_r2" | "uploading_meta" | "completed" | "failed";
  step: string;
  error?: string;
  r2Key?: string;
  r2Url?: string;
  mediaType: "video" | "image";
  file?: File;
  result?: Record<string, string>;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<"computer" | "cloudflare">("computer");

  // Campaigns & Adsets
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<AdSetItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedAdsetId, setSelectedAdsetId] = useState("");
  const [adsetMode, setAdsetMode] = useState<"existing" | "new">("existing");
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingAdsets, setLoadingAdsets] = useState(false);

  // New adset config
  const [newAdsetName, setNewAdsetName] = useState("");
  const [newAdsetBudget, setNewAdsetBudget] = useState(50);
  const [newAdsetCountry, setNewAdsetCountry] = useState("SE");
  const [newAdsetOptGoal, setNewAdsetOptGoal] = useState("OFFSITE_CONVERSIONS");
  const [newAdsetBidStrategy, setNewAdsetBidStrategy] = useState("LOWEST_COST_WITHOUT_CAP");

  // Ad copy
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [ctaType, setCtaType] = useState("SHOP_NOW");

  // Upload queue
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Computer upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // R2 browse
  const [r2Prefix, setR2Prefix] = useState("");
  const [r2Folders, setR2Folders] = useState<R2Folder[]>([]);
  const [r2Files, setR2Files] = useState<R2File[]>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Selected, setR2Selected] = useState<R2File[]>([]);
  const [r2PathStack, setR2PathStack] = useState<string[]>([""]);

  // ─── Fetch campaigns ───────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/meta/campaigns");
        if (res.ok) {
          const { data } = await res.json();
          setCampaigns(data || []);
        }
      } catch {
        toast.error("Failed to load campaigns");
      } finally {
        setLoadingCampaigns(false);
      }
    })();
  }, []);

  // ─── Fetch adsets when campaign changes ─────────────────────────────────

  useEffect(() => {
    if (!selectedCampaignId) {
      setAdsets([]);
      return;
    }
    setLoadingAdsets(true);
    (async () => {
      try {
        const res = await fetch(`/api/meta/adsets?campaign_id=${selectedCampaignId}`);
        if (res.ok) {
          const { data } = await res.json();
          setAdsets(data || []);
        }
      } catch {
        toast.error("Failed to load ad sets");
      } finally {
        setLoadingAdsets(false);
      }
    })();
  }, [selectedCampaignId]);

  // ─── R2 Browse ──────────────────────────────────────────────────────────

  const browseR2 = useCallback(async (prefix: string) => {
    setR2Loading(true);
    try {
      const res = await fetch(`/api/r2/browse?prefix=${encodeURIComponent(prefix)}`);
      if (!res.ok) throw new Error("Failed to browse");
      const data = await res.json();
      setR2Folders(data.folders || []);
      setR2Files(data.files || []);
      setR2Prefix(prefix);
    } catch {
      toast.error("Failed to browse Cloudflare R2");
    } finally {
      setR2Loading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "cloudflare") {
      browseR2("");
    }
  }, [activeTab, browseR2]);

  const navigateR2 = (prefix: string) => {
    setR2PathStack((prev) => [...prev, prefix]);
    setR2Selected([]);
    browseR2(prefix);
  };

  const goBackR2 = () => {
    setR2PathStack((prev) => {
      const next = prev.slice(0, -1);
      const prefix = next[next.length - 1] || "";
      browseR2(prefix);
      return next;
    });
    setR2Selected([]);
  };

  const toggleR2Select = (file: R2File) => {
    setR2Selected((prev) =>
      prev.some((f) => f.key === file.key)
        ? prev.filter((f) => f.key !== file.key)
        : [...prev, file]
    );
  };

  // ─── File handling ──────────────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("video/") || f.type.startsWith("image/")
    );
    if (files.length > 0) setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setSelectedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Upload to R2 via presigned URL ─────────────────────────────────────

  const uploadFileToR2 = async (file: File): Promise<{ key: string; url: string }> => {
    // Get presigned URL
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

    if (!presignRes.ok) {
      const err = await presignRes.json();
      throw new Error(err.error || "Failed to get presigned URL");
    }

    const { uploadUrl, publicUrl, key } = await presignRes.json();

    // Upload directly to R2
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!uploadRes.ok) throw new Error("Failed to upload to R2");

    return { key, url: publicUrl };
  };

  // ─── Upload to Meta from R2 ────────────────────────────────────────────

  const uploadToMeta = async (
    r2Key: string,
    r2Url: string,
    filename: string,
    mediaType: "video" | "image"
  ): Promise<Record<string, string>> => {
    const payload: Record<string, unknown> = {
      r2Key,
      r2Url,
      filename,
      mediaType,
      campaignId: selectedCampaignId,
      adCopy: { headline, primaryText, linkUrl, ctaType },
      adName: filename.replace(/\.[^.]+$/, ""),
    };

    if (adsetMode === "existing" && selectedAdsetId) {
      payload.adsetId = selectedAdsetId;
    } else if (adsetMode === "new") {
      payload.adsetConfig = {
        name: newAdsetName || `AdSet ${new Date().toLocaleDateString("sv")}`,
        dailyBudget: newAdsetBudget,
        targeting: { geo_locations: { countries: [newAdsetCountry] } },
        optimizationGoal: newAdsetOptGoal,
        bidStrategy: newAdsetBidStrategy,
      };
    }

    const res = await fetch("/api/meta/upload-from-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Meta upload failed");
    }

    return await res.json();
  };

  // ─── Process queue ──────────────────────────────────────────────────────

  const addToQueue = () => {
    if (!selectedCampaignId) {
      toast.error("Select a campaign first");
      return;
    }
    if (adsetMode === "existing" && !selectedAdsetId) {
      toast.error("Select an ad set or switch to 'Create New'");
      return;
    }

    const newJobs: UploadJob[] = [];

    if (activeTab === "computer") {
      if (selectedFiles.length === 0) {
        toast.error("Select files to upload");
        return;
      }
      for (const file of selectedFiles) {
        newJobs.push({
          id: crypto.randomUUID(),
          filename: file.name,
          status: "pending",
          step: "Waiting...",
          mediaType: file.type.startsWith("video/") ? "video" : "image",
          file,
        });
      }
      setSelectedFiles([]);
    } else {
      if (r2Selected.length === 0) {
        toast.error("Select files from R2");
        return;
      }
      for (const f of r2Selected) {
        newJobs.push({
          id: crypto.randomUUID(),
          filename: f.name,
          status: "pending",
          step: "Waiting...",
          mediaType: f.mediaType,
          r2Key: f.key,
          r2Url: f.url,
        });
      }
      setR2Selected([]);
    }

    setJobs((prev) => [...prev, ...newJobs]);
    toast.success(`${newJobs.length} file(s) added to queue`);
  };

  const processQueue = async () => {
    setIsUploading(true);
    const pending = jobs.filter((j) => j.status === "pending");

    // For "new adset" mode, we create the adset with the first file
    // and reuse it for subsequent files
    let createdAdsetId: string | undefined;

    for (const job of pending) {
      try {
        // Step 1: Upload to R2 if from computer
        if (job.file && !job.r2Key) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id ? { ...j, status: "uploading_r2", step: "Uploading to R2..." } : j
            )
          );
          const { key, url } = await uploadFileToR2(job.file);
          job.r2Key = key;
          job.r2Url = url;
        }

        // Step 2: Upload to Meta
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "uploading_meta", step: "Uploading to Meta..." } : j
          )
        );

        // If we created an adset from a previous file in this batch, reuse it
        const overrideAdsetId = createdAdsetId || undefined;
        const payload: Record<string, unknown> = {
          r2Key: job.r2Key,
          r2Url: job.r2Url,
          filename: job.filename,
          mediaType: job.mediaType,
          campaignId: selectedCampaignId,
          adCopy: { headline, primaryText, linkUrl, ctaType },
          adName: job.filename.replace(/\.[^.]+$/, ""),
        };

        if (overrideAdsetId) {
          payload.adsetId = overrideAdsetId;
        } else if (adsetMode === "existing" && selectedAdsetId) {
          payload.adsetId = selectedAdsetId;
        } else if (adsetMode === "new") {
          payload.adsetConfig = {
            name: newAdsetName || `AdSet ${new Date().toLocaleDateString("sv")}`,
            dailyBudget: newAdsetBudget,
            targeting: { geo_locations: { countries: [newAdsetCountry] } },
            optimizationGoal: newAdsetOptGoal,
            bidStrategy: newAdsetBidStrategy,
          };
        }

        const res = await fetch("/api/meta/upload-from-r2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Meta upload failed");
        }

        const result = await res.json();

        // Save created adset for subsequent files
        if (result.adsetId && adsetMode === "new" && !createdAdsetId) {
          createdAdsetId = result.adsetId;
        }

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: "completed", step: "Done!", result }
              : j
          )
        );
      } catch (error) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "failed",
                  step: "Failed",
                  error: error instanceof Error ? error.message : "Unknown error",
                }
              : j
          )
        );
      }
    }

    setIsUploading(false);
    const completed = pending.length;
    if (completed > 0) toast.success(`Processed ${completed} file(s)`);
  };

  const clearCompleted = () => {
    setJobs((prev) => prev.filter((j) => j.status !== "completed" && j.status !== "failed"));
  };

  const removeJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  // ─── Helpers ────────────────────────────────────────────────────────────

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const hasPending = jobs.some((j) => j.status === "pending");
  const hasCompleted = jobs.some((j) => j.status === "completed" || j.status === "failed");

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Upload className="h-6 w-6 text-cyan-400" />
          Upload Ads
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Upload videos/images to Meta Ads from your computer or Cloudflare R2
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        {/* ─── Left: File Selection ─── */}
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-white/[0.06] bg-[#111827] p-1 gap-1">
            <button
              onClick={() => setActiveTab("computer")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
                activeTab === "computer"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <HardDrive className="h-4 w-4" />
              From Computer
            </button>
            <button
              onClick={() => setActiveTab("cloudflare")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
                activeTab === "cloudflare"
                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Cloud className="h-4 w-4" />
              From Cloudflare R2
            </button>
          </div>

          {/* Computer Upload */}
          {activeTab === "computer" && (
            <div className="space-y-3">
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed transition-all p-8",
                  dragOver
                    ? "border-cyan-400 bg-cyan-400/5"
                    : "border-white/[0.08] hover:border-white/[0.15] bg-[#111827]"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center text-center">
                  <Upload className="h-10 w-10 text-slate-500 mb-3" />
                  <p className="text-sm font-medium text-white mb-1">
                    Drag & drop files here
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    MP4, MOV, WebM, JPG, PNG (max 500MB per file)
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm font-medium hover:bg-cyan-500/20 transition-all"
                  >
                    Browse Files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>
              </div>

              {/* Selected files list */}
              {selectedFiles.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#111827] divide-y divide-white/[0.04]">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      {selectedFiles.length} file(s) selected
                    </span>
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2">
                      {file.type.startsWith("video/") ? (
                        <FileVideo className="h-4 w-4 text-cyan-400 shrink-0" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{formatSize(file.size)}</p>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cloudflare R2 Browse */}
          {activeTab === "cloudflare" && (
            <div className="rounded-xl border border-white/[0.06] bg-[#111827] overflow-hidden">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
                {r2PathStack.length > 1 && (
                  <button
                    onClick={goBackR2}
                    className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <Cloud className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-slate-400 truncate">
                  {r2Prefix || "/ (root)"}
                </span>
                <button
                  onClick={() => browseR2(r2Prefix)}
                  className="ml-auto p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", r2Loading && "animate-spin")} />
                </button>
              </div>

              {r2Loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03] max-h-[400px] overflow-y-auto">
                  {r2Folders.map((folder) => (
                    <button
                      key={folder.prefix}
                      onClick={() => navigateR2(folder.prefix)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <Folder className="h-4 w-4 text-yellow-400 shrink-0" />
                      <span className="text-xs text-white flex-1">{folder.name}/</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    </button>
                  ))}
                  {r2Files.map((file) => {
                    const isSelected = r2Selected.some((f) => f.key === file.key);
                    return (
                      <button
                        key={file.key}
                        onClick={() => toggleR2Select(file)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left",
                          isSelected
                            ? "bg-orange-500/5 border-l-2 border-orange-400"
                            : "hover:bg-white/[0.02]"
                        )}
                      >
                        {file.mediaType === "video" ? (
                          <FileVideo className="h-4 w-4 text-cyan-400 shrink-0" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {formatSize(file.size)}
                            {file.lastModified && ` · ${new Date(file.lastModified).toLocaleDateString("sv")}`}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0" />}
                      </button>
                    );
                  })}
                  {r2Folders.length === 0 && r2Files.length === 0 && (
                    <div className="py-8 text-center">
                      <FolderOpen className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">No media files in this folder</p>
                    </div>
                  )}
                </div>
              )}

              {r2Selected.length > 0 && (
                <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between bg-orange-500/5">
                  <span className="text-xs font-medium text-orange-400">
                    {r2Selected.length} file(s) selected
                  </span>
                  <button
                    onClick={() => setR2Selected([])}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Add to Queue button */}
          <button
            onClick={addToQueue}
            disabled={
              (activeTab === "computer" && selectedFiles.length === 0) ||
              (activeTab === "cloudflare" && r2Selected.length === 0) ||
              !selectedCampaignId
            }
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Add to Upload Queue
          </button>
        </div>

        {/* ─── Right: Config Panel ─── */}
        <div className="space-y-4">
          {/* Campaign Selection */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Campaign</h3>
            {loadingCampaigns ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-500">Loading campaigns...</span>
              </div>
            ) : (
              <select
                value={selectedCampaignId}
                onChange={(e) => {
                  setSelectedCampaignId(e.target.value);
                  setSelectedAdsetId("");
                }}
                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 focus:border-cyan-500/50 focus:outline-none"
              >
                <option value="">Select campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Ad Set */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ad Set</h3>
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03]">
              <button
                onClick={() => setAdsetMode("existing")}
                className={cn(
                  "flex-1 text-[11px] py-1.5 rounded-md transition-all font-medium",
                  adsetMode === "existing"
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                Existing
              </button>
              <button
                onClick={() => setAdsetMode("new")}
                className={cn(
                  "flex-1 text-[11px] py-1.5 rounded-md transition-all font-medium",
                  adsetMode === "new"
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                Create New
              </button>
            </div>

            {adsetMode === "existing" ? (
              loadingAdsets ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  <span className="text-xs text-slate-500">Loading ad sets...</span>
                </div>
              ) : (
                <select
                  value={selectedAdsetId}
                  onChange={(e) => setSelectedAdsetId(e.target.value)}
                  className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="">Select ad set...</option>
                  {adsets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.status})
                    </option>
                  ))}
                </select>
              )
            ) : (
              <div className="space-y-2">
                <input
                  value={newAdsetName}
                  onChange={(e) => setNewAdsetName(e.target.value)}
                  placeholder="Ad set name"
                  className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Budget (SEK/day)</label>
                    <input
                      type="number"
                      value={newAdsetBudget}
                      onChange={(e) => setNewAdsetBudget(Number(e.target.value))}
                      className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-1.5 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Country</label>
                    <select
                      value={newAdsetCountry}
                      onChange={(e) => setNewAdsetCountry(e.target.value)}
                      className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-1.5 focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="SE">Sweden</option>
                      <option value="NO">Norway</option>
                      <option value="DK">Denmark</option>
                      <option value="FI">Finland</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Optimization</label>
                    <select
                      value={newAdsetOptGoal}
                      onChange={(e) => setNewAdsetOptGoal(e.target.value)}
                      className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-1.5 focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="OFFSITE_CONVERSIONS">Conversions</option>
                      <option value="LANDING_PAGE_VIEWS">Landing Page Views</option>
                      <option value="LINK_CLICKS">Link Clicks</option>
                      <option value="IMPRESSIONS">Impressions</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Bid Strategy</label>
                    <select
                      value={newAdsetBidStrategy}
                      onChange={(e) => setNewAdsetBidStrategy(e.target.value)}
                      className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-1.5 focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="LOWEST_COST_WITHOUT_CAP">Lowest Cost</option>
                      <option value="LOWEST_COST_WITH_BID_CAP">Bid Cap</option>
                      <option value="COST_CAP">Cost Cap</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ad Copy */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ad Copy</h3>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">Headline</label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Your headline"
                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">Primary Text</label>
              <textarea
                value={primaryText}
                onChange={(e) => setPrimaryText(e.target.value)}
                placeholder="Your ad text..."
                rows={3}
                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">Link URL</label>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://apotekhunden.se/..."
                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">CTA Button</label>
              <select
                value={ctaType}
                onChange={(e) => setCtaType(e.target.value)}
                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 focus:border-cyan-500/50 focus:outline-none"
              >
                <option value="SHOP_NOW">Shop Now</option>
                <option value="LEARN_MORE">Learn More</option>
                <option value="BUY_NOW">Buy Now</option>
                <option value="ORDER_NOW">Order Now</option>
                <option value="GET_OFFER">Get Offer</option>
                <option value="SIGN_UP">Sign Up</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Upload Queue ─── */}
      {jobs.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white">
              Upload Queue ({jobs.length})
            </h3>
            <div className="flex gap-2">
              {hasCompleted && (
                <button
                  onClick={clearCompleted}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear Done
                </button>
              )}
              {hasPending && (
                <button
                  onClick={processQueue}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {isUploading ? "Uploading..." : "Upload All"}
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 px-5 py-3">
                {job.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : job.status === "failed" ? (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                ) : job.status === "uploading_r2" || job.status === "uploading_meta" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-white/[0.1] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{job.filename}</p>
                  <p className="text-[10px] text-slate-500">
                    {job.status === "pending" && "Waiting..."}
                    {job.status === "uploading_r2" && "Uploading to Cloudflare R2..."}
                    {job.status === "uploading_meta" && "Uploading to Meta..."}
                    {job.status === "completed" && (
                      <span className="text-emerald-400">
                        Done! Ad ID: {job.result?.adId}
                      </span>
                    )}
                    {job.status === "failed" && (
                      <span className="text-red-400">{job.error}</span>
                    )}
                  </p>
                </div>
                {job.status === "pending" && (
                  <button
                    onClick={() => removeJob(job.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
