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
import { Plus, Trash2, FileText, Type, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Template {
  id: number;
  name: string;
  objective: string;
  budgetType: string;
  dailyBudget: number | null;
  headlines: string[];
  primaryTexts: string[];
  descriptions: string[];
  linkUrl: string | null;
  ctaType: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    objective: "OUTCOME_SALES",
    budgetType: "ABO",
    dailyBudget: 50,
    headlines: [""],
    primaryTexts: [""],
    linkUrl: "",
    ctaType: "SHOP_NOW",
  });

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.data || []);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          headlines: form.headlines.filter(Boolean),
          primaryTexts: form.primaryTexts.filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Template created");
      setDialogOpen(false);
      setForm({ name: "", objective: "OUTCOME_SALES", budgetType: "ABO", dailyBudget: 50, headlines: [""], primaryTexts: [""], linkUrl: "", ctaType: "SHOP_NOW" });
      fetchTemplates();
    } catch {
      toast.error("Failed to create template");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="h-6 w-6 text-cyan-400" />
            Upload Templates
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Reusable ad copy & budget presets</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Template Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden hover:border-white/10 transition-all">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {t.objective.replace("OUTCOME_", "")}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                  {t.budgetType}
                </span>
                {t.dailyBudget && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                    {t.dailyBudget} SEK
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Type className="h-3 w-3" />
                  {t.headlines.length} headline{t.headlines.length !== 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <AlignLeft className="h-3 w-3" />
                  {t.primaryTexts.length} text{t.primaryTexts.length !== 1 ? "s" : ""}
                </div>
              </div>
              {t.linkUrl && (
                <p className="mt-2 truncate text-xs text-slate-600">{t.linkUrl}</p>
              )}
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No templates yet. Create your first template to speed up uploads.
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#111827] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              Create Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Template Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white/5 border-white/10 placeholder:text-slate-600"
                placeholder="e.g. Standard Sales Template"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Objective</label>
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
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Budget Type</label>
                <Select value={form.budgetType} onValueChange={(v) => setForm({ ...form, budgetType: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111827] border-white/10">
                    <SelectItem value="ABO">ABO</SelectItem>
                    <SelectItem value="CBO">CBO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Daily Budget (SEK)</label>
                <Input
                  type="number"
                  value={form.dailyBudget}
                  onChange={(e) => setForm({ ...form, dailyBudget: Number(e.target.value) })}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>

            {/* Headlines */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Headlines</label>
              {form.headlines.map((h, i) => (
                <Input
                  key={i}
                  value={h}
                  onChange={(e) => {
                    const arr = [...form.headlines]; arr[i] = e.target.value;
                    setForm({ ...form, headlines: arr });
                  }}
                  placeholder={`Headline ${i + 1}`}
                  className="bg-white/5 border-white/10 placeholder:text-slate-600"
                />
              ))}
              <button
                onClick={() => setForm({ ...form, headlines: [...form.headlines, ""] })}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Headline
              </button>
            </div>

            {/* Primary Texts */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Primary Texts</label>
              {form.primaryTexts.map((t, i) => (
                <textarea
                  key={i}
                  value={t}
                  onChange={(e) => {
                    const arr = [...form.primaryTexts]; arr[i] = e.target.value;
                    setForm({ ...form, primaryTexts: arr });
                  }}
                  placeholder={`Text ${i + 1}`}
                  rows={2}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
                />
              ))}
              <button
                onClick={() => setForm({ ...form, primaryTexts: [...form.primaryTexts, ""] })}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Text
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Link URL</label>
                <Input
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  className="bg-white/5 border-white/10 placeholder:text-slate-600"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">CTA</label>
                <Select value={form.ctaType} onValueChange={(v) => setForm({ ...form, ctaType: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111827] border-white/10">
                    <SelectItem value="SHOP_NOW">Shop Now</SelectItem>
                    <SelectItem value="LEARN_MORE">Learn More</SelectItem>
                    <SelectItem value="BUY_NOW">Buy Now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
            >
              Create Template
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
