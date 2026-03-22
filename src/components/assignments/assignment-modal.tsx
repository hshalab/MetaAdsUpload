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
import { Plus, Trash2, CalendarIcon, Loader2 } from "lucide-react";
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

const PRIORITIES: { value: AssignmentPriority; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
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
        className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all shrink-0"
        title={`Add new ${label.toLowerCase()}`}
      >
        <Plus className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-[#111827] border-white/10 p-3" align="end">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
          New {label}
        </p>
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-8 text-sm bg-white/5 border-white/10"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          {needsCode && (
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code (e.g. SE, GH)"
              className="h-8 text-sm bg-white/5 border-white/10"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          )}
          <Button
            type="button"
            size="sm"
            className="w-full h-8 bg-cyan-600 hover:bg-cyan-500 text-white"
            onClick={handleCreate}
            disabled={saving || !name.trim() || (needsCode && !code.trim())}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───── Select with display name fix + add button ───── */
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
}) {
  const selectedItem = items.find((i) => i.id === value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        {label}
      </Label>
      <div className="flex gap-1.5">
        <Select value={value || "___none___"} onValueChange={(v) => onChange(v === "___none___" ? "" : v)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-sm h-9">
            <span className={!selectedItem ? "text-slate-500" : "text-white"}>
              {selectedItem
                ? showCode && selectedItem.code
                  ? `${selectedItem.name} (${selectedItem.code})`
                  : selectedItem.name
                : placeholder}
            </span>
          </SelectTrigger>
          <SelectContent className="bg-[#111827] border-white/10">
            <SelectItem value="___none___" className="text-slate-500">
              -- None --
            </SelectItem>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {showCode && item.code ? `${item.name} (${item.code})` : item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AddOptionPopover
          type={apiType}
          label={label}
          needsCode={needsCode}
          onCreated={() => onOptionsRefresh()}
        />
      </div>
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
    hooks: [
      { id: "h1", label: "H1", eng: "", se: "" },
      { id: "h2", label: "H2", eng: "", se: "" },
      { id: "h3", label: "H3", eng: "", se: "" },
      { id: "h4", label: "H4", eng: "", se: "" },
    ],
    body: { eng: "", se: "" },
  });

  const fetchOptions = () => {
    return fetch("/api/options").then((r) => r.json());
  };

  // Fetch options and users
  useEffect(() => {
    if (!open) return;
    setOptionsLoading(true);

    Promise.all([
      fetchOptions(),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([opts, usersData]) => {
        setOptions(opts);
        setUsers(usersData.users || []);
      })
      .catch(console.error)
      .finally(() => setOptionsLoading(false));
  }, [open]);

  // Populate form when editing
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
      }
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
      setScript({
        hooks: [
          { id: "h1", label: "H1", eng: "", se: "" },
          { id: "h2", label: "H2", eng: "", se: "" },
          { id: "h3", label: "H3", eng: "", se: "" },
          { id: "h4", label: "H4", eng: "", se: "" },
        ],
        body: { eng: "", se: "" },
      });
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
    setScript((prev) => ({
      ...prev,
      hooks: prev.hooks.filter((h) => h.id !== id),
    }));
  };

  const updateHook = (id: string, field: "eng" | "se", value: string) => {
    setScript((prev) => ({
      ...prev,
      hooks: prev.hooks.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchNumber || !form.assignedToId) return;

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
      if (!res.ok) throw new Error("Save failed");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const selectedEditor = users.find((u) => u.id === form.assignedToId);
  const selectedCS = users.find((u) => u.id === form.creativeStrategistId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 bg-[#111827] border-white/10">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-white/5">
          <DialogTitle className="text-lg text-white">
            {assignment ? "Edit Assignment" : "Create New Assignment"}
          </DialogTitle>
        </DialogHeader>

        {optionsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : (
          <ScrollArea className="max-h-[78vh]">
            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-6">

              {/* ─── Row 1: Batch, Version, Format ─── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Batch # *
                  </Label>
                  <Input
                    type="number"
                    value={form.batchNumber}
                    onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                    placeholder="e.g. 146"
                    required
                    className="h-9 bg-white/5 border-white/10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Version
                  </Label>
                  <Input
                    type="number"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    min="1"
                    className="h-9 bg-white/5 border-white/10 text-sm"
                  />
                </div>
                <OptionSelect
                  value={form.formatId}
                  onChange={(v) => setForm({ ...form, formatId: v })}
                  items={options?.formats || []}
                  placeholder="Select format..."
                  label="Format"
                  apiType="formats"
                  onOptionsRefresh={refreshOptions}
                />
                <OptionSelect
                  value={form.scriptStructureId}
                  onChange={(v) => setForm({ ...form, scriptStructureId: v })}
                  items={options?.scriptStructures || []}
                  placeholder="Select structure..."
                  label="Script Structure"
                  apiType="script-structures"
                  onOptionsRefresh={refreshOptions}
                />
              </div>

              {/* ─── Row 2: Country, Product, Offer Type, Angle ─── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <OptionSelect
                  value={form.countryId}
                  onChange={(v) => setForm({ ...form, countryId: v })}
                  items={options?.countries || []}
                  placeholder="Select country..."
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
                  placeholder="Select product..."
                  label="Product"
                  apiType="products"
                  needsCode
                  showCode
                  onOptionsRefresh={refreshOptions}
                />
                <OptionSelect
                  value={form.offerTypeId}
                  onChange={(v) => setForm({ ...form, offerTypeId: v })}
                  items={options?.offerTypes || []}
                  placeholder="Select offer type..."
                  label="Offer Type"
                  apiType="offer-types"
                  onOptionsRefresh={refreshOptions}
                />
                <OptionSelect
                  value={form.angleId}
                  onChange={(v) => setForm({ ...form, angleId: v })}
                  items={options?.angles || []}
                  placeholder="Select angle..."
                  label="Angle"
                  apiType="angles"
                  onOptionsRefresh={refreshOptions}
                />
              </div>

              {/* ─── Landing Page ─── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Landing Page
                </Label>
                <Input
                  value={form.landingPage}
                  onChange={(e) => setForm({ ...form, landingPage: e.target.value })}
                  placeholder="e.g. LP, LP3, etc."
                  className="h-9 bg-white/5 border-white/10 text-sm max-w-sm"
                />
              </div>

              {/* ─── Customer Avatars ─── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Customer Avatars
                  </Label>
                  <AddOptionPopover
                    type="customer-avatars"
                    label="Avatar"
                    needsCode
                    onCreated={() => refreshOptions()}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {options?.customerAvatars.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => toggleCustomerAvatar(avatar.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all",
                        form.customerAvatars.includes(avatar.id)
                          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                          : "border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5"
                      )}
                    >
                      <Checkbox
                        checked={form.customerAvatars.includes(avatar.id)}
                        className="pointer-events-none"
                      />
                      {avatar.code} - {avatar.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── People & Scheduling ─── */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  People & Scheduling
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Editor */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Editor *
                    </Label>
                    <Select
                      value={form.assignedToId || "___none___"}
                      onValueChange={(v) => setForm({ ...form, assignedToId: v === "___none___" ? "" : v })}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-sm h-9">
                        <span className={!selectedEditor ? "text-slate-500" : "text-white"}>
                          {selectedEditor?.name || "Select editor..."}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        <SelectItem value="___none___" className="text-slate-500">
                          -- Select --
                        </SelectItem>
                        {editors.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                        {admins.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} (Admin)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CS */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Creative Strategist
                    </Label>
                    <Select
                      value={form.creativeStrategistId || "___none___"}
                      onValueChange={(v) => setForm({ ...form, creativeStrategistId: v === "___none___" ? "" : v })}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-sm h-9">
                        <span className={!selectedCS ? "text-slate-500" : "text-white"}>
                          {selectedCS?.name || "Select strategist..."}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        <SelectItem value="___none___" className="text-slate-500">
                          -- None --
                        </SelectItem>
                        {admins.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Priority
                    </Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v as AssignmentPriority })}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Due Date
                    </Label>
                    <Popover>
                      <PopoverTrigger
                        className={cn(
                          "flex items-center w-full justify-start text-left font-normal h-9 rounded-md border px-3 text-sm bg-white/5 border-white/10 hover:bg-white/10",
                          !form.dueDate && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {form.dueDate ? format(form.dueDate, "yyyy-MM-dd") : "Pick a date"}
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
              </div>

              {/* ─── Description ─── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Description / Notes
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Any additional notes..."
                  className="bg-white/5 border-white/10 text-sm resize-none"
                />
              </div>

              {/* ─── Script Editor ─── */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Script Content
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addHook}
                    className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Hook
                  </Button>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  <div className="col-span-1" />
                  <div className="col-span-5 pl-1">English</div>
                  <div className="col-span-5 pl-1">Svenska</div>
                  <div className="col-span-1" />
                </div>

                <div className="space-y-2">
                  {script.hooks.map((hook) => (
                    <div key={hook.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-1 flex items-center justify-center pt-2">
                        <span className="text-xs font-semibold text-slate-500">
                          {hook.label}
                        </span>
                      </div>
                      <div className="col-span-5">
                        <Input
                          value={hook.eng}
                          onChange={(e) => updateHook(hook.id, "eng", e.target.value)}
                          placeholder="English hook"
                          className="h-8 text-sm bg-white/5 border-white/10"
                        />
                      </div>
                      <div className="col-span-5">
                        <Input
                          value={hook.se}
                          onChange={(e) => updateHook(hook.id, "se", e.target.value)}
                          placeholder="Svensk hook"
                          className="h-8 text-sm bg-white/5 border-white/10"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pt-0.5">
                        {script.hooks.length > 1 && (
                          <button
                            type="button"
                            className="h-8 w-8 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            onClick={() => removeHook(hook.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Body */}
                  <div className="border-t border-white/5 pt-2">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-1 flex items-center justify-center pt-2">
                        <span className="text-xs font-semibold text-slate-500">Body</span>
                      </div>
                      <div className="col-span-5">
                        <Textarea
                          value={script.body.eng}
                          onChange={(e) =>
                            setScript({ ...script, body: { ...script.body, eng: e.target.value } })
                          }
                          placeholder="English body text"
                          rows={3}
                          className="text-sm bg-white/5 border-white/10 resize-none"
                        />
                      </div>
                      <div className="col-span-5">
                        <Textarea
                          value={script.body.se}
                          onChange={(e) =>
                            setScript({ ...script, body: { ...script.body, se: e.target.value } })
                          }
                          placeholder="Svensk brodtext"
                          rows={3}
                          className="text-sm bg-white/5 border-white/10 resize-none"
                        />
                      </div>
                      <div className="col-span-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Submit ─── */}
              <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
                >
                  {saving
                    ? "Saving..."
                    : assignment
                      ? "Update Assignment"
                      : "Create Assignment"}
                </Button>
              </div>
            </form>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
