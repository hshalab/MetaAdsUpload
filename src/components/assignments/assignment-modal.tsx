"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, CalendarIcon, Loader2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  EditorAssignment,
  AssignmentPriority,
  ScriptContent,
} from "@/components/assignments/assignment-card";

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

const PRIORITIES: { value: AssignmentPriority; label: string; color: string }[] = [
  { value: "URGENT", label: "Urgent", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "HIGH", label: "High", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "LOW", label: "Low", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
];

/* ───── Inline "Add new" popover ───── */
function AddOptionPopover({
  type,
  label,
  needsCode,
  onCreated,
}: {
  type: string;
  label: string;
  needsCode?: boolean;
  onCreated: (item: OptionItem) => void;
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
      setName("");
      setCode("");
      setOpen(false);
      toast.success(`${label} created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
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
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-7 text-xs bg-white/5 border-white/10"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          {needsCode && (
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code (e.g. SE)"
              className="h-7 text-xs bg-white/5 border-white/10"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          )}
          <Button
            type="button"
            size="sm"
            className="w-full h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
            onClick={handleCreate}
            disabled={saving || !name.trim() || (needsCode && !code.trim())}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───── Compact select ───── */
function OptionSelect({
  value,
  onChange,
  items,
  placeholder,
  label,
  apiType,
  needsCode,
  onOptionsRefresh,
  showCode,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  items: OptionItem[];
  placeholder: string;
  label: string;
  apiType: string;
  needsCode?: boolean;
  onOptionsRefresh: () => void;
  showCode?: boolean;
  required?: boolean;
}) {
  const selectedItem = items.find((i) => i.id === value);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          {label}{required && <span className="text-cyan-400 ml-0.5">*</span>}
        </Label>
        <AddOptionPopover
          type={apiType}
          label={label}
          needsCode={needsCode}
          onCreated={() => onOptionsRefresh()}
        />
      </div>
      <Select value={value || "___none___"} onValueChange={(v) => onChange(v === "___none___" ? "" : v)}>
        <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-xs h-8">
          <span className={!selectedItem ? "text-slate-600" : "text-white"}>
            {selectedItem
              ? showCode && selectedItem.code
                ? `${selectedItem.code} — ${selectedItem.name}`
                : selectedItem.name
              : placeholder}
          </span>
        </SelectTrigger>
        <SelectContent className="bg-[#111827] border-white/10">
          <SelectItem value="___none___" className="text-slate-600 text-xs">— None —</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id} className="text-xs">
              {showCode && item.code ? `${item.code} — ${item.name}` : item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AssignmentModal({
  open,
  onOpenChange,
  assignment,
  onSaved,
}: AssignmentModalProps) {
  const [options, setOptions] = useState<AllOptions | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [showScript, setShowScript] = useState(false);
  const [showAvatars, setShowAvatars] = useState(false);

  const [form, setForm] = useState({
    batchNumber: "",
    version: "1",
    formatId: "",
    angleId: "",
    productId: "",
    countryId: "",
    offerTypeId: "",
    scriptStructureId: "",
    customerAvatars: [] as string[],
    landingPage: "",
    assignedToId: "",
    creativeStrategistId: "",
    priority: "MEDIUM" as AssignmentPriority,
    dueDate: undefined as Date | undefined,
    description: "",
  });

  const [script, setScript] = useState<ScriptContent>({
    hooks: [{ id: "h1", label: "H1", eng: "", se: "" }],
    body: { eng: "", se: "" },
  });

  const fetchOptions = () => fetch("/api/options").then((r) => r.json());

  useEffect(() => {
    if (!open) return;
    setOptionsLoading(true);
    Promise.all([fetchOptions(), fetch("/api/users").then((r) => r.json())])
      .then(([opts, usersData]) => {
        setOptions(opts);
        setUsers(usersData.users || []);
      })
      .catch(console.error)
      .finally(() => setOptionsLoading(false));
  }, [open]);

  useEffect(() => {
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
        customerAvatars: assignment.customerAvatars,
        landingPage: assignment.landingPage || "",
        assignedToId: assignment.assignedToId,
        creativeStrategistId: assignment.creativeStrategistId || "",
        priority: assignment.priority,
        dueDate: assignment.dueDate ? new Date(assignment.dueDate) : undefined,
        description: assignment.description || "",
      });
      if (assignment.scriptContent) {
        setScript(assignment.scriptContent);
        setShowScript(true);
      }
      if (assignment.customerAvatars?.length) setShowAvatars(true);
    } else {
      setForm({
        batchNumber: "",
        version: "1",
        formatId: "",
        angleId: "",
        productId: "",
        countryId: "",
        offerTypeId: "",
        scriptStructureId: "",
        customerAvatars: [],
        landingPage: "",
        assignedToId: "",
        creativeStrategistId: "",
        priority: "MEDIUM",
        dueDate: undefined,
        description: "",
      });
      setScript({ hooks: [{ id: "h1", label: "H1", eng: "", se: "" }], body: { eng: "", se: "" } });
      setShowScript(false);
      setShowAvatars(false);
    }
  }, [assignment, open]);

  const refreshOptions = async () => {
    const opts = await fetchOptions();
    setOptions(opts);
  };

  const editors = users.filter((u) => u.role === "EMPLOYEE" || u.role === "EDITOR");
  const admins = users.filter((u) => u.role === "ADMIN");

  const toggleCustomerAvatar = (avatarId: string) => {
    setForm((prev) => ({
      ...prev,
      customerAvatars: prev.customerAvatars.includes(avatarId)
        ? prev.customerAvatars.filter((a) => a !== avatarId)
        : [...prev.customerAvatars, avatarId],
    }));
  };

  const addHook = () => {
    const num = script.hooks.length + 1;
    setScript((prev) => ({
      ...prev,
      hooks: [...prev.hooks, { id: `h${Date.now()}`, label: `H${num}`, eng: "", se: "" }],
    }));
  };

  const removeHook = (id: string) => {
    setScript((prev) => ({ ...prev, hooks: prev.hooks.filter((h) => h.id !== id) }));
  };

  const updateHook = (id: string, field: "eng" | "se", value: string) => {
    setScript((prev) => ({
      ...prev,
      hooks: prev.hooks.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchNumber || !form.assignedToId) {
      toast.error("Batch number and editor are required");
      return;
    }

    setSaving(true);
    const hasScriptContent =
      script.hooks.some((h) => h.eng || h.se) || script.body.eng || script.body.se;

    const payload = {
      batchNumber: parseInt(form.batchNumber),
      version: parseInt(form.version) || 1,
      formatId: form.formatId || undefined,
      angleId: form.angleId || undefined,
      productId: form.productId || undefined,
      countryId: form.countryId || undefined,
      offerTypeId: form.offerTypeId || undefined,
      scriptStructureId: form.scriptStructureId || undefined,
      customerAvatars: form.customerAvatars,
      landingPage: form.landingPage || undefined,
      assignedToId: form.assignedToId,
      creativeStrategistId: form.creativeStrategistId || undefined,
      priority: form.priority,
      dueDate: form.dueDate ? format(form.dueDate, "yyyy-MM-dd") : undefined,
      description: form.description || undefined,
      scriptContent: hasScriptContent ? script : undefined,
    };

    try {
      const url = assignment ? `/api/assignments/${assignment.id}` : "/api/assignments";
      const method = assignment ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Save failed");
      }
      toast.success(assignment ? "Assignment updated" : "Assignment created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const selectedEditor = users.find((u) => u.id === form.assignedToId);
  const selectedCS = users.find((u) => u.id === form.creativeStrategistId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 bg-[#0d1117] border-white/[0.06] rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/[0.04]">
          <DialogTitle className="text-base font-semibold text-white">
            {assignment ? "Edit Assignment" : "New Assignment"}
          </DialogTitle>
        </DialogHeader>

        {optionsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <ScrollArea className="max-h-[76vh]">
            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5 space-y-5">

              {/* ─── Row 1: Batch + Version + Editor + Priority ─── */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    Batch<span className="text-cyan-400 ml-0.5">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={form.batchNumber}
                    onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                    placeholder="146"
                    required
                    className="h-8 bg-white/[0.03] border-white/[0.06] text-xs"
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">V.</Label>
                  <Input
                    type="number"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    min="1"
                    className="h-8 bg-white/[0.03] border-white/[0.06] text-xs"
                  />
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    Editor<span className="text-cyan-400 ml-0.5">*</span>
                  </Label>
                  <Select
                    value={form.assignedToId || "___none___"}
                    onValueChange={(v) => setForm({ ...form, assignedToId: v === "___none___" ? "" : v })}
                  >
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-xs h-8">
                      <span className={!selectedEditor ? "text-slate-600" : "text-white"}>
                        {selectedEditor?.name || "Select editor..."}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      <SelectItem value="___none___" className="text-slate-600 text-xs">— Select —</SelectItem>
                      {editors.map((e) => (
                        <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                      ))}
                      {admins.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">{a.name} (Admin)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Priority</Label>
                  <div className="flex gap-1">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setForm({ ...form, priority: p.value })}
                        className={cn(
                          "flex-1 h-8 rounded-md border text-[10px] font-medium transition-all",
                          form.priority === p.value
                            ? p.color
                            : "border-white/[0.06] text-slate-600 hover:border-white/10 hover:text-slate-400"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Due</Label>
                  <Popover>
                    <PopoverTrigger
                      className={cn(
                        "flex items-center w-full justify-start text-left h-8 rounded-md border px-2 text-xs bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]",
                        !form.dueDate && "text-slate-600"
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {form.dueDate ? format(form.dueDate, "MMM d") : "Date"}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-[#111827] border-white/10">
                      <Calendar
                        mode="single"
                        selected={form.dueDate}
                        onSelect={(date) => setForm({ ...form, dueDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* ─── Creative Brief ─── */}
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-4 space-y-3">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Creative Brief</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <OptionSelect
                    value={form.countryId}
                    onChange={(v) => setForm({ ...form, countryId: v })}
                    items={options?.countries || []}
                    placeholder="Country..."
                    label="Country"
                    apiType="countries"
                    needsCode
                    showCode
                    onOptionsRefresh={refreshOptions}
                  />
                  <OptionSelect
                    value={form.productId}
                    onChange={(v) => setForm({ ...form, productId: v })}
                    items={options?.products || []}
                    placeholder="Product..."
                    label="Product"
                    apiType="products"
                    needsCode
                    showCode
                    onOptionsRefresh={refreshOptions}
                  />
                  <OptionSelect
                    value={form.formatId}
                    onChange={(v) => setForm({ ...form, formatId: v })}
                    items={options?.formats || []}
                    placeholder="Format..."
                    label="Format"
                    apiType="formats"
                    onOptionsRefresh={refreshOptions}
                  />
                  <OptionSelect
                    value={form.angleId}
                    onChange={(v) => setForm({ ...form, angleId: v })}
                    items={options?.angles || []}
                    placeholder="Angle..."
                    label="Angle"
                    apiType="angles"
                    onOptionsRefresh={refreshOptions}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <OptionSelect
                    value={form.offerTypeId}
                    onChange={(v) => setForm({ ...form, offerTypeId: v })}
                    items={options?.offerTypes || []}
                    placeholder="Offer type..."
                    label="Offer Type"
                    apiType="offer-types"
                    onOptionsRefresh={refreshOptions}
                  />
                  <OptionSelect
                    value={form.scriptStructureId}
                    onChange={(v) => setForm({ ...form, scriptStructureId: v })}
                    items={options?.scriptStructures || []}
                    placeholder="Structure..."
                    label="Script Structure"
                    apiType="script-structures"
                    onOptionsRefresh={refreshOptions}
                  />
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Landing Page</Label>
                    <Input
                      value={form.landingPage}
                      onChange={(e) => setForm({ ...form, landingPage: e.target.value })}
                      placeholder="LP, LP3..."
                      className="h-8 bg-white/[0.03] border-white/[0.06] text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Creative Strategist</Label>
                    <Select
                      value={form.creativeStrategistId || "___none___"}
                      onValueChange={(v) => setForm({ ...form, creativeStrategistId: v === "___none___" ? "" : v })}
                    >
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-xs h-8">
                        <span className={!selectedCS ? "text-slate-600" : "text-white"}>
                          {selectedCS?.name || "Select..."}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        <SelectItem value="___none___" className="text-slate-600 text-xs">— None —</SelectItem>
                        {admins.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ─── Description ─── */}
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Notes / Instructions
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Anything the editor needs to know..."
                  className="bg-white/[0.03] border-white/[0.06] text-xs resize-none"
                />
              </div>

              {/* ─── Customer Avatars (collapsible) ─── */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAvatars(!showAvatars)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showAvatars && "rotate-180")} />
                  Customer Avatars
                  {form.customerAvatars.length > 0 && (
                    <span className="text-cyan-400 normal-case">({form.customerAvatars.length})</span>
                  )}
                </button>
                {showAvatars && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {options?.customerAvatars.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => toggleCustomerAvatar(avatar.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-all",
                          form.customerAvatars.includes(avatar.id)
                            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                            : "border-white/[0.06] text-slate-500 hover:border-white/10 hover:text-slate-300"
                        )}
                      >
                        <Checkbox
                          checked={form.customerAvatars.includes(avatar.id)}
                          className="pointer-events-none h-3 w-3"
                        />
                        {avatar.code ? `${avatar.code}` : avatar.name}
                      </button>
                    ))}
                    <AddOptionPopover
                      type="customer-avatars"
                      label="Avatar"
                      needsCode
                      onCreated={() => refreshOptions()}
                    />
                  </div>
                )}
              </div>

              {/* ─── Script (collapsible) ─── */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowScript(!showScript)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showScript && "rotate-180")} />
                  Script
                  {script.hooks.some((h) => h.eng || h.se) && (
                    <span className="text-emerald-400 normal-case">({script.hooks.filter(h => h.eng || h.se).length} hooks)</span>
                  )}
                </button>
                {showScript && (
                  <div className="mt-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-4 space-y-3">
                    {/* Headers */}
                    <div className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 text-[9px] font-medium text-slate-600 uppercase tracking-wider">
                      <div />
                      <div>English</div>
                      <div>Svenska</div>
                      <div />
                    </div>

                    {/* Hooks */}
                    {script.hooks.map((hook) => (
                      <div key={hook.id} className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 items-center">
                        <span className="text-[10px] font-bold text-slate-500 text-center">{hook.label}</span>
                        <Input
                          value={hook.eng}
                          onChange={(e) => updateHook(hook.id, "eng", e.target.value)}
                          placeholder="English hook..."
                          className="h-7 text-xs bg-white/[0.03] border-white/[0.06]"
                        />
                        <Input
                          value={hook.se}
                          onChange={(e) => updateHook(hook.id, "se", e.target.value)}
                          placeholder="Svensk hook..."
                          className="h-7 text-xs bg-white/[0.03] border-white/[0.06]"
                        />
                        <button
                          type="button"
                          className="h-7 w-7 flex items-center justify-center rounded text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          onClick={() => removeHook(hook.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {/* Add hook */}
                    <button
                      type="button"
                      onClick={addHook}
                      className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-cyan-400 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add hook
                    </button>

                    {/* Body */}
                    <div className="border-t border-white/[0.04] pt-3">
                      <div className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 items-start">
                        <span className="text-[10px] font-bold text-slate-500 text-center pt-2">Body</span>
                        <Textarea
                          value={script.body.eng}
                          onChange={(e) => setScript({ ...script, body: { ...script.body, eng: e.target.value } })}
                          placeholder="English body..."
                          rows={3}
                          className="text-xs bg-white/[0.03] border-white/[0.06] resize-none"
                        />
                        <Textarea
                          value={script.body.se}
                          onChange={(e) => setScript({ ...script, body: { ...script.body, se: e.target.value } })}
                          placeholder="Svensk brodtext..."
                          rows={3}
                          className="text-xs bg-white/[0.03] border-white/[0.06] resize-none"
                        />
                        <div />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Submit ─── */}
              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.04]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06] text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 px-5"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  {saving ? "Saving..." : assignment ? "Update" : "Create Assignment"}
                </Button>
              </div>
            </form>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
