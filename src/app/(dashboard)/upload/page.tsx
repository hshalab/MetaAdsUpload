"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KNOWN_PIXELS, pixelLabel } from "@/lib/meta/pixels";
import { countriesForSelection, selectionForCountries } from "@/lib/meta/geo";
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
  Globe,
  Crosshair,
  Pencil,
  Video,
  Lightbulb,
} from "lucide-react";
import { MemberQuickAdd } from "@/components/editors/member-quick-add";
import { OptionPicker } from "@/components/editors/option-picker";

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

interface MetaPage {
  id: string;
  name: string;
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

interface LandingPage {
  url: string;
  label: string; // e.g. "LP7", "LP11"
}

interface PlacementVariant {
  id: string;
  file?: File;
  r2Key?: string;
  r2Url?: string;
  filename: string;
  aspectRatio: string;
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
  linkUrl?: string;       // Per-job landing page URL (for multi-LP duplication)
  lpLabel?: string;       // Per-job LP label for naming
  adName?: string;        // Custom ad name override (from LP matrix)
  variants?: PlacementVariant[];
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function detectAspectRatio(w: number, h: number): string {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  if (Math.abs(ratio - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(ratio - 4 / 5) < 0.05) return "4:5";
  if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9";
  if (ratio < 1) return `${w}:${h}`;
  return `${w}:${h}`;
}

/** Try to extract an LP label from a URL, e.g. "/lp7" → "LP7", "/products/reluma" → null */
function extractLpLabel(url: string): string | null {
  const match = url.match(/\/lp(\d+)/i);
  return match ? `LP${match[1]}` : null;
}

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

  // Pages & Pixel
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [loadingConnection, setLoadingConnection] = useState(true);

  // Team attribution — who made this creative (for bonus + stats tracking)
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email?: string; userType?: string }>>([]);
  const [videoEditorId, setVideoEditorId] = useState("");
  const [creativeStrategistId, setCreativeStrategistId] = useState("");
  const [adAngle, setAdAngle] = useState("");
  const [adProblem, setAdProblem] = useState("");

  // New adset config
  const [newAdsetName, setNewAdsetName] = useState("");
  const [newAdsetBudget, setNewAdsetBudget] = useState(50);
  const [newAdsetCountry, setNewAdsetCountry] = useState("SE");
  const [newAdsetOptGoal, setNewAdsetOptGoal] = useState("OFFSITE_CONVERSIONS");
  const [newAdsetBidStrategy, setNewAdsetBidStrategy] = useState("LOWEST_COST_WITHOUT_CAP");
  const [newAdsetConvEvent, setNewAdsetConvEvent] = useState("PURCHASE");
  const [scheduleForTomorrow, setScheduleForTomorrow] = useState(false);

  // Ad copy — arrays for multi-variant
  const [headlines, setHeadlines] = useState<string[]>(["", ""]);
  const [primaryTexts, setPrimaryTexts] = useState<string[]>(["", ""]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([{ url: "", label: "LP1" }, { url: "", label: "LP2" }]);
  const [ctaType, setCtaType] = useState("SHOP_NOW");

  // Landing page × file assignment matrix (key: "fileIdx-lpIdx", true = assigned)
  const [lpMatrix, setLpMatrix] = useState<Record<string, boolean>>({});
  // Per-cell ad name overrides (key: "fileIdx-lpIdx", value = custom name)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});

  // Upload queue
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [shouldAutoStart, setShouldAutoStart] = useState(false);

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

  // Placement variants
  const [variantsByFile, setVariantsByFile] = useState<Record<number, PlacementVariant[]>>({});
  const [fileDimensions, setFileDimensions] = useState<Record<number, { w: number; h: number; ratio: string }>>({});
  const variantInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(null);

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
        if (prefs.pageId) setSelectedPageId(prefs.pageId);
        if (prefs.pixelId) setPixelId(prefs.pixelId);
        if (prefs.videoEditorId) setVideoEditorId(prefs.videoEditorId);
        if (prefs.creativeStrategistId) setCreativeStrategistId(prefs.creativeStrategistId);
        if (prefs.adAngle) setAdAngle(prefs.adAngle);
        if (prefs.adProblem) setAdProblem(prefs.adProblem);
      }
    } catch { /* ignore */ }
  }, []);

  const savePrefs = useCallback(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        templateId: selectedTemplateId,
        campaignId: selectedCampaignId,
        pageId: selectedPageId,
        pixelId,
        videoEditorId,
        creativeStrategistId,
        adAngle,
        adProblem,
      }));
    } catch { /* ignore */ }
  }, [selectedTemplateId, selectedCampaignId, selectedPageId, pixelId, videoEditorId, creativeStrategistId, adAngle, adProblem]);

  useEffect(() => { savePrefs(); }, [savePrefs]);

  // ─── Load team members for attribution ──────────────────────────────────

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      const { users } = await res.json();
      const list = (users || [])
        .filter((u: { isActive?: boolean }) => u.isActive !== false)
        .map((u: { id: string; name: string; email?: string; userType?: string }) => ({ id: u.id, name: u.name, email: u.email, userType: u.userType }));
      setTeamMembers(list);
      return list as Array<{ id: string; name: string; email?: string; userType?: string }>;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ─── Fetch templates + campaigns ────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [tplRes, campRes, connRes] = await Promise.all([
          fetch("/api/templates"),
          fetch("/api/meta/campaigns"),
          fetch("/api/meta/connection"),
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
        if (connRes.ok) {
          const connData = await connRes.json();
          const active = connData.active;
          const activeConn = connData.connections?.find((c: { isActive: boolean }) => c.isActive);
          if (activeConn?.pages) setPages(activeConn.pages);
          // Set defaults from connection if no saved prefs
          const saved = localStorage.getItem(PREFS_KEY);
          const prefs = saved ? JSON.parse(saved) : {};
          if (!prefs.pageId && active?.activePageId) setSelectedPageId(active.activePageId);
          if (!prefs.pixelId && active?.pixelId) setPixelId(active.pixelId);
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoadingTemplates(false);
        setLoadingCampaigns(false);
        setLoadingConnection(false);
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
    if (tpl.landingPages && tpl.landingPages.length > 0) {
      const lps = tpl.landingPages.map((url, i) => ({
        url,
        label: extractLpLabel(url) || `LP${i + 1}`,
      }));
      // Always have at least 2 rows so the user can easily add a second LP
      if (lps.length < 2) lps.push({ url: "", label: `LP${lps.length + 1}` });
      setLandingPages(lps);
    } else {
      setLandingPages([{ url: "", label: "LP1" }, { url: "", label: "LP2" }]);
    }
    setCtaType(tpl.ctaType || "SHOP_NOW");
    setNewAdsetBudget(tpl.dailyBudget || 50);
    setNewAdsetCountry(selectionForCountries(tpl.targetCountries));
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

  // ─── Prefill an assignment deliverable (?assignment=<id>) ───
  // "Send to Uploader" on an assignment lands here: the editor's video is
  // already in R2, so it's preselected as a cloud file — no re-upload, and
  // Meta later pulls it straight from the R2 URL.
  useEffect(() => {
    const assignmentId = new URLSearchParams(window.location.search).get("assignment");
    if (!assignmentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/assignments/${assignmentId}`);
        if (!res.ok) throw new Error("Could not load the assignment");
        const a = await res.json();

        // All uploaded deliverable files (one versions row per file)
        let files: Array<{ key: string; url: string; name: string }> = [];
        try {
          const vRes = await fetch(`/api/assignments/${assignmentId}/versions`);
          if (vRes.ok) {
            const versions: Array<{ r2Key: string; r2Url: string; filename: string }> = await vRes.json();
            const seen = new Set<string>();
            for (const v of versions) {
              if (v.r2Key && !seen.has(v.r2Key)) {
                seen.add(v.r2Key);
                files.push({ key: v.r2Key, url: v.r2Url, name: v.filename });
              }
            }
          }
        } catch { /* fall back to the single latest deliverable below */ }
        if (files.length === 0 && a.deliverableUrl && a.deliverableR2Key) {
          files = [{
            key: a.deliverableR2Key,
            url: a.deliverableUrl,
            name: a.deliverableR2Key.split("/").pop() || "deliverable.mp4",
          }];
        }
        if (files.length === 0) {
          toast.error("The assignment has no uploaded deliverable yet");
          return;
        }

        setActiveTab("cloudflare");
        setR2Selected(files.map((f) => ({
          key: f.key,
          name: f.name,
          size: 0,
          url: f.url,
          type: "file" as const,
          mediaType: (/\.(jpg|jpeg|png|webp)$/i.test(f.name) ? "image" : "video") as "video" | "image",
        })));
        toast.success(
          `${files.length} file${files.length !== 1 ? "s" : ""} from "${a.autoName || a.title}" loaded — pick a template and campaign`
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load the deliverable");
      }
    })();
  }, []);

  // Auto-start queue processing when new jobs are added
  useEffect(() => {
    if (shouldAutoStart && !isUploading && jobs.some((j) => j.status === "pending")) {
      setShouldAutoStart(false);
      processQueue();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStart, isUploading, jobs]);

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
    setLpMatrix({}); // Reset matrix when files change
    setNameOverrides({});
    // Clean up variants and dimensions for removed file, reindex remaining
    setVariantsByFile((prev) => {
      const next: Record<number, PlacementVariant[]> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
    setFileDimensions((prev) => {
      const next: Record<number, { w: number; h: number; ratio: string }> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  };

  // Auto-detect image dimensions when files change
  useEffect(() => {
    selectedFiles.forEach((file, i) => {
      if (fileDimensions[i] || !file.type.startsWith("image/")) return;
      getImageDimensions(file).then(({ width, height }) => {
        setFileDimensions((prev) => ({
          ...prev,
          [i]: { w: width, h: height, ratio: detectAspectRatio(width, height) },
        }));
      }).catch(() => { /* ignore */ });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]);

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

  // ─── Variant handling ───────────────────────────────────────────────────

  const addVariantToFile = async (fileIndex: number, file: File) => {
    let aspectRatio = "?";
    if (file.type.startsWith("image/")) {
      try {
        const { width, height } = await getImageDimensions(file);
        aspectRatio = detectAspectRatio(width, height);
      } catch { /* ignore */ }
    }
    const variant: PlacementVariant = {
      id: crypto.randomUUID(),
      file,
      filename: file.name,
      aspectRatio,
    };
    setVariantsByFile((prev) => ({
      ...prev,
      [fileIndex]: [...(prev[fileIndex] || []), variant],
    }));
  };

  const removeVariant = (fileIndex: number, variantId: string) => {
    setVariantsByFile((prev) => ({
      ...prev,
      [fileIndex]: (prev[fileIndex] || []).filter((v) => v.id !== variantId),
    }));
  };

  // ─── Upload to R2 (presigned URL for large files, proxy fallback for small) ─

  const PROXY_SIZE_LIMIT = 200 * 1024 * 1024; // 200MB — server proxy limit

  const uploadViaPresignedUrl = async (file: File): Promise<{ key: string; url: string }> => {
    // Step 1: Get presigned URL from server
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

    const presignData = await presignRes.json();
    if (!presignRes.ok) {
      throw new Error(presignData.error || "Could not get a presigned URL");
    }

    const { uploadUrl, publicUrl, key } = presignData;

    // Step 2: PUT file directly to R2 via presigned URL
    let putRes: Response;
    try {
      putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
    } catch (fetchErr) {
      console.error("R2 PUT fetch error:", fetchErr, "URL:", uploadUrl?.substring(0, 100));
      throw new Error(`R2 PUT network error: ${fetchErr instanceof Error ? fetchErr.message : "Unknown"}`);
    }

    if (!putRes.ok) {
      const errBody = await putRes.text().catch(() => "");
      console.error("R2 PUT error response:", putRes.status, errBody);
      throw new Error(`R2 PUT misslyckades: ${putRes.status} ${putRes.statusText} — ${errBody.substring(0, 200)}`);
    }

    return { key, url: publicUrl };
  };

  const uploadViaProxy = async (file: File): Promise<{ key: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload/direct", {
      method: "POST",
      body: formData,
    });

    const uploadData = await res.json();
    if (!res.ok) {
      throw new Error(uploadData.error || "Kunde inte ladda upp till R2");
    }

    const { key, publicUrl } = uploadData;
    return { key, url: publicUrl };
  };

  const uploadFileToR2 = async (file: File): Promise<{ key: string; url: string }> => {
    // Try presigned URL first, fall back to server proxy
    try {
      return await uploadViaPresignedUrl(file);
    } catch (presignErr) {
      console.warn("Presigned URL upload failed, falling back to proxy:", presignErr);
      if (file.size > PROXY_SIZE_LIMIT) {
        throw new Error(`Upload failed (${(file.size / 1024 / 1024).toFixed(0)}MB). Configure CORS on the R2 bucket or reduce the file size.`);
      }
      return uploadViaProxy(file);
    }
  };

  // ─── Build payload ──────────────────────────────────────────────────────

  const buildPayload = (r2Key: string, r2Url: string, filename: string, mediaType: "video" | "image", overrideAdsetId?: string, jobLinkUrl?: string, jobAdName?: string, variantR2Data?: Array<{ r2Key: string; r2Url: string; filename: string }>) => {
    const filteredHeadlines = headlines.filter(Boolean);
    const filteredTexts = primaryTexts.filter(Boolean);
    const resolvedLinkUrl = jobLinkUrl || landingPages[0]?.url || "";

    const payload: Record<string, unknown> = {
      r2Key,
      r2Url,
      filename,
      mediaType,
      campaignId: selectedCampaignId,
      adCopy: {
        headlines: filteredHeadlines,
        primaryTexts: filteredTexts,
        linkUrl: resolvedLinkUrl,
        ctaType,
      },
      adName: jobAdName || filename.replace(/\.[^.]+$/, ""),
    };

    // Pass page/pixel overrides if selected
    if (selectedPageId) payload.pageId = selectedPageId;
    if (pixelId) payload.pixelId = pixelId;

    // Placement variants
    if (variantR2Data && variantR2Data.length > 0) {
      payload.variants = variantR2Data;
    }

    if (overrideAdsetId) {
      payload.adsetId = overrideAdsetId;
    } else if (adsetMode === "existing" && selectedAdsetId) {
      payload.adsetId = selectedAdsetId;
    } else if (adsetMode === "new") {
      payload.adsetConfig = {
        name: newAdsetName || `AdSet ${new Date().toLocaleDateString("sv")}`,
        dailyBudget: newAdsetBudget,
        targeting: { geo_locations: { countries: countriesForSelection(newAdsetCountry) } },
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
    const activeLPs = landingPages.filter((lp) => lp.url);
    if (activeLPs.length === 0) {
      toast.error("Add at least one landing page");
      return;
    }

    // Gather source files
    type SourceFile = { filename: string; mediaType: "video" | "image"; file?: File; r2Key?: string; r2Url?: string };
    const sourceFiles: SourceFile[] = [];

    if (activeTab === "computer") {
      if (selectedFiles.length === 0) { toast.error("Select files"); return; }
      for (const file of selectedFiles) {
        sourceFiles.push({
          filename: file.name,
          mediaType: file.type.startsWith("video/") ? "video" : "image",
          file,
        });
      }
    } else {
      if (r2Selected.length === 0) { toast.error("Select files from R2"); return; }
      for (const f of r2Selected) {
        sourceFiles.push({
          filename: f.name,
          mediaType: f.mediaType,
          r2Key: f.key,
          r2Url: f.url,
        });
      }
    }

    const newJobs: UploadJob[] = [];
    const multiLP = activeLPs.length > 1;

    for (let fi = 0; fi < sourceFiles.length; fi++) {
      const src = sourceFiles[fi];
      for (let li = 0; li < activeLPs.length; li++) {
        const lp = activeLPs[li];
        const matrixKey = `${fi}-${li}`;
        // Check matrix — if multi-LP, only include assigned combinations
        if (multiLP) {
          if (lpMatrix[matrixKey] === false) continue; // explicitly unchecked
        }
        // Use custom name if set, otherwise auto-generate
        const customName = multiLP ? nameOverrides[matrixKey] : undefined;
        // Attach placement variants for image files (computer tab only)
        const fileVariants = activeTab === "computer" ? variantsByFile[fi] : undefined;
        newJobs.push({
          id: crypto.randomUUID(),
          filename: src.filename,
          status: "pending",
          step: "Waiting...",
          mediaType: src.mediaType,
          file: src.file,
          r2Key: src.r2Key,
          r2Url: src.r2Url,
          linkUrl: lp.url,
          lpLabel: multiLP ? lp.label : undefined,
          adName: customName || undefined,
          variants: fileVariants && fileVariants.length > 0 ? fileVariants : undefined,
        });
      }
    }

    if (activeTab === "computer") {
      setSelectedFiles([]);
      setVariantsByFile({});
      setFileDimensions({});
    } else {
      setR2Selected([]);
    }

    setJobs((prev) => [...prev, ...newJobs]);
    toast.success(`${newJobs.length} ad(s) added to the queue`);
    setShouldAutoStart(true);
  };

  // Helper: create a DB job record immediately
  const createDbJob = async (filename: string, mediaType: string, campaignId: string, config?: Record<string, unknown>): Promise<number | undefined> => {
    try {
      const res = await fetch("/api/upload-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, mediaType, campaignId, config }),
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

  const PARALLEL_UPLOADS = 3;

  const processSingleJob = async (job: UploadJob, overrideAdsetId?: string): Promise<{ adsetId?: string }> => {
    let dbJobId: number | undefined;

    // Build config upfront so it's saved to DB (needed for retry on step 0 failures)
    const filteredHL = headlines.filter(Boolean);
    const filteredPT = primaryTexts.filter(Boolean);
    const resolvedLink = job.linkUrl || landingPages[0]?.url || "";
    const resolvedAdName = job.adName
      || (job.lpLabel ? `${job.filename.replace(/\.[^.]+$/, "")} - ${job.lpLabel}` : job.filename.replace(/\.[^.]+$/, ""));
    const jobConfig: Record<string, unknown> = {
      adCopy: {
        headlines: filteredHL,
        primaryTexts: filteredPT,
        linkUrl: resolvedLink,
        ctaType,
      },
      adName: resolvedAdName,
    };
    if (overrideAdsetId) {
      jobConfig.adsetId = overrideAdsetId;
    } else if (adsetMode === "existing" && selectedAdsetId) {
      jobConfig.adsetId = selectedAdsetId;
    } else if (adsetMode === "new") {
      const adsetConfig: Record<string, unknown> = {
        name: newAdsetName || `AdSet ${new Date().toLocaleDateString("sv")}`,
        dailyBudget: newAdsetBudget,
        targeting: { geo_locations: { countries: countriesForSelection(newAdsetCountry) } },
        optimizationGoal: newAdsetOptGoal,
        bidStrategy: newAdsetBidStrategy,
        conversionEvent: newAdsetConvEvent,
      };
      if (scheduleForTomorrow) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0);
        adsetConfig.startTime = tomorrow.toISOString();
      }
      jobConfig.adsetConfig = adsetConfig;
    }
    if (selectedPageId) jobConfig.pageId = selectedPageId;
    if (pixelId) jobConfig.pixelId = pixelId;

    try {
      dbJobId = await createDbJob(job.filename, job.mediaType, selectedCampaignId, jobConfig);

      // Step 0: Upload to R2 if file is from computer
      if (job.file && !job.r2Key) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "uploading_r2", step: "Uploading to Cloudflare R2...", dbJobId } : j
          )
        );
        if (dbJobId) await updateDbJob(dbJobId, { status: "uploading_r2", stepLabel: "Uploading to R2..." });

        try {
          const { key, url } = await uploadFileToR2(job.file);
          job.r2Key = key;
          job.r2Url = url;
          if (dbJobId) await updateDbJob(dbJobId, { r2Key: key, r2Url: url });
        } catch (r2Error) {
          const errMsg = r2Error instanceof Error ? r2Error.message : "R2 upload failed";
          console.error("R2 upload failed:", errMsg, r2Error);
          toast.error(`R2-fel: ${errMsg}`);
          if (dbJobId) {
            await updateDbJob(dbJobId, {
              status: "failed",
              error: errMsg,
              stepLabel: "Misslyckades: R2-uppladdning",
              config: {
                ...jobConfig,
                errorDetails: {
                  message: errMsg,
                  failedStep: 0,
                  failedStepName: "Ladda upp till R2",
                  suggestion: errMsg.includes("presign")
                    ? "Could not get a presigned URL. Check the R2 configuration in the environment variables."
                    : `R2-uppladdning misslyckades: ${errMsg}`,
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
          return {};
        }
      } else if (dbJobId && job.r2Key) {
        await updateDbJob(dbJobId, { r2Key: job.r2Key, r2Url: job.r2Url });
      }

      // Upload placement variants to R2 (if any)
      const variantR2Data: Array<{ r2Key: string; r2Url: string; filename: string }> = [];
      if (job.variants && job.variants.length > 0) {
        for (const variant of job.variants) {
          if (variant.file && !variant.r2Key) {
            try {
              const { key, url } = await uploadFileToR2(variant.file);
              variant.r2Key = key;
              variant.r2Url = url;
              variantR2Data.push({ r2Key: key, r2Url: url, filename: variant.filename });
            } catch (e) {
              console.error(`Failed to upload variant ${variant.filename} to R2:`, e);
              // Non-fatal: skip this variant
            }
          } else if (variant.r2Key && variant.r2Url) {
            variantR2Data.push({ r2Key: variant.r2Key, r2Url: variant.r2Url, filename: variant.filename });
          }
        }
      }

      // Step 1-4: Upload to Meta
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: "uploading_meta", step: "Step 1/4: Laddar upp media till Meta...", dbJobId } : j
        )
      );

      // Use custom ad name if set, otherwise auto-generate with LP label
      const resolvedAdName = job.adName
        || (job.lpLabel ? `${job.filename.replace(/\.[^.]+$/, "")} - ${job.lpLabel}` : undefined);
      const payload = buildPayload(
        job.r2Key!,
        job.r2Url!,
        job.filename,
        job.mediaType,
        overrideAdsetId,
        job.linkUrl,
        resolvedAdName,
        variantR2Data.length > 0 ? variantR2Data : undefined
      );

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
        return {};
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

      // Record team attribution so this ad shows up on the editor's dashboard.
      if (result.adId && (videoEditorId || creativeStrategistId)) {
        try {
          await fetch("/api/ad-owner", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adId: result.adId,
              adName: resolvedAdName || job.filename,
              campaignId: selectedCampaignId,
              adsetId: result.adsetId,
              source: "uploader",
              videoEditorId: videoEditorId || null,
              creativeStrategistId: creativeStrategistId || null,
              angle: adAngle || null,
              problem: adProblem || null,
              templateId: selectedTemplateId || null,
              templateName: templates.find((t) => t.id === selectedTemplateId)?.name || null,
            }),
          });
        } catch { /* non-fatal — owner can still be set later in the analyzer */ }
      }

      // The ad SET is the bonus unit — record its owner so it shows on the editor's dashboard.
      if (result.adsetId && (videoEditorId || creativeStrategistId)) {
        try {
          await fetch("/api/adset-owner", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adsetId: result.adsetId,
              adsetName: adsets.find((a) => a.id === result.adsetId)?.name || newAdsetName || null,
              campaignId: selectedCampaignId,
              source: "uploader",
              videoEditorId: videoEditorId || null,
              creativeStrategistId: creativeStrategistId || null,
            }),
          });
        } catch { /* non-fatal */ }
      }

      return { adsetId: result.adsetId };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      if (dbJobId) {
        await updateDbJob(dbJobId, {
          status: "failed",
          error: errMsg,
          stepLabel: "Unexpected error",
          config: {
            ...jobConfig,
            errorDetails: {
              message: errMsg,
              failedStep: 0,
              failedStepName: "Unknown",
              suggestion: "An unexpected error occurred. Try again or check the browser console.",
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
      return {};
    }
  };

  const processQueue = async () => {
    setIsUploading(true);
    const pending = jobs.filter((j) => j.status === "pending");
    let createdAdsetId: string | undefined;

    if (pending.length === 0) {
      setIsUploading(false);
      return;
    }

    // First job runs alone to create the ad set (if "new" mode)
    if (adsetMode === "new" && !selectedAdsetId) {
      const first = pending.shift()!;
      const result = await processSingleJob(first);
      if (result.adsetId) createdAdsetId = result.adsetId;
    }

    // Remaining jobs run in parallel batches of PARALLEL_UPLOADS
    for (let i = 0; i < pending.length; i += PARALLEL_UPLOADS) {
      const batch = pending.slice(i, i + PARALLEL_UPLOADS);
      const results = await Promise.all(
        batch.map((job) => processSingleJob(job, createdAdsetId))
      );
      // Capture adset ID from first successful result if we don't have one yet
      if (!createdAdsetId) {
        const withAdset = results.find((r) => r.adsetId);
        if (withAdset?.adsetId) createdAdsetId = withAdset.adsetId;
      }
    }

    setIsUploading(false);
    toast.success(`Bearbetade ${pending.length + (adsetMode === "new" ? 1 : 0)} fil(er)`);
  };

  const retryJob = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "failed") return;

    // Reset job status to pending, keeping file and config
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: "pending" as const, step: "Waiting...", error: undefined, errorDetails: undefined, dbJobId: undefined, result: undefined, r2Key: undefined, r2Url: undefined }
          : j
      )
    );

    // Get the adset to use (from a completed sibling job, or selected)
    const completedSibling = jobs.find((j) => j.id !== jobId && j.status === "completed" && j.result?.adsetId);
    const adsetOverride = completedSibling?.result?.adsetId || selectedAdsetId;

    // Re-process
    setIsUploading(true);
    // Read the reset job from state
    const resetJob = { ...job, status: "pending" as const, step: "Waiting...", error: undefined, errorDetails: undefined, dbJobId: undefined, result: undefined, r2Key: undefined, r2Url: undefined };
    await processSingleJob(resetJob, adsetOverride);
    setIsUploading(false);
  };

  const clearCompleted = () => {
    setJobs((prev) => prev.filter((j) => j.status !== "completed" && j.status !== "failed"));
  };

  const clearAll = () => {
    setJobs([]);
    setIsUploading(false);
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

  // Hidden file input for step-0 retry (R2 upload failed, need to re-pick the file)
  const retryFileInputRef = useRef<HTMLInputElement>(null);
  const pendingRetryJobRef = useRef<DbJob | null>(null);

  const retryHistoryJob = async (h: DbJob, file?: File) => {
    const hConfig = h.config as Record<string, unknown> | null;
    const adCopy = hConfig?.adCopy as Record<string, unknown> | undefined;
    const adsetConfig = hConfig?.adsetConfig as Record<string, unknown> | undefined;
    const adName = (hConfig?.adName as string) || h.filename.replace(/\.[^.]+$/, "");

    // Step 0 failure: no R2 file — need to re-upload to R2 first
    if (!h.r2Key || !h.r2Url) {
      if (!file) {
        // Open file picker — user selects the file, then we continue in onRetryFileSelected
        pendingRetryJobRef.current = h;
        retryFileInputRef.current?.click();
        return;
      }

      // File provided — upload to R2 first
      setIsUploading(true);
      try {
        const { key, url } = await uploadFileToR2(file);
        h = { ...h, r2Key: key, r2Url: url };
        // Update the DB job with the R2 data
        await fetch("/api/upload-jobs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: h.id, r2Key: key, r2Url: url, status: "uploading_meta", stepLabel: "Uploading to Meta..." }),
        });
      } catch (e) {
        toast.error(`R2-uppladdning misslyckades: ${e instanceof Error ? e.message : "Unknown error"}`);
        setIsUploading(false);
        fetchHistory();
        return;
      }
    }

    if (!h.campaignId) {
      toast.error("Kan inte retrya — saknar campaign ID");
      return;
    }

    if (!adCopy) {
      toast.error("Kan inte retrya — saknar ad copy-konfiguration");
      return;
    }

    setIsUploading(true);

    try {
      const res = await fetch("/api/meta/upload-from-r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r2Key: h.r2Key,
          r2Url: h.r2Url,
          filename: h.filename,
          mediaType: h.mediaType,
          campaignId: h.campaignId,
          adsetId: h.adsetId || (hConfig?.adsetId as string) || undefined,
          adsetConfig: adsetConfig || undefined,
          adCopy,
          adName,
          pageId: (hConfig?.pageId as string) || undefined,
          pixelId: (hConfig?.pixelId as string) || undefined,
          existingJobId: h.id,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(`Retry misslyckades: ${result.error || "Unknown error"}`);
      } else {
        toast.success(`${h.filename} uppladdad!`);
      }
    } catch (e) {
      toast.error(`Retry misslyckades: ${e instanceof Error ? e.message : "Network error"}`);
    } finally {
      setIsUploading(false);
      fetchHistory();
    }
  };

  const onRetryFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const job = pendingRetryJobRef.current;
    if (file && job) {
      retryHistoryJob(job, file);
    }
    pendingRetryJobRef.current = null;
    e.target.value = "";
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
  const inputCls = "w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-2 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]";
  const inputSmCls = "w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3 py-1.5 focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]";
  const labelCls = "text-[10px] text-slate-500 mb-0.5 block";

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Hidden file input for step-0 retry */}
      <input
        ref={retryFileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onRetryFileSelected}
      />
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => retryHistoryJob(h)}
                              disabled={isUploading}
                              className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 px-1.5 py-1 rounded bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
                              title={h.r2Key ? "Retry from R2" : "Choose file and retry"}
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                            <button
                              onClick={() => toggleHistoryError(h.id)}
                              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-1.5 py-1 rounded bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all"
                            >
                              <Bug className="h-3 w-3" />
                              <ChevronDown className={cn("h-3 w-3 transition-transform", hExpanded && "rotate-180")} />
                            </button>
                          </div>
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
              <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Flera textvarianter
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

      {/* ─── Page + Pixel Row ─── */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Page */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Globe className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Facebook Page</h3>
          </div>
          {loadingConnection ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span className="text-xs text-slate-500">Loading...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className={inputCls}
              >
                <option value="">Select page...</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectedPageId && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] text-slate-400">
                    ID: {selectedPageId}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pixel */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Crosshair className="h-4 w-4 text-purple-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pixel</h3>
          </div>
          {loadingConnection ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span className="text-xs text-slate-500">Loading...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {KNOWN_PIXELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPixelId(p.id)}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-md border transition-all",
                      pixelId === p.id
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-200"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value)}
                placeholder="Pixel ID (t.ex. 123456789)"
                className={inputCls}
              />
              {pixelId && (
                <div className="flex flex-wrap gap-1.5">
                  {pixelLabel(pixelId) && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">
                      {pixelLabel(pixelId)}
                    </span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] text-slate-400">
                    Tracking: Purchase
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Team Attribution Row ─── */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Video Editor */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Video className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Video Editor <span className="text-slate-600 normal-case">· owns the ad, earns bonus</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <select
                value={videoEditorId}
                onChange={(e) => setVideoEditorId(e.target.value)}
                className={inputCls}
              >
                <option value="">None selected...</option>
                {teamMembers
                  .filter((m) => m.userType !== "creative_strategist")
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
              </select>
            </div>
            <MemberQuickAdd
              defaultType="video_editor"
              members={teamMembers}
              onAdded={async (email) => {
                const list = await fetchMembers();
                const u = list.find((m) => m.email === email);
                if (u) setVideoEditorId(u.id);
              }}
              onRemoved={async () => {
                const list = await fetchMembers();
                if (videoEditorId && !list.some((m) => m.id === videoEditorId)) setVideoEditorId("");
              }}
            />
          </div>
        </div>

        {/* Creative Strategist */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Lightbulb className="h-4 w-4 text-purple-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Creative Strategist <span className="text-slate-600 normal-case">· concept, stats only</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <select
                value={creativeStrategistId}
                onChange={(e) => setCreativeStrategistId(e.target.value)}
                className={inputCls}
              >
                <option value="">None selected...</option>
                {teamMembers
                  .filter((m) => m.userType === "creative_strategist")
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
              </select>
            </div>
            <MemberQuickAdd
              defaultType="creative_strategist"
              members={teamMembers}
              onAdded={async (email) => {
                const list = await fetchMembers();
                const u = list.find((m) => m.email === email);
                if (u) setCreativeStrategistId(u.id);
              }}
              onRemoved={async () => {
                const list = await fetchMembers();
                if (creativeStrategistId && !list.some((m) => m.id === creativeStrategistId)) setCreativeStrategistId("");
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── Angle + Problem Row ─── */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Crosshair className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Angle <span className="text-slate-600 normal-case">· the angle the ad leans on</span>
            </h3>
          </div>
          <OptionPicker type="angles" value={adAngle} onChange={setAdAngle} selectClassName={inputCls} />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Problem <span className="text-slate-600 normal-case">· the pain/problem it addresses</span>
            </h3>
          </div>
          <OptionPicker type="problems" value={adProblem} onChange={setAdProblem} selectClassName={inputCls} />
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
                    <button onClick={() => { setSelectedFiles([]); setVariantsByFile({}); setFileDimensions({}); setExpandedFileIndex(null); }} className="text-[10px] text-slate-500 hover:text-red-400">Clear all</button>
                  </div>
                  {selectedFiles.map((file, i) => {
                    const dim = fileDimensions[i];
                    const isImage = file.type.startsWith("image/");
                    const variants = variantsByFile[i] || [];
                    const isExpanded = expandedFileIndex === i;
                    return (
                      <div key={i}>
                        {/* Main file row */}
                        <div
                          className={cn(
                            "flex items-center gap-3 px-4 py-2 transition-colors",
                            isImage && "cursor-pointer hover:bg-white/[0.02]",
                            isExpanded && "bg-white/[0.02]"
                          )}
                          onClick={() => {
                            if (isImage) setExpandedFileIndex(isExpanded ? null : i);
                          }}
                        >
                          {file.type.startsWith("video/")
                            ? <FileVideo className="h-4 w-4 text-cyan-400 shrink-0" />
                            : <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-white truncate">{file.name}</p>
                              {dim && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                                  {dim.ratio}
                                </span>
                              )}
                              {variants.length > 0 && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                                  +{variants.length} variant{variants.length > 1 ? "er" : ""}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">{formatSize(file.size)}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isImage && (
                              <ChevronDown className={cn("h-3.5 w-3.5 text-slate-500 transition-transform", isExpanded && "rotate-180")} />
                            )}
                            <button onClick={(e) => { e.stopPropagation(); removeFile(i); if (isExpanded) setExpandedFileIndex(null); }} className="text-slate-600 hover:text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded: variant list + upload zone */}
                        {isImage && isExpanded && (
                          <div className="px-4 pb-3 pt-1 bg-white/[0.015]">
                            {/* Existing variants */}
                            {variants.length > 0 && (
                              <div className="mb-2 space-y-1">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Placement-varianter</p>
                                {variants.map((v) => (
                                  <div key={v.id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                    <ImageIcon className="h-3.5 w-3.5 text-orange-400/70 shrink-0" />
                                    <p className="text-[11px] text-slate-300 truncate flex-1">{v.filename}</p>
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                                      {v.aspectRatio}
                                    </span>
                                    <button onClick={() => removeVariant(i, v.id)} className="text-slate-600 hover:text-red-400">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Upload zone for adding variants */}
                            <button
                              onClick={() => variantInputRefs.current[i]?.click()}
                              className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-white/[0.1] hover:border-orange-400/40 hover:bg-orange-500/5 transition-all group"
                            >
                              <Plus className="h-4 w-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
                              <span className="text-[11px] text-slate-500 group-hover:text-orange-300 transition-colors">
                                Ladda upp variant (t.ex. 9:16 för Stories/Reels)
                              </span>
                            </button>
                            <input
                              ref={(el) => { variantInputRefs.current[i] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) addVariantToFile(i, f);
                                e.target.value = "";
                              }}
                            />
                            <p className="text-[9px] text-slate-600 mt-1.5 text-center">
                              Meta visar rätt bild per placement baserat på aspect ratio. Feed = 1:1, Stories/Reels = 9:16
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

          {/* LP Assignment Matrix — show when multiple LPs AND files selected */}
          {(() => {
            const activeLPs = landingPages.filter((lp) => lp.url);
            const files = activeTab === "computer" ? selectedFiles.map((f) => f.name) : r2Selected.map((f) => f.name);
            if (activeLPs.length <= 1 || files.length === 0) return null;

            // Count total ads
            let totalAds = 0;
            for (let fi = 0; fi < files.length; fi++) {
              for (let li = 0; li < activeLPs.length; li++) {
                if (lpMatrix[`${fi}-${li}`] !== false) totalAds++;
              }
            }

            return (
              <div className="rounded-xl border border-white/[0.06] bg-[#111827] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    LP-tilldelning
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setLpMatrix({})}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300"
                    >
                      Markera alla
                    </button>
                    <span className="text-[10px] text-slate-500">
                      {totalAds} ads skapas
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        <th className="text-left px-4 py-2 text-[10px] text-slate-500 font-medium">Kreativ</th>
                        {activeLPs.map((lp, li) => (
                          <th
                            key={li}
                            className="px-3 py-2 text-center cursor-pointer hover:text-cyan-400 text-[10px] text-slate-500 font-medium"
                            onClick={() => {
                              // Toggle entire column
                              const allChecked = files.every((_, fi) => lpMatrix[`${fi}-${li}`] !== false);
                              setLpMatrix((prev) => {
                                const next = { ...prev };
                                for (let fi = 0; fi < files.length; fi++) {
                                  next[`${fi}-${li}`] = !allChecked;
                                }
                                return next;
                              });
                            }}
                          >
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {lp.label}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((filename, fi) => {
                        const baseName = filename.replace(/\.[^.]+$/, "");
                        const checkedLPs = activeLPs
                          .map((lp, li) => ({ lp, li, key: `${fi}-${li}`, checked: lpMatrix[`${fi}-${li}`] !== false }))
                          .filter((x) => x.checked);
                        return (
                          <Fragment key={fi}>
                            {/* Main row: filename + checkboxes */}
                            <tr className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                              <td className="px-4 py-1.5 text-white truncate max-w-[200px]" title={filename}>
                                {baseName.slice(0, 40)}
                              </td>
                              {activeLPs.map((_, li) => {
                                const key = `${fi}-${li}`;
                                const checked = lpMatrix[key] !== false;
                                return (
                                  <td key={li} className="px-3 py-1.5 text-center">
                                    <button
                                      onClick={() => setLpMatrix((prev) => ({ ...prev, [key]: !checked }))}
                                      className={cn(
                                        "w-5 h-5 rounded border transition-all inline-flex items-center justify-center",
                                        checked
                                          ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                                          : "bg-white/[0.02] border-white/[0.08] text-transparent hover:border-white/20"
                                      )}
                                    >
                                      {checked && <CheckCircle2 className="h-3.5 w-3.5" />}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                            {/* Sub-rows: editable ad name per checked LP */}
                            {checkedLPs.length > 0 && (
                              <tr className="border-b border-white/[0.02]">
                                <td colSpan={activeLPs.length + 1} className="px-4 py-1 pb-2">
                                  <div className="flex flex-col gap-1">
                                    {checkedLPs.map(({ lp, key }) => (
                                      <div key={key} className="flex items-center gap-2">
                                        <span className="text-[10px] text-cyan-400/70 font-medium w-8 shrink-0">{lp.label}</span>
                                        <div className="relative flex-1">
                                          <Pencil className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-slate-600" />
                                          <input
                                            type="text"
                                            value={nameOverrides[key] ?? ""}
                                            placeholder={baseName}
                                            onChange={(e) => setNameOverrides((prev) => ({ ...prev, [key]: e.target.value }))}
                                            className="w-full pl-6 pr-2 py-1 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded text-white placeholder:text-slate-600 focus:border-cyan-500/30 focus:outline-none"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

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
                      <optgroup label="Groups">
                        <option value="BIG5">🌍 BIG 5 (US · CA · UK · AU · NZ)</option>
                      </optgroup>
                      <optgroup label="Nordics">
                        <option value="SE">Sweden</option>
                        <option value="NO">Norway</option>
                        <option value="DK">Denmark</option>
                        <option value="FI">Finland</option>
                      </optgroup>
                      <optgroup label="English-speaking">
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                        <option value="NZ">New Zealand</option>
                      </optgroup>
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
                <label className="flex items-center gap-2 cursor-pointer group mt-1">
                  <input
                    type="checkbox"
                    checked={scheduleForTomorrow}
                    onChange={(e) => setScheduleForTomorrow(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/30"
                  />
                  <Clock className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Starta 02:00 imorgon</span>
                </label>
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

            {/* Landing Pages */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Landing Pages ({landingPages.filter((lp) => lp.url).length})</label>
                {landingPages.length < 5 && (
                  <button
                    onClick={() => setLandingPages((prev) => [...prev, { url: "", label: `LP${prev.length + 1}` }])}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {landingPages.map((lp, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input
                      value={lp.label}
                      onChange={(e) => setLandingPages((prev) => prev.map((p, j) => j === i ? { ...p, label: e.target.value } : p))}
                      className="w-16 shrink-0 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[10px] font-semibold text-cyan-400 px-2 py-2 text-center focus:border-cyan-500/50 focus:outline-none"
                      placeholder="LP"
                    />
                    <input
                      value={lp.url}
                      onChange={(e) => {
                        const url = e.target.value;
                        const autoLabel = extractLpLabel(url);
                        setLandingPages((prev) => prev.map((p, j) => j === i ? { ...p, url, ...(autoLabel && p.label === `LP${i + 1}` ? { label: autoLabel } : {}) } : p));
                      }}
                      placeholder="https://apotekhunden.se/lp7"
                      className={inputCls + " flex-1"}
                    />
                    {landingPages.length > 1 && (
                      <button
                        onClick={() => setLandingPages((prev) => prev.filter((_, j) => j !== i))}
                        className="px-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
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
              <button onClick={clearAll} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-all">
                <Trash2 className="h-3 w-3" /> Rensa allt
              </button>
              {hasCompleted && (
                <button onClick={clearCompleted} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-all">
                  <Trash2 className="h-3 w-3" /> Rensa klara
                </button>
              )}
              {hasPending && (
                <button
                  onClick={processQueue}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {isUploading ? "Uploading..." : "Ladda upp alla"}
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
                      <p className="text-xs text-white truncate font-medium">
                        {job.adName || job.filename}
                        {job.lpLabel && (
                          <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {job.lpLabel}
                          </span>
                        )}
                        {job.variants && job.variants.length > 0 && (
                          <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            {job.variants.map((v) => v.aspectRatio).join(" + ")}
                          </span>
                        )}
                      </p>
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
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => retryJob(job.id)}
                          disabled={isUploading}
                          className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded-md bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                        <button
                          onClick={() => toggleError(job.id)}
                          className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded-md bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all"
                        >
                          <Bug className="h-3 w-3" />
                          Detaljer
                          <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      </div>
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
