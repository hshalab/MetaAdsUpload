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
import { Plus, Trash2, FileText, Star, Link, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Template {
  id: number;
  name: string;
  isDefault: boolean;
  objective: string;
  budgetType: string;
  dailyBudget: number | null;
  ctaType: string;
  landingPages: string[];
  optimizationGoal: string;
  conversionEvent: string;
  bidStrategy: string;
  pixelId: string | null;
}

const EMPTY_FORM = {
  name: "",
  isDefault: false,
  objective: "OUTCOME_SALES",
  budgetType: "ABO",
  dailyBudget: 50 as number | null,
  ctaType: "SHOP_NOW",
  landingPages: [""],
  optimizationGoal: "OFFSITE_CONVERSIONS",
  conversionEvent: "PURCHASE",
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  pixelId: "",
};

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
    // Try loading last-submitted template values
    try {
      const lastRaw = localStorage.getItem("template-last-submitted");
      if (lastRaw) {
        const lastForm = JSON.parse(lastRaw);
        setForm({ ...lastForm, name: "", isDefault: false });
      } else {
        setForm(EMPTY_FORM);
      }
    } catch {
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      isDefault: t.isDefault,
      objective: t.objective,
      budgetType: t.budgetType,
      dailyBudget: t.dailyBudget ?? 50,
      ctaType: t.ctaType,
      landingPages: t.landingPages.length > 0 ? t.landingPages : [""],
      optimizationGoal: t.optimizationGoal,
      conversionEvent: t.conversionEvent,
      bidStrategy: t.bidStrategy,
      pixelId: t.pixelId || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        landingPages: form.landingPages.filter(Boolean),
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
      // Save last-submitted for prefilling next create
      try {
        localStorage.setItem("template-last-submitted", JSON.stringify(form));
      } catch { /* ignore */ }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="h-6 w-6 text-cyan-400" />
            Upload Templates
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Full ad configuration presets — select template + batch = done</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all">
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
                  <Link className="h-3 w-3" />
                  {t.landingPages.length} landing page{t.landingPages.length !== 1 ? "s" : ""}
                </div>
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
