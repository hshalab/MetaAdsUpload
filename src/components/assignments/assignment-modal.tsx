"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, CalendarIcon, Loader2, ChevronDown, Save, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  EditorAssignment,
  AssignmentPriority,
  ScriptContent,
} from "@/components/assignments/assignment-card";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OptionItem {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  isActive?: boolean;
}

interface AllOptions {
  angles: OptionItem[];
  products: OptionItem[];
  formats: OptionItem[];
  countries: OptionItem[];
  offerTypes: OptionItem[];
  customerAvatars: OptionItem[];
  scriptStructures: OptionItem[];
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface AssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: EditorAssignment | null;
  onSaved: () => void;
}

interface FormState {
  batchNumber: string;
  version: string;
  formatId: string;
  angleId: string;
  productId: string;
  countryId: string;
  offerTypeId: string;
  scriptStructureId: string;
  customerAvatarIds: string[];
  landingPage: string;
  assignedToId: string;
  creativeStrategistId: string;
  priority: AssignmentPriority;
  dueDate: string | undefined;
  description: string;
}

const PRIORITIES: { value: AssignmentPriority; label: string; color: string }[] = [
  { value: "URGENT", label: "Urgent", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "HIGH", label: "High", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "LOW", label: "Low", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
];

const DRAFT_KEY_PREFIX = "assignment-draft";

function getDraftKey(assignmentId?: string | null) {
  return assignmentId ? `${DRAFT_KEY_PREFIX}-${assignmentId}` : `${DRAFT_KEY_PREFIX}-new`;
}

function saveDraft(key: string, form: FormState, script: ScriptContent) {
  try {
    localStorage.setItem(key, JSON.stringify({ form, script, savedAt: Date.now() }));
  } catch { /* quota exceeded, ignore */ }
}

function loadDraft(key: string): { form: FormState; script: ScriptContent; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard drafts older than 24h
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function clearDraft(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

const emptyForm: FormState = {
  batchNumber: "",
  version: "1",
  formatId: "",
  angleId: "",
  productId: "",
  countryId: "",
  offerTypeId: "",
  scriptStructureId: "",
  customerAvatarIds: [],
  landingPage: "",
  assignedToId: "",
  creativeStrategistId: "",
  priority: "MEDIUM",
  dueDate: undefined,
  description: "",
};

const emptyScript: ScriptContent = {
  hooks: [{ id: "h1", label: "H1", eng: "", se: "" }],
  body: { eng: "", se: "" },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function AddOptionPopover({
  type, label, needsCode, onCreated,
}: {
  type: string; label: string; needsCode?: boolean; onCreated: (item: OptionItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (needsCode && !code.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, string> = { name: name.trim() };
      if (needsCode) body.code = code.trim();
      const res = await fetch(`/api/options/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      const item = await res.json();
      onCreated(item);
      setName(""); setCode(""); setOpen(false);
      toast.success(`${label} created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally { setSaving(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="h-7 w-7 rounded-md border border-dashed border-white/10 flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all shrink-0"
        title={`Add new ${label.toLowerCase()}`}
      >
        <Plus className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-[#111827] border-white/10 p-3" align="end">
        <p className="text-xs font-medium text-slate-400 mb-2">New {label}</p>
        <div className="space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            className="h-7 text-xs bg-white/5 border-white/10" autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          {needsCode && (
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. SE)"
              className="h-7 text-xs bg-white/5 border-white/10"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          )}
          <Button type="button" size="sm" className="w-full h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
            onClick={handleCreate} disabled={saving || !name.trim() || (needsCode && !code.trim())}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OptionSelect({
  value, onChange, items, placeholder, label, apiType, needsCode,
  onOptionsRefresh, showCode, required,
}: {
  value: string; onChange: (v: string) => void; items: OptionItem[];
  placeholder: string; label: string; apiType: string; needsCode?: boolean;
  onOptionsRefresh: () => void; showCode?: boolean; required?: boolean;
}) {
  const selectedItem = items.find((i) => i.id === value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}{required && <span className="text-cyan-400 ml-0.5">*</span>}
        </Label>
        <AddOptionPopover type={apiType} label={label} needsCode={needsCode}
          onCreated={() => onOptionsRefresh()} />
      </div>
      <Select value={value || "___none___"} onValueChange={(v) => onChange(v === "___none___" ? "" : v)}>
        <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-sm h-10">
          <span className={!selectedItem ? "text-slate-600" : "text-white"}>
            {selectedItem
              ? showCode && selectedItem.code ? `${selectedItem.code} — ${selectedItem.name}` : selectedItem.name
              : placeholder}
          </span>
        </SelectTrigger>
        <SelectContent className="bg-[#111827] border-white/10">
          <SelectItem value="___none___" className="text-slate-600">— None —</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {showCode && item.code ? `${item.code} — ${item.name}` : item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AssignmentModal({ open, onOpenChange, assignment, onSaved }: AssignmentModalProps) {
  const [options, setOptions] = useState<AllOptions | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [showAvatars, setShowAvatars] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [script, setScript] = useState<ScriptContent>(emptyScript);

  const draftKey = getDraftKey(assignment?.id);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  const scriptRef = useRef(script);
  formRef.current = form;
  scriptRef.current = script;

  // ─── Auto-save draft to localStorage ───
  const scheduleDraftSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraft(draftKey, formRef.current, scriptRef.current);
    }, 500);
  }, [draftKey]);

  // Update form with auto-save
  const updateForm = useCallback((updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    scheduleDraftSave();
  }, [scheduleDraftSave]);

  const updateScript = useCallback((updater: (prev: ScriptContent) => ScriptContent) => {
    setScript((prev) => {
      const next = updater(prev);
      return next;
    });
    scheduleDraftSave();
  }, [scheduleDraftSave]);

  // ─── Fetch options + users ───
  const fetchOptions = () => fetch("/api/options").then((r) => r.json());

  useEffect(() => {
    if (!open) return;
    setOptionsLoading(true);
    Promise.all([fetchOptions(), fetch("/api/users").then((r) => r.json())])
      .then(([opts, usersData]) => { setOptions(opts); setUsers(usersData.users || []); })
      .catch(console.error)
      .finally(() => setOptionsLoading(false));
  }, [open]);

  // ─── Initialize form state ───
  useEffect(() => {
    if (!open) return;

    if (assignment) {
      setForm({
        batchNumber: assignment.batchNumber.toString(),
        version: assignment.version.toString(),
        formatId: assignment.formatId || "",
        angleId: assignment.angleId || "",
        productId: assignment.productId || "",
        countryId: assignment.countryId || "",
        offerTypeId: assignment.offerTypeId || "",
        scriptStructureId: assignment.scriptStructureId || "",
        customerAvatarIds: assignment.customerAvatars || [],
        landingPage: assignment.landingPage || "",
        assignedToId: assignment.assignedToId,
        creativeStrategistId: assignment.creativeStrategistId || "",
        priority: assignment.priority,
        dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString() : undefined,
        description: assignment.description || "",
      });
      if (assignment.scriptContent) {
        setScript(assignment.scriptContent);
      } else {
        setScript({ ...emptyScript, hooks: [{ id: "h1", label: "H1", eng: "", se: "" }] });
      }
      if (assignment.customerAvatars?.length) setShowAvatars(true);
    } else {
      // New assignment — try restoring draft
      const draft = loadDraft(getDraftKey(null));
      if (draft) {
        setForm(draft.form);
        setScript(draft.script);
        setDraftRestored(true);
        if (draft.form.customerAvatarIds?.length) setShowAvatars(true);
        toast.info("Draft restored", { description: "Your previous unsaved work was recovered." });
      } else {
        setForm({ ...emptyForm });
        setScript({ ...emptyScript, hooks: [{ id: "h1", label: "H1", eng: "", se: "" }] });
        setDraftRestored(false);
      }
    }
  }, [assignment, open]);

  // ─── Cleanup timer on unmount ───
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const refreshOptions = async () => { const opts = await fetchOptions(); setOptions(opts); };

  const editors = users.filter((u) => u.role === "EMPLOYEE" || u.role === "EDITOR");
  const admins = users.filter((u) => u.role === "ADMIN");
  const selectedEditor = users.find((u) => u.id === form.assignedToId);
  const selectedCS = users.find((u) => u.id === form.creativeStrategistId);

  // ─── Hook helpers ───
  const addHook = () => {
    const num = script.hooks.length + 1;
    updateScript((prev) => ({
      ...prev,
      hooks: [...prev.hooks, { id: `h${Date.now()}`, label: `H${num}`, eng: "", se: "" }],
    }));
  };

  const removeHook = (id: string) => {
    updateScript((prev) => ({ ...prev, hooks: prev.hooks.filter((h) => h.id !== id) }));
  };

  const updateHook = (id: string, field: "eng" | "se", value: string) => {
    updateScript((prev) => ({
      ...prev,
      hooks: prev.hooks.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    }));
  };

  const toggleCustomerAvatar = (avatarId: string) => {
    updateForm({
      customerAvatarIds: form.customerAvatarIds.includes(avatarId)
        ? form.customerAvatarIds.filter((a) => a !== avatarId)
        : [...form.customerAvatarIds, avatarId],
    });
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!form.batchNumber || !form.assignedToId) {
      toast.error("Batch number and editor are required");
      return;
    }

    setSaving(true);
    const hasScriptContent = script.hooks.some((h) => h.eng || h.se) || script.body.eng || script.body.se;

    const payload = {
      batchNumber: parseInt(form.batchNumber),
      version: parseInt(form.version) || 1,
      formatId: form.formatId || undefined,
      angleId: form.angleId || undefined,
      productId: form.productId || undefined,
      countryId: form.countryId || undefined,
      offerTypeId: form.offerTypeId || undefined,
      scriptStructureId: form.scriptStructureId || undefined,
      customerAvatarIds: form.customerAvatarIds,
      landingPage: form.landingPage || undefined,
      assignedToId: form.assignedToId,
      creativeStrategistId: form.creativeStrategistId || undefined,
      priority: form.priority,
      dueDate: form.dueDate ? format(new Date(form.dueDate), "yyyy-MM-dd") : undefined,
      description: form.description || undefined,
      scriptContent: hasScriptContent ? script : undefined,
    };

    try {
      const url = assignment ? `/api/assignments/${assignment.id}` : "/api/assignments";
      const method = assignment ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Save failed");
      }
      toast.success(assignment ? "Assignment updated" : "Assignment created");
      clearDraft(draftKey);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  // ─── Keyboard shortcut: Cmd+Enter to save ───
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ─── Handle close with confirmation ───
  const handleClose = () => {
    // Draft is already auto-saved, just close
    onOpenChange(false);
  };

  if (!open) return null;

  // ─── Render ───
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal — bypassing the base Dialog entirely to avoid grid/overflow issues */}
      <div className="absolute inset-3 flex items-stretch justify-center">
        <div className="relative w-full bg-[#0d1117] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onPointerDown={(e) => e.stopPropagation()}>

          {/* ─── Header ─── */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {assignment ? "Edit Assignment" : "New Assignment"}
              </h2>
              {draftRestored && !assignment && (
                <p className="text-xs text-cyan-400/70 mt-0.5">Draft restored from previous session</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-600">
                {"\u2318"}+Enter to save
              </span>
              <Button type="button" variant="outline" onClick={handleClose}
                className="bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06] h-9 px-4 text-sm">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}
                className="bg-cyan-600 hover:bg-cyan-500 text-white h-9 px-6 text-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? "Saving..." : assignment ? "Update" : "Create Assignment"}
              </Button>
            </div>
          </div>

          {/* ─── Body ─── */}
          {optionsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-8 py-6 space-y-8">

                {/* ─── Top Row: Key Fields ─── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Batch */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Batch<span className="text-cyan-400 ml-0.5">*</span>
                    </Label>
                    <Input type="number" value={form.batchNumber}
                      onChange={(e) => updateForm({ batchNumber: e.target.value })}
                      placeholder="146" className="h-10 bg-white/[0.03] border-white/[0.06] text-sm" />
                  </div>
                  {/* Version */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Version</Label>
                    <Input type="number" value={form.version}
                      onChange={(e) => updateForm({ version: e.target.value })}
                      min="1" className="h-10 bg-white/[0.03] border-white/[0.06] text-sm" />
                  </div>
                  {/* Editor */}
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Editor<span className="text-cyan-400 ml-0.5">*</span>
                    </Label>
                    <Select value={form.assignedToId || "___none___"}
                      onValueChange={(v) => updateForm({ assignedToId: v === "___none___" ? "" : v })}>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-sm h-10">
                        <span className={!selectedEditor ? "text-slate-600" : "text-white"}>
                          {selectedEditor?.name || "Select editor..."}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        <SelectItem value="___none___" className="text-slate-600">— Select —</SelectItem>
                        {editors.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} (Admin)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Priority */}
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PRIORITIES.map((p) => (
                        <button key={p.value} type="button"
                          onClick={() => updateForm({ priority: p.value })}
                          className={cn(
                            "h-10 rounded-lg border text-sm font-medium transition-all",
                            form.priority === p.value ? p.color
                              : "border-white/[0.06] text-slate-600 hover:border-white/10 hover:text-slate-400"
                          )}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ─── Two-column: Creative Brief + Sidebar ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

                  {/* ─── Left: Creative Brief ─── */}
                  <div className="space-y-6">
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Creative Brief</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <OptionSelect value={form.countryId} onChange={(v) => updateForm({ countryId: v })}
                          items={options?.countries || []} placeholder="Select country..."
                          label="Country" apiType="countries" needsCode showCode onOptionsRefresh={refreshOptions} />
                        <OptionSelect value={form.productId} onChange={(v) => updateForm({ productId: v })}
                          items={options?.products || []} placeholder="Select product..."
                          label="Product" apiType="products" needsCode showCode onOptionsRefresh={refreshOptions} />
                        <OptionSelect value={form.formatId} onChange={(v) => updateForm({ formatId: v })}
                          items={options?.formats || []} placeholder="Select format..."
                          label="Format" apiType="formats" onOptionsRefresh={refreshOptions} />
                        <OptionSelect value={form.angleId} onChange={(v) => updateForm({ angleId: v })}
                          items={options?.angles || []} placeholder="Select angle..."
                          label="Angle" apiType="angles" onOptionsRefresh={refreshOptions} />
                        <OptionSelect value={form.offerTypeId} onChange={(v) => updateForm({ offerTypeId: v })}
                          items={options?.offerTypes || []} placeholder="Select offer type..."
                          label="Offer Type" apiType="offer-types" onOptionsRefresh={refreshOptions} />
                        <OptionSelect value={form.scriptStructureId} onChange={(v) => updateForm({ scriptStructureId: v })}
                          items={options?.scriptStructures || []} placeholder="Select structure..."
                          label="Script Structure" apiType="script-structures" onOptionsRefresh={refreshOptions} />
                      </div>
                    </div>

                    {/* ─── Script Editor — Always visible ─── */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Script
                          {script.hooks.filter(h => h.eng || h.se).length > 0 && (
                            <span className="text-emerald-400 ml-2 normal-case font-normal">
                              ({script.hooks.filter(h => h.eng || h.se).length} hooks)
                            </span>
                          )}
                        </h3>
                        <button type="button" onClick={addHook}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors px-2.5 py-1.5 rounded-lg border border-dashed border-white/[0.08] hover:border-cyan-500/30">
                          <Plus className="h-3.5 w-3.5" /> Add hook
                        </button>
                      </div>

                      {/* Column Headers */}
                      <div className="grid grid-cols-[40px_1fr_1fr_36px] gap-3 text-[10px] font-medium text-slate-600 uppercase tracking-wider px-1">
                        <div />
                        <div>English</div>
                        <div>Swedish</div>
                        <div />
                      </div>

                      {/* Hooks — native inputs to bypass Base UI focus issues */}
                      <div className="space-y-2">
                        {script.hooks.map((hook) => (
                          <div key={hook.id} className="grid grid-cols-[40px_1fr_1fr_36px] gap-3 items-center">
                            <span className="text-xs font-bold text-slate-500 text-center bg-white/[0.03] rounded py-2">
                              {hook.label}
                            </span>
                            <input
                              type="text"
                              value={hook.eng}
                              onChange={(e) => updateHook(hook.id, "eng", e.target.value)}
                              placeholder="English hook..."
                              className="h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                            />
                            <input
                              type="text"
                              value={hook.se}
                              onChange={(e) => updateHook(hook.id, "se", e.target.value)}
                              placeholder="Svensk hook..."
                              className="h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                            />
                            <button type="button"
                              className="h-10 w-9 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              onClick={() => removeHook(hook.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Body — native textareas */}
                      <div className="border-t border-white/[0.04] pt-4">
                        <div className="grid grid-cols-[40px_1fr_1fr_36px] gap-3 text-[10px] font-medium text-slate-600 uppercase tracking-wider px-1 mb-2">
                          <div />
                          <div>English body</div>
                          <div>Swedish body</div>
                          <div />
                        </div>
                        <div className="grid grid-cols-[40px_1fr_1fr_36px] gap-3">
                          <div className="flex items-start justify-center pt-2.5">
                            <span className="text-xs font-bold text-slate-500">Body</span>
                          </div>
                          <textarea
                            value={script.body.eng}
                            onChange={(e) => updateScript((prev) => ({ ...prev, body: { ...prev.body, eng: e.target.value } }))}
                            placeholder="English body text..."
                            rows={4}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none transition-colors"
                          />
                          <textarea
                            value={script.body.se}
                            onChange={(e) => updateScript((prev) => ({ ...prev, body: { ...prev.body, se: e.target.value } }))}
                            placeholder="Svensk brodtext..."
                            rows={4}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none transition-colors"
                          />
                          <div />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ─── Right Sidebar ─── */}
                  <div className="space-y-6">
                    {/* Due Date */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-3">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Due Date</Label>
                      <Popover>
                        <PopoverTrigger className={cn(
                          "flex items-center w-full justify-start text-left h-10 rounded-lg border px-3 text-sm bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]",
                          !form.dueDate && "text-slate-600"
                        )}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.dueDate ? format(new Date(form.dueDate), "d MMM yyyy") : "Pick a date..."}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#111827] border-white/10">
                          <Calendar mode="single"
                            selected={form.dueDate ? new Date(form.dueDate) : undefined}
                            onSelect={(date) => updateForm({ dueDate: date ? date.toISOString() : undefined })}
                            initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Landing Page + Creative Strategist */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Landing Page</Label>
                        <Input value={form.landingPage}
                          onChange={(e) => updateForm({ landingPage: e.target.value })}
                          placeholder="LP, LP3..."
                          className="h-10 bg-white/[0.03] border-white/[0.06] text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Creative Strategist</Label>
                        <Select value={form.creativeStrategistId || "___none___"}
                          onValueChange={(v) => updateForm({ creativeStrategistId: v === "___none___" ? "" : v })}>
                          <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-sm h-10">
                            <span className={!selectedCS ? "text-slate-600" : "text-white"}>
                              {selectedCS?.name || "Select..."}
                            </span>
                          </SelectTrigger>
                          <SelectContent className="bg-[#111827] border-white/10">
                            <SelectItem value="___none___" className="text-slate-600">— None —</SelectItem>
                            {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-3">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notes / Instructions</Label>
                      <Textarea value={form.description}
                        onChange={(e) => updateForm({ description: e.target.value })}
                        rows={4} placeholder="Anything the editor needs to know..."
                        className="bg-white/[0.03] border-white/[0.06] text-sm resize-none" />
                    </div>

                    {/* Customer Avatars */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-3">
                      <button type="button" onClick={() => setShowAvatars(!showAvatars)}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors w-full">
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAvatars && "rotate-180")} />
                        Customer Avatars
                        {form.customerAvatarIds.length > 0 && (
                          <span className="text-cyan-400 normal-case font-normal">({form.customerAvatarIds.length})</span>
                        )}
                      </button>
                      {showAvatars && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {options?.customerAvatars.map((avatar) => (
                            <button key={avatar.id} type="button" onClick={() => toggleCustomerAvatar(avatar.id)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                                form.customerAvatarIds.includes(avatar.id)
                                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                                  : "border-white/[0.06] text-slate-500 hover:border-white/10 hover:text-slate-300"
                              )}>
                              <Checkbox checked={form.customerAvatarIds.includes(avatar.id)}
                                className="pointer-events-none h-4 w-4" />
                              {avatar.code ? `${avatar.code} — ${avatar.name}` : avatar.name}
                            </button>
                          ))}
                          <AddOptionPopover type="customer-avatars" label="Avatar" needsCode
                            onCreated={() => refreshOptions()} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Close button */}
          <button onClick={handleClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
