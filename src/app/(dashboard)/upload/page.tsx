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
  Plus,
  Minus,
  LayoutTemplate,
  Zap,
  History,
  ExternalLink,
  Clock,
  ChevronDown,
  AlertTriangle,
  Copy,
  Bug,
  ShieldAlert,
  Timer,
  WifiOff,
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

interface Template {
  id: number;
  name: string;
  isDefault: boolean;
  objective?: string;
  budgetType?: string;
  dailyBudget?: number;
  headlines?: string[];
  primaryTexts?: string[];
  descriptions?: string[];
  ctaType?: string;
  landingPages?: string[];
  targetCountries?: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  optimizationGoal?: string;
  conversionEvent?: string;
  bidStrategy?: string;
  productName?: string;
  angleName?: string;
  pixelId?: string;
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

interface ErrorDetails {
  message: string;
  failedStep: number;
  failedStepName: string;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
  httpStatus?: number;
  isAuthError?: boolean;
  isRateLimitError?: boolean;
  suggestion?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

interface UploadJob {
  id: string;
  filename: string;
  status: "pending" | "uploading_r2" | "uploading_meta" | "completed" | "failed";
  step: string;
  error?: string;
  errorDetails?: ErrorDetails;
  r2Key?: string;
  r2Url?: string;
  mediaType: "video" | "image";
  file?: File;
  result?: Record<string, string>;
  dbJobId?: number;
}

interface DbJob {
  id: number;
  filename: string;
  mediaType: string;
  status: string;
  totalSteps: number;
  currentStep: number;
  stepLabel: string;
  r2Key?: string;
  r2Url?: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  creativeId?: string;
  videoId?: string;
  imageHash?: string;
  config?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

const PREFS_KEY = "meta-upload-prefs";

const STEP_LABELS = [
  "Uploading media to Meta",
  "Creating ad creative",
  "Setting up ad set",
  "Creating ad",
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<"computer" | "cloudflare">("computer");

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Campaigns & Adsets
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<AdSetItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedAdsetId, setSelectedAdsetId] = useState("");
  const [adsetMode, setAdsetMode] = useState<"existing" | "new">("new");
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingAdsets, setLoadingAdsets] = useState(false);

  // New adset config
  const [newAdsetName, setNewAdsetName] = useState("");
  const [newAdsetBudget, setNewAdsetBudget] = useState(50);
  const [newAdsetCountry, setNewAdsetCountry] = useState("SE");
  const [newAdsetOptGoal, setNewAdsetOptGoal] = useState("OFFSITE_CONVERSIONS");
  const [newAdsetBidStrategy, setNewAdsetBidStrategy] = useState("LOWEST_COST_WITHOUT_CAP");
  const [newAdsetConvEvent, setNewAdsetConvEvent] = useState("PURCHASE");

  // Ad copy — arrays for multi-variant
  const [headlines, setHeadlines] = useState<string[]>(["", ""]);
  const [primaryTexts, setPrimaryTexts] = useState<string[]>(["", ""]);
  const [linkUrl, setLinkUrl] = useState("");
  const [ctaType, setCtaType] = useState("SHOP_NOW");

  // Upload queue
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Upload history
  const [history, setHistory] = useState<DbJob[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  // Error detail expansion
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [expandedHistoryErrors, setExpandedHistoryErrors] = useState<Set<number>>(new Set());

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Load saved preferences ─────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        const prefs = JSON.parse(saved);
        if (prefs.templateId) setSelectedTemplateId(prefs.templateId);
        if (prefs.campaignId) setSelectedCampaignId(prefs.campaignId);
      }
    } catch { /* ignore */ }
  }, []);

  const savePrefs = useCallback(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        templateId: selectedTemplateId,
        campaignId: selectedCampaignId,
      }));
    } catch { /* ignore */ }
  }, [selectedTemplateId, selectedCampaignId]);

  useEffect(() => { savePrefs(); }, [savePrefs]);

  // ─── Fetch templates + campaigns ────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [tplRes, campRes] = await Promise.all([
          fetch("/api/templates"),
          fetch("/api/meta/campaigns"),
        ]);
        if (tplRes.ok) {
          const tplData = await tplRes.json();
          const tpls: Template[] = tplData.data || tplData || [];
          setTemplates(tpls);
          const saved = localStorage.getItem(PREFS_KEY);
          const savedId = saved ? JSON.parse(saved).templateId : null;
          if (savedId && tpls.some((t) => t.id === savedId)) {
            // Will be set from saved prefs
          } else {
            const def = tpls.find((t) => t.isDefault);
            if (def) setSelectedTemplateId(def.id);
          }
        }
        if (campRes.ok) {
          const { data } = await campRes.json();
          setCampaigns(data || []);
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoadingTemplates(false);
        setLoadingCampaigns(false);
      }
    })();
  }, []);

  // ─── Apply template when selected ───────────────────────────────────────

  const applyTemplate = useCallback((tpl: Template) => {
    setHeadlines(
      tpl.headlines && tpl.headlines.length > 0
        ? [...tpl.headlines]
        : ["", ""]
    );
    setPrimaryTexts(
      tpl.primaryTexts && tpl.primaryTexts.length > 0
        ? [...tpl.primaryTexts]
        : ["", ""]
    );
    setLinkUrl(tpl.landingPages?.[0] || "");
    setCtaType(tpl.ctaType || "SHOP_NOW");
    setNewAdsetBudget(tpl.dailyBudget || 50);
    setNewAdsetCountry(tpl.targetCountries?.[0] || "SE");
    setNewAdsetOptGoal(tpl.optimizationGoal || "OFFSITE_CONVERSIONS");
    setNewAdsetBidStrategy(tpl.bidStrategy || "LOWEST_COST_WITHOUT_CAP");
    setNewAdsetConvEvent(tpl.conversionEvent || "PURCHASE");
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      if (tpl) applyTemplate(tpl);
    }
  }, [selectedTemplateId, templates, applyTemplate]);

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

  // ─── Poll for active job status ─────────────────────────────────────────

  useEffect(() => {
    const activeDbJobs = jobs.filter(
      (j) => j.dbJobId && (j.status === "uploading_meta" || j.status === "uploading_r2")
    );

    if (activeDbJobs.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (pollingRef.current) return; // already polling

    pollingRef.current = setInterval(async () => {
      for (const job of activeDbJobs) {
        if (!job.dbJobId) continue;
        try {
          const res = await fetch(`/api/upload-jobs?id=${job.dbJobId}`);
          if (!res.ok) continue;
          const dbJob: DbJob = await res.json();

          setJobs((prev) =>
            prev.map((j) => {
              if (j.id !== job.id) return j;
              if (dbJob.status === "completed") {
                return {
                  ...j,
                  status: "completed",
                  step: "Done!",
                  result: {
                    adId: dbJob.adId || "",
                    creativeId: dbJob.creativeId || "",
                    adsetId: dbJob.adsetId || "",
                    videoId: dbJob.videoId || "",
                  },
                };
              }
              if (dbJob.status === "failed") {
                return { ...j, status: "failed", step: "Failed", error: dbJob.error };
              }
              return {
                ...j,
                step: dbJob.stepLabel || `Step ${dbJob.currentStep}/${dbJob.totalSteps}`,
              };
            })
          );
        } catch { /* ignore polling errors */ }
      }
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobs]);

  // ─── Fetch upload history ───────────────────────────────────────────────

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/upload-jobs");
      if (res.ok) {
        const { data } = await res.json();
        setHistory(data || []);
      }
    } catch {
      toast.error("Failed to load upload history");
    } finally {
      setLoadingHistory(false);
    }
  };

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
    if (activeTab === "cloudflare") browseR2("");
  }, [activeTab, browseR2]);

  const navigateR2 = (prefix: string) => {
    setR2PathStack((prev) => [...prev, prefix]);
    setR2Selected([]);
    browseR2(prefix);
  };

  const goBackR2 = () => {
    setR2PathStack((prev) => {
      const next = prev.slice(0, -1);
      browseR2(next[next.length - 1] || "");
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

  // ─── List helpers ───────────────────────────────────────────────────────

  const updateListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    setter((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const addListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.length < 5 ? [...prev, ""] : prev));
  };

  const removeListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    setter((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  // ─── Upload to R2 via presigned URL ─────────────────────────────────────

  const uploadFileToR2 = async (file: File): Promise<{ key: string; url: string }> => {
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
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) throw new Error("Failed to upload to R2");
    return { key, url: publicUrl };
  };

  // ─── Build payload ──────────────────────────────────────────────────────

  const buildPayload = (r2Key: string, r2Url: string, filename: string, mediaType: "video" | "image", overrideAdsetId?: string) => {
    const filteredHeadlines = headlines.filter(Boolean);
    const filteredTexts = primaryTexts.filter(Boolean);

    const payload: Record<string, unknown> = {
      r2Key,
      r2Url,
      filename,
      mediaType,
      campaignId: selectedCampaignId,
      adCopy: {
        headlines: filteredHeadlines,
        primaryTexts: filteredTexts,
        linkUrl,
        ctaType,
      },
      adName: filename.replace(/\.[^.]+$/, ""),
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
        conversionEvent: newAdsetConvEvent,
      };
    }

    return payload;
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
    if (headlines.filter(Boolean).length === 0) {
      toast.error("Add at least one headline");
      return;
    }
    if (primaryTexts.filter(Boolean).length === 0) {
      toast.error("Add at least one primary text");
      return;
    }

    const newJobs: UploadJob[] = [];

    if (activeTab === "computer") {
      if (selectedFiles.length === 0) { toast.error("Select files"); return; }
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
      if (r2Selected.length === 0) { toast.error("Select files from R2"); return; }
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

  // Helper: create a DB job record immediately
  const createDbJob = async (filename: string, mediaType: string, campaignId: string): Promise<number | undefined> => {
    try {
      const res = await fetch("/api/upload-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, mediaType, campaignId }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.id;
      }
    } catch { /* best effort */ }
    return undefined;
  };

  // Helper: update a DB job record
  const updateDbJob = async (dbJobId: number, updates: Record<string, unknown>) => {
    try {
      await fetch("/api/upload-jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dbJobId, ...updates }),
      });
    } catch { /* best effort */ }
  };

  const processQueue = async () => {
    setIsUploading(true);
    const pending = jobs.filter((j) => j.status === "pending");
    let createdAdsetId: string | undefined;

    for (const job of pending) {
      let dbJobId: number | undefined;

      try {
        // Immediately create a DB record so it shows in Upload Log
        dbJobId = await createDbJob(job.filename, job.mediaType, selectedCampaignId);

        // Step 0: Upload to R2 if file is from computer
        if (job.file && !job.r2Key) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id ? { ...j, status: "uploading_r2", step: "Laddar upp till Cloudflare R2...", dbJobId } : j
            )
          );
          if (dbJobId) await updateDbJob(dbJobId, { status: "uploading_r2", stepLabel: "Laddar upp till R2..." });

          try {
            const { key, url } = await uploadFileToR2(job.file);
            job.r2Key = key;
            job.r2Url = url;
            if (dbJobId) await updateDbJob(dbJobId, { r2Key: key, r2Url: url });
          } catch (r2Error) {
            const errMsg = r2Error instanceof Error ? r2Error.message : "R2 upload failed";
            if (dbJobId) {
              await updateDbJob(dbJobId, {
                status: "failed",
                error: errMsg,
                stepLabel: "Misslyckades: R2-uppladdning",
                config: {
                  errorDetails: {
                    message: errMsg,
                    failedStep: 0,
                    failedStepName: "Ladda upp till R2",
                    suggestion: errMsg.includes("presign")
                      ? "Kunde inte hämta presigned URL. Kontrollera R2-konfigurationen i miljövariabler."
                      : "Uppladdning till Cloudflare R2 misslyckades. Kontrollera filstorlek och internetanslutning.",
                    timestamp: new Date().toISOString(),
                  },
                },
              });
            }
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id
                  ? {
                      ...j,
                      status: "failed" as const,
                      step: "Failed",
                      error: errMsg,
                      dbJobId,
                      errorDetails: {
                        message: errMsg,
                        failedStep: 0,
                        failedStepName: "Ladda upp till R2",
                        suggestion: "Uppladdning till Cloudflare R2 misslyckades. Kontrollera filstorlek och internetanslutning.",
                        timestamp: new Date().toISOString(),
                      },
                    }
                  : j
              )
            );
            continue;
          }
        } else if (dbJobId && job.r2Key) {
          // R2 file already exists, save the keys
          await updateDbJob(dbJobId, { r2Key: job.r2Key, r2Url: job.r2Url });
        }

        // Step 1-4: Upload to Meta (API handles steps with DB tracking)
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "uploading_meta", step: "Step 1/4: Laddar upp media till Meta...", dbJobId } : j
          )
        );

        const payload = buildPayload(
          job.r2Key!,
          job.r2Url!,
          job.filename,
          job.mediaType,
          createdAdsetId
        );

        // Pass the DB job ID so the API updates the same record
        if (dbJobId) {
          (payload as Record<string, unknown>).existingJobId = dbJobId;
        }

        const res = await fetch("/api/meta/upload-from-r2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await res.json();

        if (!res.ok) {
          const errDetails: ErrorDetails | undefined = result.errorDetails;
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? {
                    ...j,
                    status: "failed" as const,
                    step: "Failed",
                    error: result.error || "Meta upload failed",
                    errorDetails: errDetails,
                    dbJobId: dbJobId || result.jobId,
                  }
                : j
            )
          );
          continue;
        }

        if (result.adsetId && adsetMode === "new" && !createdAdsetId) {
          createdAdsetId = result.adsetId;
        }

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "completed",
                  step: "Done!",
                  dbJobId: dbJobId || result.jobId,
                  result: {
                    adId: result.adId,
                    creativeId: result.creativeId,
                    adsetId: result.adsetId,
                    videoId: result.videoId,
                    imageHash: result.imageHash,
                  },
                }
              : j
          )
        );
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        if (dbJobId) {
          await updateDbJob(dbJobId, {
            status: "failed",
            error: errMsg,
            stepLabel: "Oväntat fel",
            config: {
              errorDetails: {
                message: errMsg,
                failedStep: 0,
                failedStepName: "Okänt",
                suggestion: "Ett oväntat fel uppstod. Försök igen eller kontrollera webbläsarens konsol.",
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: "failed", step: "Failed", error: errMsg, dbJobId }
              : j
          )
        );
      }
    }

    setIsUploading(false);
    if (pending.length > 0) toast.success(`Bearbetade ${pending.length} fil(er)`);
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

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const toggleError = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleHistoryError = (id: number) => {
    setExpandedHistoryErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyError = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Felinfo kopierat!");
  };

  const hasPending = jobs.some((j) => j.status === "pending");
  const hasCompleted = jobs.some((j) => j.status === "completed" || j.status === "failed");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const isDynamic = headlines.filter(Boolean).length > 1 || primaryTexts.filter(Boolean).length > 1;

  // ─── Input class ────────────────────────────────────────────────────────
  const inputCls = "w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";
  const inputSmCls = "w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-1.5 focus:border-cyan-500/50 focus:outline-none";
  const labelCls = "text-[10px] text-slate-500 mb-0.5 block";

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Upload className="h-6 w-6 text-cyan-400" />
            Upload Ads
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Select template, pick files, upload to Meta
          </p>
        </div>
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) fetchHistory();
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
            showHistory
              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
              : "text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/[0.06]"
          )}
        >
          <History className="h-3.5 w-3.5" />
          Upload History
        </button>
      </div>

      {/* ─── Upload History ─── */}
      {showHistory && (
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-400" />
              Recent Uploads
            </h3>
            <button onClick={fetchHistory} className="text-slate-500 hover:text-white p-1 rounded hover:bg-white/5">
              <RefreshCw className={cn("h-3.5 w-3.5", loadingHistory && "animate-spin")} />
            </button>
          </div>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No upload history yet</div>
          ) : (
            <div className="divide-y divide-white/[0.03] max-h-[400px] overflow-y-auto">
              {history.map((h) => {
                const hExpanded = expandedHistoryErrors.has(h.id);
                const hConfig = h.config as Record<string, unknown> | null;
                const hEd = hConfig?.errorDetails as ErrorDetails | undefined;
                return (
                  <div key={h.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {h.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : h.status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-white truncate font-medium">{h.filename}</p>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-medium",
                            h.mediaType === "video"
                              ? "bg-cyan-500/10 text-cyan-400"
                              : "bg-purple-500/10 text-purple-400"
                          )}>
                            {h.mediaType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {h.status === "completed" && (
                            <>
                              <span className="text-[10px] text-emerald-400">Ad: {h.adId}</span>
                              {h.creativeId && <span className="text-[10px] text-slate-500">Creative: {h.creativeId}</span>}
                            </>
                          )}
                          {h.status === "failed" && (
                            <span className="text-[10px] text-red-400 truncate">{h.error}</span>
                          )}
                          {h.status !== "completed" && h.status !== "failed" && (
                            <span className="text-[10px] text-slate-500">
                              Step {h.currentStep}/{h.totalSteps}: {h.stepLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {h.status === "failed" && (
                          <button
                            onClick={() => toggleHistoryError(h.id)}
                            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-1.5 py-1 rounded bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all"
                          >
                            <Bug className="h-3 w-3" />
                            <ChevronDown className={cn("h-3 w-3 transition-transform", hExpanded && "rotate-180")} />
                          </button>
                        )}
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="h-3 w-3" />
                            {timeAgo(h.createdAt)}
                          </div>
                          {h.status === "completed" && h.adId && (
                            <a
                              href={`https://business.facebook.com/adsmanager/manage/ads?act=261297039993717&selected_ad_ids=${h.adId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 mt-0.5"
                            >
                              View in Meta <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded error details for history */}
                    {h.status === "failed" && hExpanded && (
                      <div className="mt-3 ml-7 rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2.5">
                        {hEd?.suggestion && (
                          <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[11px] font-medium text-amber-400 mb-0.5">Förslag</p>
                              <p className="text-[11px] text-amber-300/80 leading-relaxed">{hEd.suggestion}</p>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          {hEd?.failedStepName && (
                            <div className="p-2 rounded-md bg-white/[0.02]">
                              <p className="text-[9px] text-slate-500 mb-0.5">Steg</p>
                              <p className="text-[11px] text-red-400 font-medium">{hEd.failedStep}/4: {hEd.failedStepName}</p>
                            </div>
                          )}
                          {hEd?.metaErrorCode && (
                            <div className="p-2 rounded-md bg-white/[0.02]">
                              <p className="text-[9px] text-slate-500 mb-0.5">Meta felkod</p>
                              <p className="text-[11px] text-white font-mono">{hEd.metaErrorCode}{hEd.metaErrorSubcode ? ` / ${hEd.metaErrorSubcode}` : ""}</p>
                            </div>
                          )}
                          {hEd?.httpStatus && (
                            <div className="p-2 rounded-md bg-white/[0.02]">
                              <p className="text-[9px] text-slate-500 mb-0.5">HTTP</p>
                              <p className="text-[11px] text-white font-mono">{hEd.httpStatus}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 mb-1">Felmeddelande</p>
                          <div className="p-2 rounded-md bg-black/30 border border-white/[0.04]">
                            <p className="text-[11px] text-red-300 font-mono break-all leading-relaxed">{h.error}</p>
                          </div>
                        </div>
                        {hEd?.payload && (
                          <div>
                            <p className="text-[9px] text-slate-500 mb-1">Payload</p>
                            <div className="p-2 rounded-md bg-black/30 border border-white/[0.04] max-h-[120px] overflow-y-auto">
                              <pre className="text-[10px] text-slate-400 font-mono break-all whitespace-pre-wrap">
                                {JSON.stringify(hEd.payload, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() =>
                            copyError(
                              [
                                `File: ${h.filename}`,
                                `Error: ${h.error}`,
                                hEd?.failedStepName ? `Step: ${hEd.failedStep}/4 — ${hEd.failedStepName}` : "",
                                hEd?.metaErrorCode ? `Meta code: ${hEd.metaErrorCode}${hEd.metaErrorSubcode ? ` / ${hEd.metaErrorSubcode}` : ""}` : "",
                                hEd?.httpStatus ? `HTTP: ${hEd.httpStatus}` : "",
                                hEd?.suggestion ? `Suggestion: ${hEd.suggestion}` : "",
                                hEd?.payload ? `Payload: ${JSON.stringify(hEd.payload, null, 2)}` : "",
                              ]
                                .filter(Boolean)
                                .join("\n")
                            )
                          }
                          className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                          Kopiera all felinformation
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Template + Campaign Row ─── */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Template */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <LayoutTemplate className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Template</h3>
            {isDynamic && (
              <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Dynamic Creative
              </span>
            )}
          </div>
          {loadingTemplates ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span className="text-xs text-slate-500">Loading...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedTemplateId || ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setSelectedTemplateId(id);
                }}
                className={inputCls}
              >
                <option value="">No template (manual)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isDefault ? "(Default)" : ""}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.targetCountries?.map((c) => (
                    <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] text-slate-400">{c}</span>
                  ))}
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] text-slate-400">
                    {selectedTemplate.dailyBudget || 50} SEK/day
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] text-slate-400">
                    {selectedTemplate.ctaType || "SHOP_NOW"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Campaign */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Zap className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Campaign</h3>
          </div>
          {loadingCampaigns ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span className="text-xs text-slate-500">Loading...</span>
            </div>
          ) : (
            <select
              value={selectedCampaignId}
              onChange={(e) => {
                setSelectedCampaignId(e.target.value);
                setSelectedAdsetId("");
              }}
              className={inputCls}
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
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr,400px]">
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
                  <p className="text-sm font-medium text-white mb-1">Drag & drop files here</p>
                  <p className="text-xs text-slate-500 mb-4">MP4, MOV, WebM, JPG, PNG (max 500MB)</p>
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

              {selectedFiles.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#111827] divide-y divide-white/[0.04]">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">{selectedFiles.length} file(s)</span>
                    <button onClick={() => setSelectedFiles([])} className="text-[10px] text-slate-500 hover:text-red-400">Clear all</button>
                  </div>
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2">
                      {file.type.startsWith("video/")
                        ? <FileVideo className="h-4 w-4 text-cyan-400 shrink-0" />
                        : <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{formatSize(file.size)}</p>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-slate-600 hover:text-red-400">
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
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
                {r2PathStack.length > 1 && (
                  <button onClick={goBackR2} className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <Cloud className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-slate-400 truncate">{r2Prefix || "/ (root)"}</span>
                <button onClick={() => browseR2(r2Prefix)} className="ml-auto p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white">
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
                          isSelected ? "bg-orange-500/5 border-l-2 border-orange-400" : "hover:bg-white/[0.02]"
                        )}
                      >
                        {file.mediaType === "video"
                          ? <FileVideo className="h-4 w-4 text-cyan-400 shrink-0" />
                          : <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                        }
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
                  <span className="text-xs font-medium text-orange-400">{r2Selected.length} file(s) selected</span>
                  <button onClick={() => setR2Selected([])} className="text-[10px] text-slate-500 hover:text-red-400">Clear</button>
                </div>
              )}
            </div>
          )}

          {/* Add to Queue */}
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
          {/* Ad Set */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ad Set</h3>
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03]">
              {(["existing", "new"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAdsetMode(mode)}
                  className={cn(
                    "flex-1 text-[11px] py-1.5 rounded-md transition-all font-medium capitalize",
                    adsetMode === mode ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {mode === "existing" ? "Existing" : "Create New"}
                </button>
              ))}
            </div>

            {adsetMode === "existing" ? (
              loadingAdsets ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  <span className="text-xs text-slate-500">Loading...</span>
                </div>
              ) : (
                <select
                  value={selectedAdsetId}
                  onChange={(e) => setSelectedAdsetId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select ad set...</option>
                  {adsets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                  ))}
                </select>
              )
            ) : (
              <div className="space-y-2">
                <input value={newAdsetName} onChange={(e) => setNewAdsetName(e.target.value)} placeholder="Ad set name (auto if empty)" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Budget (SEK/day)</label>
                    <input type="number" value={newAdsetBudget} onChange={(e) => setNewAdsetBudget(Number(e.target.value))} className={inputSmCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Country</label>
                    <select value={newAdsetCountry} onChange={(e) => setNewAdsetCountry(e.target.value)} className={inputSmCls}>
                      <option value="SE">Sweden</option>
                      <option value="NO">Norway</option>
                      <option value="DK">Denmark</option>
                      <option value="FI">Finland</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Optimization</label>
                    <select value={newAdsetOptGoal} onChange={(e) => setNewAdsetOptGoal(e.target.value)} className={inputSmCls}>
                      <option value="OFFSITE_CONVERSIONS">Conversions</option>
                      <option value="LANDING_PAGE_VIEWS">Landing Page Views</option>
                      <option value="LINK_CLICKS">Link Clicks</option>
                      <option value="IMPRESSIONS">Impressions</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Bid Strategy</label>
                    <select value={newAdsetBidStrategy} onChange={(e) => setNewAdsetBidStrategy(e.target.value)} className={inputSmCls}>
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

            {/* Headlines */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Headlines ({headlines.filter(Boolean).length})</label>
                {headlines.length < 5 && (
                  <button onClick={() => addListItem(setHeadlines)} className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
                    <Plus className="h-3 w-3" /> Add
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {headlines.map((h, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input
                      value={h}
                      onChange={(e) => updateListItem(setHeadlines, i, e.target.value)}
                      placeholder={`Headline ${i + 1}`}
                      className={inputCls + " flex-1"}
                    />
                    {headlines.length > 1 && (
                      <button
                        onClick={() => removeListItem(setHeadlines, i)}
                        className="px-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Primary Texts */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Primary Texts ({primaryTexts.filter(Boolean).length})</label>
                {primaryTexts.length < 5 && (
                  <button onClick={() => addListItem(setPrimaryTexts)} className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
                    <Plus className="h-3 w-3" /> Add
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {primaryTexts.map((t, i) => (
                  <div key={i} className="flex gap-1.5">
                    <textarea
                      value={t}
                      onChange={(e) => updateListItem(setPrimaryTexts, i, e.target.value)}
                      placeholder={`Primary text ${i + 1}`}
                      rows={2}
                      className={inputCls + " flex-1 resize-none"}
                    />
                    {primaryTexts.length > 1 && (
                      <button
                        onClick={() => removeListItem(setPrimaryTexts, i)}
                        className="px-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-colors self-start mt-2"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Link + CTA */}
            <div>
              <label className={labelCls}>Link URL</label>
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://apotekhunden.se/..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CTA Button</label>
              <select value={ctaType} onChange={(e) => setCtaType(e.target.value)} className={inputCls}>
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
            <h3 className="text-sm font-semibold text-white">Upload Queue ({jobs.length})</h3>
            <div className="flex gap-2">
              {hasCompleted && (
                <button onClick={clearCompleted} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-all">
                  <Trash2 className="h-3 w-3" /> Clear Done
                </button>
              )}
              {hasPending && (
                <button
                  onClick={processQueue}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {isUploading ? "Uploading..." : "Upload All"}
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {jobs.map((job) => {
              const isExpanded = expandedErrors.has(job.id);
              const ed = job.errorDetails;
              return (
                <div key={job.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
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
                      <p className="text-xs text-white truncate font-medium">{job.filename}</p>
                      <p className="text-[10px] text-slate-500">
                        {job.status === "pending" && "Waiting..."}
                        {job.status === "uploading_r2" && "Uploading to Cloudflare R2..."}
                        {job.status === "uploading_meta" && job.step}
                        {job.status === "completed" && (
                          <span className="text-emerald-400">
                            Done! Ad ID: {job.result?.adId}
                            {job.result?.adId && (
                              <a
                                href={`https://business.facebook.com/adsmanager/manage/ads?act=261297039993717&selected_ad_ids=${job.result.adId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300"
                              >
                                View <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </span>
                        )}
                        {job.status === "failed" && (
                          <span className="text-red-400">{job.error}</span>
                        )}
                      </p>
                    </div>
                    {job.status === "pending" && (
                      <button onClick={() => removeJob(job.id)} className="text-slate-600 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {job.status === "failed" && (
                      <button
                        onClick={() => toggleError(job.id)}
                        className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded-md bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all"
                      >
                        <Bug className="h-3 w-3" />
                        Detaljer
                        <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                    )}
                  </div>

                  {/* Progress bar for active uploads */}
                  {(job.status === "uploading_r2" || job.status === "uploading_meta") && (
                    <div className="mt-2 ml-7">
                      <div className="flex gap-1">
                        {STEP_LABELS.map((label, i) => {
                          const stepNum = i + 1;
                          const currentStepMatch = job.step.match(/Step (\d+)/);
                          const currentStep = currentStepMatch ? parseInt(currentStepMatch[1]) : (job.status === "uploading_r2" ? 0 : 1);
                          const isActive = stepNum === currentStep;
                          const isDone = stepNum < currentStep;
                          return (
                            <div key={i} className="flex-1">
                              <div
                                className={cn(
                                  "h-1 rounded-full transition-all",
                                  isDone ? "bg-emerald-400" : isActive ? "bg-cyan-400 animate-pulse" : "bg-white/[0.06]"
                                )}
                              />
                              <p className={cn(
                                "text-[9px] mt-0.5 truncate",
                                isDone ? "text-emerald-400/60" : isActive ? "text-cyan-400" : "text-slate-600"
                              )}>
                                {label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expandable error details */}
                  {job.status === "failed" && isExpanded && (
                    <div className="mt-3 ml-7 rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2.5">
                      {/* Suggestion banner */}
                      {ed?.suggestion && (
                        <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-medium text-amber-400 mb-0.5">Förslag</p>
                            <p className="text-[11px] text-amber-300/80 leading-relaxed">{ed.suggestion}</p>
                          </div>
                        </div>
                      )}

                      {/* Error info grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {ed?.failedStepName && (
                          <div className="p-2 rounded-md bg-white/[0.02]">
                            <p className="text-[9px] text-slate-500 mb-0.5">Steg som misslyckades</p>
                            <p className="text-[11px] text-red-400 font-medium">
                              {ed.failedStep}/4: {ed.failedStepName}
                            </p>
                          </div>
                        )}
                        {ed?.metaErrorCode && (
                          <div className="p-2 rounded-md bg-white/[0.02]">
                            <p className="text-[9px] text-slate-500 mb-0.5">Meta felkod</p>
                            <p className="text-[11px] text-white font-mono">
                              {ed.metaErrorCode}
                              {ed.metaErrorSubcode ? ` / ${ed.metaErrorSubcode}` : ""}
                            </p>
                          </div>
                        )}
                        {ed?.httpStatus && (
                          <div className="p-2 rounded-md bg-white/[0.02]">
                            <p className="text-[9px] text-slate-500 mb-0.5">HTTP Status</p>
                            <p className="text-[11px] text-white font-mono">{ed.httpStatus}</p>
                          </div>
                        )}
                        {ed?.isAuthError && (
                          <div className="p-2 rounded-md bg-white/[0.02] flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                            <p className="text-[11px] text-red-400 font-medium">Auth-fel</p>
                          </div>
                        )}
                        {ed?.isRateLimitError && (
                          <div className="p-2 rounded-md bg-white/[0.02] flex items-center gap-1.5">
                            <Timer className="h-3.5 w-3.5 text-amber-400" />
                            <p className="text-[11px] text-amber-400 font-medium">Rate limit</p>
                          </div>
                        )}
                      </div>

                      {/* Full error message */}
                      <div>
                        <p className="text-[9px] text-slate-500 mb-1">Felmeddelande</p>
                        <div className="p-2 rounded-md bg-black/30 border border-white/[0.04]">
                          <p className="text-[11px] text-red-300 font-mono break-all leading-relaxed">{job.error}</p>
                        </div>
                      </div>

                      {/* Payload that was sent */}
                      {ed?.payload && (
                        <div>
                          <p className="text-[9px] text-slate-500 mb-1">Data som skickades till Meta</p>
                          <div className="p-2 rounded-md bg-black/30 border border-white/[0.04] max-h-[150px] overflow-y-auto">
                            <pre className="text-[10px] text-slate-400 font-mono break-all whitespace-pre-wrap">
                              {JSON.stringify(ed.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Copy all error info */}
                      <button
                        onClick={() =>
                          copyError(
                            [
                              `File: ${job.filename}`,
                              `Error: ${job.error}`,
                              ed?.failedStepName ? `Failed step: ${ed.failedStep}/4 — ${ed.failedStepName}` : "",
                              ed?.metaErrorCode ? `Meta error code: ${ed.metaErrorCode}${ed.metaErrorSubcode ? ` / ${ed.metaErrorSubcode}` : ""}` : "",
                              ed?.httpStatus ? `HTTP: ${ed.httpStatus}` : "",
                              ed?.suggestion ? `Suggestion: ${ed.suggestion}` : "",
                              ed?.payload ? `Payload: ${JSON.stringify(ed.payload, null, 2)}` : "",
                            ]
                              .filter(Boolean)
                              .join("\n")
                          )
                        }
                        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        Kopiera all felinformation
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
