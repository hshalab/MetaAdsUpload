"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, FileText, Star, Globe, Type, AlignLeft, Link, Target, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Template {
  id: number;
  name: string;
  isDefault: boolean;
  objective: string;
  budgetType: string;
  dailyBudget: number | null;
  headlines: string[];
  primaryTexts: string[];
  descriptions: string[];
  ctaType: string;
  landingPages: string[];
  targetCountries: string[];
  ageMin: number | null;
  ageMax: number | null;
  genders: number[] | null;
  optimizationGoal: string;
  conversionEvent: string;
  bidStrategy: string;
  adsetNameTemplate: string;
  adNameTemplate: string;
  productName: string | null;
  angleName: string | null;
  pixelId: string | null;
}

const EMPTY_FORM = {
  name: "",
  isDefault: false,
  objective: "OUTCOME_SALES",
  budgetType: "ABO",
  dailyBudget: 50 as number | null,
  headlines: [""],
  primaryTexts: [""],
  descriptions: [""],
  ctaType: "SHOP_NOW",
  landingPages: [""],
  targetCountries: ["SE"],
  ageMin: null as number | null,
  ageMax: null as number | null,
  genders: null as number[] | null,
  optimizationGoal: "OFFSITE_CONVERSIONS",
  conversionEvent: "PURCHASE",
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  adsetNameTemplate: "{product} {angle} {country}",
  adNameTemplate: "{country} {editor} {creative} {lp}",
  productName: "",
  angleName: "",
  pixelId: "",
};

const COUNTRIES = [
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PL", name: "Poland" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "BE", name: "Belgium" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.data || []);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      isDefault: t.isDefault,
      objective: t.objective,
      budgetType: t.budgetType,
      dailyBudget: t.dailyBudget || 50,
      headlines: t.headlines.length > 0 ? t.headlines : [""],
      primaryTexts: t.primaryTexts.length > 0 ? t.primaryTexts : [""],
      descriptions: t.descriptions.length > 0 ? t.descriptions : [""],
      ctaType: t.ctaType,
      landingPages: t.landingPages.length > 0 ? t.landingPages : [""],
      targetCountries: t.targetCountries.length > 0 ? t.targetCountries : ["SE"],
      ageMin: t.ageMin,
      ageMax: t.ageMax,
      genders: t.genders,
      optimizationGoal: t.optimizationGoal,
      conversionEvent: t.conversionEvent,
      bidStrategy: t.bidStrategy,
      adsetNameTemplate: t.adsetNameTemplate || "{product} {angle} {country}",
      adNameTemplate: t.adNameTemplate || "{country} {editor} {creative} {lp}",
      productName: t.productName || "",
      angleName: t.angleName || "",
      pixelId: t.pixelId || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        headlines: form.headlines.filter(Boolean),
        primaryTexts: form.primaryTexts.filter(Boolean),
        descriptions: form.descriptions.filter(Boolean),
        landingPages: form.landingPages.filter(Boolean),
        productName: form.productName || null,
        angleName: form.angleName || null,
        pixelId: form.pixelId || null,
      };

      if (editingId) {
        await fetch("/api/templates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        toast.success("Template updated");
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success("Template created");
      }
      setDialogOpen(false);
      fetchTemplates();
    } catch {
      toast.error("Failed to save template");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch("/api/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      toast.success("Template deleted");
      fetchTemplates();
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const toggleCountry = (code: string) => {
    const current = form.targetCountries;
    if (current.includes(code)) {
      if (current.length <= 1) return; // keep at least one
      setForm({ ...form, targetCountries: current.filter((c) => c !== code) });
    } else {
      setForm({ ...form, targetCountries: [...current, code] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="h-6 w-6 text-cyan-400" />
            Upload Templates
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Full ad configuration presets — select template + batch = done</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {/* Template Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className={cn(
            "rounded-xl border overflow-hidden hover:border-white/10 transition-all cursor-pointer",
            t.isDefault ? "border-cyan-500/30 bg-[#111827]" : "border-white/5 bg-[#111827]"
          )} onClick={() => openEdit(t)}>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {t.isDefault && <Star className="h-3.5 w-3.5 text-cyan-400 fill-cyan-400" />}
                  <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                    className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {t.objective.replace("OUTCOME_", "")}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                  {t.budgetType} {t.dailyBudget ? `${t.dailyBudget} SEK` : ""}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                  {t.bidStrategy.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>

              {/* Details */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Globe className="h-3 w-3" />
                  {t.targetCountries.join(", ")}
                  {t.ageMin || t.ageMax ? ` · ${t.ageMin || 18}-${t.ageMax || "65+"}` : ""}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Type className="h-3 w-3" />
                  {t.headlines.length} headline{t.headlines.length !== 1 ? "s" : ""} · {t.primaryTexts.length} text{t.primaryTexts.length !== 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Link className="h-3 w-3" />
                  {t.landingPages.length} landing page{t.landingPages.length !== 1 ? "s" : ""}
                </div>
                {(t.productName || t.angleName) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Target className="h-3 w-3" />
                    {[t.productName, t.angleName].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No templates yet. Create your first template for one-click publishing.
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#111827] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              {editingId ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Name + Default */}
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Template Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-white/5 border-white/10 placeholder:text-slate-600" placeholder="e.g. SE Standard Sales" />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
                <label className="text-xs text-slate-400">Default</label>
              </div>
            </div>

            {/* --- Product & Angle --- */}
            <div className="rounded-lg border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Product & Angle</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Product Name</label>
                  <Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    className="bg-white/5 border-white/10 placeholder:text-slate-600" placeholder="e.g. PawCare" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Angle</label>
                  <Input value={form.angleName} onChange={(e) => setForm({ ...form, angleName: e.target.value })}
                    className="bg-white/5 border-white/10 placeholder:text-slate-600" placeholder="e.g. PawLicking" />
                </div>
              </div>
            </div>

            {/* --- Campaign & Budget --- */}
            <div className="rounded-lg border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Campaign & Budget</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Objective</label>
                  <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      <SelectItem value="OUTCOME_SALES">Sales</SelectItem>
                      <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                      <SelectItem value="OUTCOME_TRAFFIC">Traffic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Budget Type</label>
                  <Select value={form.budgetType} onValueChange={(v) => setForm({ ...form, budgetType: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      <SelectItem value="ABO">ABO (Ad Set Budget)</SelectItem>
                      <SelectItem value="CBO">CBO (Campaign Budget)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Daily Budget (SEK)</label>
                  <Input type="number" value={String(form.dailyBudget ?? "")} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value ? Number(e.target.value) : null })}
                    className="bg-white/5 border-white/10" placeholder="50" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Optimization Goal</label>
                  <Select value={form.optimizationGoal} onValueChange={(v) => setForm({ ...form, optimizationGoal: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      <SelectItem value="OFFSITE_CONVERSIONS">Conversions</SelectItem>
                      <SelectItem value="LINK_CLICKS">Link Clicks</SelectItem>
                      <SelectItem value="IMPRESSIONS">Impressions</SelectItem>
                      <SelectItem value="REACH">Reach</SelectItem>
                      <SelectItem value="LANDING_PAGE_VIEWS">Landing Page Views</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Bid Strategy</label>
                  <Select value={form.bidStrategy} onValueChange={(v) => setForm({ ...form, bidStrategy: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest Cost</SelectItem>
                      <SelectItem value="COST_CAP">Cost Cap</SelectItem>
                      <SelectItem value="BID_CAP">Bid Cap</SelectItem>
                      <SelectItem value="LOWEST_COST_WITH_BID_CAP">Lowest Cost with Bid Cap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* --- Targeting --- */}
            <div className="rounded-lg border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Targeting</h3>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500">Countries</label>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRIES.map((c) => (
                    <button key={c.code} onClick={() => toggleCountry(c.code)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                        form.targetCountries.includes(c.code)
                          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                          : "bg-white/5 text-slate-500 border-white/10 hover:bg-white/10"
                      )}>
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Age Min (optional)</label>
                  <Input type="number" value={form.ageMin ?? ""} onChange={(e) => setForm({ ...form, ageMin: e.target.value ? Number(e.target.value) : null })}
                    className="bg-white/5 border-white/10" placeholder="No limit" min={18} max={65} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Age Max (optional)</label>
                  <Input type="number" value={form.ageMax ?? ""} onChange={(e) => setForm({ ...form, ageMax: e.target.value ? Number(e.target.value) : null })}
                    className="bg-white/5 border-white/10" placeholder="No limit" min={18} max={65} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Gender</label>
                  <Select value={form.genders ? form.genders.join(",") : "all"} onValueChange={(v) => setForm({ ...form, genders: v === "all" ? null : v.split(",").map(Number) })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">Female</SelectItem>
                      <SelectItem value="2">Male</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* --- Ad Copy --- */}
            <div className="rounded-lg border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ad Copy</h3>
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Headlines</label>
                {form.headlines.map((h, i) => (
                  <Input key={i} value={h} onChange={(e) => {
                    const arr = [...form.headlines]; arr[i] = e.target.value;
                    setForm({ ...form, headlines: arr });
                  }} placeholder={`Headline ${i + 1}`} className="bg-white/5 border-white/10 placeholder:text-slate-600" />
                ))}
                <button onClick={() => setForm({ ...form, headlines: [...form.headlines, ""] })}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  <Plus className="h-3 w-3" /> Add Headline
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Primary Texts</label>
                {form.primaryTexts.map((t, i) => (
                  <textarea key={i} value={t} onChange={(e) => {
                    const arr = [...form.primaryTexts]; arr[i] = e.target.value;
                    setForm({ ...form, primaryTexts: arr });
                  }} placeholder={`Text ${i + 1}`} rows={2}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all resize-none" />
                ))}
                <button onClick={() => setForm({ ...form, primaryTexts: [...form.primaryTexts, ""] })}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  <Plus className="h-3 w-3" /> Add Text
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500">CTA Button</label>
                <Select value={form.ctaType} onValueChange={(v) => setForm({ ...form, ctaType: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111827] border-white/10">
                    <SelectItem value="SHOP_NOW">Shop Now</SelectItem>
                    <SelectItem value="LEARN_MORE">Learn More</SelectItem>
                    <SelectItem value="BUY_NOW">Buy Now</SelectItem>
                    <SelectItem value="SIGN_UP">Sign Up</SelectItem>
                    <SelectItem value="ORDER_NOW">Order Now</SelectItem>
                    <SelectItem value="GET_OFFER">Get Offer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* --- Landing Pages --- */}
            <div className="rounded-lg border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Landing Pages ({form.landingPages.filter(Boolean).length})
              </h3>
              <p className="text-xs text-slate-600">Each creative × each landing page = total ads per ad-set</p>
              {form.landingPages.map((lp, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={lp} onChange={(e) => {
                    const arr = [...form.landingPages]; arr[i] = e.target.value;
                    setForm({ ...form, landingPages: arr });
                  }} placeholder="https://example.com/page" className="bg-white/5 border-white/10 placeholder:text-slate-600" />
                  {form.landingPages.length > 1 && (
                    <button onClick={() => setForm({ ...form, landingPages: form.landingPages.filter((_, j) => j !== i) })}
                      className="p-2 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setForm({ ...form, landingPages: [...form.landingPages, ""] })}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                <Plus className="h-3 w-3" /> Add Landing Page
              </button>
            </div>

            {/* --- Naming Templates --- */}
            <div className="rounded-lg border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Naming Templates</h3>
              <p className="text-xs text-slate-600">
                Variables: {"{product}"} {"{angle}"} {"{country}"} {"{editor}"} {"{creative}"} {"{lp}"} {"{date}"}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Ad-Set Name</label>
                  <Input value={form.adsetNameTemplate} onChange={(e) => setForm({ ...form, adsetNameTemplate: e.target.value })}
                    className="bg-white/5 border-white/10 font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Ad Name</label>
                  <Input value={form.adNameTemplate} onChange={(e) => setForm({ ...form, adNameTemplate: e.target.value })}
                    className="bg-white/5 border-white/10 font-mono text-xs" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all">
              Cancel
            </button>
            <button onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all">
              {editingId ? "Save Changes" : "Create Template"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
