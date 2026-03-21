"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Upload,
  Rocket,
  Link2,
  FileVideo,
  FileImage,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Assignment {
  id: string;
  title: string;
  autoName: string | null;
  landingPage: string | null;
  metaAdId?: string | null;
  metaAdsetId?: string | null;
  metaCampaignId?: string | null;
  format?: { id: string; name: string } | null;
  product?: { id: string; name: string; code: string } | null;
  country?: { id: string; code: string; name: string } | null;
  angle?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface Template {
  id: number;
  name: string;
  headlines: string[];
  primaryTexts: string[];
  descriptions: string[];
  ctaType: string;
}

interface CreativeFile {
  id: string;
  name: string;
  type: "video" | "image";
  file?: File;
  base64?: string;
}

interface PublishResult {
  success: boolean;
  meta?: {
    campaignId: string;
    adsetId: string;
    adsetName: string;
    totalAds: number;
    formula: string;
    ads: Array<{ adId: string; adName: string; creativeName: string; landingPage: string }>;
  };
}

export function PublishDialog({
  assignment,
  open,
  onOpenChange,
  onPublished,
}: {
  assignment: Assignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);

  // Campaign
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignMode, setCampaignMode] = useState<"existing" | "new">("new");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("OUTCOME_SALES");
  const [budgetType, setBudgetType] = useState<"ABO" | "CBO">("ABO");
  const [dailyBudget, setDailyBudget] = useState("50");

  // Template
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [headlines, setHeadlines] = useState<string[]>([""]);
  const [primaryTexts, setPrimaryTexts] = useState<string[]>([""]);
  const [descriptions, setDescriptions] = useState<string[]>([""]);
  const [ctaType, setCtaType] = useState("SHOP_NOW");

  // Landing pages
  const [landingPages, setLandingPages] = useState<string[]>([assignment.landingPage || ""]);

  // Creatives
  const [creatives, setCreatives] = useState<CreativeFile[]>([]);

  // Ad Set
  const [adsetName, setAdsetName] = useState(assignment.autoName || assignment.title);
  const [optimizationGoal, setOptimizationGoal] = useState("OFFSITE_CONVERSIONS");
  const [conversionEvent, setConversionEvent] = useState("PURCHASE");

  // Load campaigns and templates
  useEffect(() => {
    if (open) {
      fetch("/api/meta/campaigns")
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((d) => setCampaigns(d.data || d || []))
        .catch(() => {});

      fetch("/api/templates")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setTemplates(Array.isArray(d) ? d : d.templates || []))
        .catch(() => {});

      // Reset state
      setStep(0);
      setResult(null);
      setPublishing(false);
      setAdsetName(assignment.autoName || assignment.title);
      setLandingPages([assignment.landingPage || ""]);
    }
  }, [open, assignment]);

  // When template selected, populate copy
  useEffect(() => {
    if (selectedTemplateId) {
      const t = templates.find((t) => t.id === selectedTemplateId);
      if (t) {
        setHeadlines(t.headlines?.length ? t.headlines : [""]);
        setPrimaryTexts(t.primaryTexts?.length ? t.primaryTexts : [""]);
        setDescriptions(t.descriptions?.length ? t.descriptions : [""]);
        setCtaType(t.ctaType || "SHOP_NOW");
      }
    }
  }, [selectedTemplateId, templates]);

  const handleFileAdd = async (files: FileList | null) => {
    if (!files) return;
    const newCreatives: CreativeFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith("video/") ? "video" : "image";
      const base64 = await fileToBase64(file);
      newCreatives.push({
        id: crypto.randomUUID(),
        name: file.name,
        type,
        file,
        base64,
      });
    }
    setCreatives((prev) => [...prev, ...newCreatives]);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const config = {
        campaignId: campaignMode === "existing" ? selectedCampaignId : undefined,
        campaignName: campaignMode === "new" ? newCampaignName : undefined,
        campaignObjective,
        budgetType,
        adsetName,
        dailyBudget: parseInt(dailyBudget) * 100, // to cents
        optimizationGoal,
        conversionEvent,
        templateId: selectedTemplateId || undefined,
        headlines: headlines.filter(Boolean),
        primaryTexts: primaryTexts.filter(Boolean),
        descriptions: descriptions.filter(Boolean),
        ctaType,
        landingPages: landingPages.filter(Boolean),
        creatives: creatives.map((c) => ({
          name: c.name,
          type: c.type,
          base64: c.base64,
        })),
      };

      const res = await fetch(`/api/assignments/${assignment.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");

      setResult(data);
      toast.success(`Published ${data.meta.totalAds} ads to Meta!`);
      onPublished?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const totalAds = creatives.length * landingPages.filter(Boolean).length;

  const steps = [
    { label: "Campaign", icon: "1" },
    { label: "Ad Copy", icon: "2" },
    { label: "Creatives & Pages", icon: "3" },
    { label: "Review", icon: "4" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#111827] border-white/10 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Rocket className="h-5 w-5 text-cyan-400" />
            Publish to Meta
          </DialogTitle>
        </DialogHeader>

        {result ? (
          /* Success view */
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-1">Published Successfully!</h3>
              <p className="text-sm text-slate-400">{result.meta?.formula}</p>
            </div>
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Campaign ID</span>
                <span className="font-mono text-xs text-slate-300">{result.meta?.campaignId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Ad Set ID</span>
                <span className="font-mono text-xs text-slate-300">{result.meta?.adsetId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Ad Set Name</span>
                <span className="text-slate-300">{result.meta?.adsetName}</span>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Ads Created</p>
                {result.meta?.ads.map((ad) => (
                  <div key={ad.adId} className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-400">{ad.adName}</span>
                    <span className="font-mono text-slate-500">{ad.adId}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step Indicator */}
            <div className="flex items-center gap-1 mb-4">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                    step === i
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : step > i
                      ? "bg-emerald-500/5 text-emerald-400/60 border border-emerald-500/10"
                      : "text-slate-500 border border-transparent hover:bg-white/5"
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    step === i ? "bg-cyan-500/20" : step > i ? "bg-emerald-500/10" : "bg-white/5"
                  )}>
                    {step > i ? "✓" : s.icon}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Step 0: Campaign */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCampaignMode("new")}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                      campaignMode === "new"
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5"
                    )}
                  >
                    New Campaign
                  </button>
                  <button
                    onClick={() => setCampaignMode("existing")}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                      campaignMode === "existing"
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5"
                    )}
                  >
                    Existing Campaign
                  </button>
                </div>

                {campaignMode === "new" ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Campaign Name</label>
                      <Input
                        value={newCampaignName}
                        onChange={(e) => setNewCampaignName(e.target.value)}
                        placeholder={`${assignment.country?.code || "SE"} ${assignment.product?.name || "Campaign"}`}
                        className="bg-white/5 border-white/10 placeholder:text-slate-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Objective</label>
                        <Select value={campaignObjective} onValueChange={setCampaignObjective}>
                          <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#111827] border-white/10">
                            <SelectItem value="OUTCOME_SALES">Sales</SelectItem>
                            <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                            <SelectItem value="OUTCOME_TRAFFIC">Traffic</SelectItem>
                            <SelectItem value="OUTCOME_AWARENESS">Awareness</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Budget Type</label>
                        <Select value={budgetType} onValueChange={(v) => setBudgetType(v as "ABO" | "CBO")}>
                          <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#111827] border-white/10">
                            <SelectItem value="ABO">Ad Set Budget (ABO)</SelectItem>
                            <SelectItem value="CBO">Campaign Budget (CBO)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Select Campaign</label>
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                      <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Choose campaign..." /></SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Daily Budget (SEK)</label>
                    <Input
                      type="number"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ad Set Name</label>
                    <Input
                      value={adsetName}
                      onChange={(e) => setAdsetName(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Optimization</label>
                    <Select value={optimizationGoal} onValueChange={setOptimizationGoal}>
                      <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        <SelectItem value="OFFSITE_CONVERSIONS">Conversions</SelectItem>
                        <SelectItem value="LANDING_PAGE_VIEWS">Landing Page Views</SelectItem>
                        <SelectItem value="LINK_CLICKS">Link Clicks</SelectItem>
                        <SelectItem value="IMPRESSIONS">Impressions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Conversion Event</label>
                    <Select value={conversionEvent} onValueChange={setConversionEvent}>
                      <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        <SelectItem value="PURCHASE">Purchase</SelectItem>
                        <SelectItem value="ADD_TO_CART">Add to Cart</SelectItem>
                        <SelectItem value="INITIATE_CHECKOUT">Initiate Checkout</SelectItem>
                        <SelectItem value="VIEW_CONTENT">View Content</SelectItem>
                        <SelectItem value="LEAD">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Ad Copy / Template */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Load from Template</label>
                  <Select
                    value={selectedTemplateId?.toString() || ""}
                    onValueChange={(v) => setSelectedTemplateId(v ? parseInt(v) : null)}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Select template (optional)" /></SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <MultiInput label="Headlines" values={headlines} onChange={setHeadlines} placeholder="Headline text" />
                <MultiInput label="Primary Texts" values={primaryTexts} onChange={setPrimaryTexts} placeholder="Primary text" />
                <MultiInput label="Descriptions" values={descriptions} onChange={setDescriptions} placeholder="Description" />

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">CTA Button</label>
                  <Select value={ctaType} onValueChange={setCtaType}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      <SelectItem value="SHOP_NOW">Shop Now</SelectItem>
                      <SelectItem value="LEARN_MORE">Learn More</SelectItem>
                      <SelectItem value="SIGN_UP">Sign Up</SelectItem>
                      <SelectItem value="BUY_NOW">Buy Now</SelectItem>
                      <SelectItem value="ORDER_NOW">Order Now</SelectItem>
                      <SelectItem value="GET_OFFER">Get Offer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Creatives & Landing Pages */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Landing Pages */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Landing Pages ({landingPages.filter(Boolean).length})
                    </label>
                    <button
                      onClick={() => setLandingPages([...landingPages, ""])}
                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                    >
                      <Plus className="h-3 w-3" /> Add Page
                    </button>
                  </div>
                  <div className="space-y-2">
                    {landingPages.map((lp, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            value={lp}
                            onChange={(e) => {
                              const updated = [...landingPages];
                              updated[i] = e.target.value;
                              setLandingPages(updated);
                            }}
                            placeholder="https://example.com/landing-page"
                            className="bg-white/5 border-white/10 placeholder:text-slate-600 text-sm"
                          />
                        </div>
                        {landingPages.length > 1 && (
                          <button
                            onClick={() => setLandingPages(landingPages.filter((_, j) => j !== i))}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Creatives */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Creatives ({creatives.length})
                    </label>
                  </div>

                  {/* Drop zone */}
                  <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10 bg-white/[0.02] p-6 cursor-pointer hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all">
                    <Upload className="h-8 w-8 text-slate-500 mb-2" />
                    <p className="text-sm text-slate-400">Drop files or click to upload</p>
                    <p className="text-xs text-slate-600 mt-1">MP4, MOV, JPG, PNG</p>
                    <input
                      type="file"
                      multiple
                      accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileAdd(e.target.files)}
                    />
                  </label>

                  {/* Creative list */}
                  {creatives.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {creatives.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                          <div className="flex items-center gap-2">
                            {c.type === "video" ? (
                              <FileVideo className="h-4 w-4 text-blue-400" />
                            ) : (
                              <FileImage className="h-4 w-4 text-pink-400" />
                            )}
                            <span className="text-sm text-slate-300">{c.name}</span>
                          </div>
                          <button
                            onClick={() => setCreatives(creatives.filter((x) => x.id !== c.id))}
                            className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preview multiplication */}
                {creatives.length > 0 && landingPages.filter(Boolean).length > 0 && (
                  <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-4">
                    <p className="text-sm font-medium text-cyan-400">
                      {creatives.length} creative{creatives.length !== 1 ? "s" : ""} × {landingPages.filter(Boolean).length} landing page{landingPages.filter(Boolean).length !== 1 ? "s" : ""} = <span className="text-lg font-bold">{totalAds} ads</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Each creative will be paired with each landing page</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4 space-y-3">
                  <ReviewRow label="Assignment" value={assignment.autoName || assignment.title} />
                  <ReviewRow label="Editor" value={assignment.assignedTo?.name || "-"} />
                  <ReviewRow
                    label="Campaign"
                    value={campaignMode === "existing"
                      ? campaigns.find((c) => c.id === selectedCampaignId)?.name || selectedCampaignId
                      : newCampaignName || "(auto-generated)"
                    }
                  />
                  <ReviewRow label="Ad Set" value={adsetName} />
                  <ReviewRow label="Budget" value={`${dailyBudget} SEK/day (${budgetType})`} />
                  <ReviewRow label="Headlines" value={`${headlines.filter(Boolean).length} variant(s)`} />
                  <ReviewRow label="Primary Texts" value={`${primaryTexts.filter(Boolean).length} variant(s)`} />
                  <ReviewRow label="CTA" value={ctaType.replace(/_/g, " ")} />
                  <ReviewRow label="Creatives" value={`${creatives.length}`} />
                  <ReviewRow label="Landing Pages" value={`${landingPages.filter(Boolean).length}`} />
                  <div className="pt-2 border-t border-white/5">
                    <ReviewRow label="Total Ads" value={`${totalAds}`} highlight />
                  </div>
                </div>

                {/* Preview each ad */}
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Ad Preview</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {creatives.map((c) =>
                      landingPages.filter(Boolean).map((lp, lpIdx) => {
                        const cleanName = c.name.replace(/\.[^.]+$/, "");
                        const lpSuffix = landingPages.filter(Boolean).length > 1 ? ` LP${lpIdx + 1}` : "";
                        return (
                          <div key={`${c.id}-${lpIdx}`} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/[0.02]">
                            <span className="text-slate-300">{assignment.country?.code || "SE"} {assignment.assignedTo?.name?.split(" ")[0] || "Editor"} {cleanName}{lpSuffix}</span>
                            <span className="text-slate-600 truncate max-w-[150px]">{lp}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <DialogFooter className="flex justify-between">
              <div>
                {step > 0 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
                  >
                    Back
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={publishing || creatives.length === 0 || landingPages.filter(Boolean).length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-medium text-white hover:from-emerald-400 hover:to-emerald-500 transition-all disabled:opacity-50"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Publishing...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4" /> Publish {totalAds} Ads
                      </>
                    )}
                  </button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Helper Components ---

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-medium", highlight ? "text-cyan-400 text-lg" : "text-white")}>{value}</span>
    </div>
  );
}

function MultiInput({ label, values, onChange, placeholder }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
        <button
          onClick={() => onChange([...values, ""])}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 transition-all"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            onChange={(e) => {
              const updated = [...values];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            placeholder={placeholder}
            className="bg-white/5 border-white/10 placeholder:text-slate-600 text-sm"
          />
          {values.length > 1 && (
            <button
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:xxx;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
