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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
    customerAvatars: [] as string[],
    landingPage: "",
    assignedToId: "",
    creativeStrategistId: "",
    priority: "MEDIUM" as AssignmentPriority,
    dueDate: undefined as Date | undefined,
    estimatedMinutes: "",
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

  // Fetch options and users
  useEffect(() => {
    if (!open) return;
    setOptionsLoading(true);

    Promise.all([
      fetch("/api/options").then((r) => r.json()),
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
        customerAvatars: assignment.customerAvatars,
        landingPage: assignment.landingPage || "",
        assignedToId: assignment.assignedToId,
        creativeStrategistId: assignment.creativeStrategistId || "",
        priority: assignment.priority,
        dueDate: assignment.dueDate ? new Date(assignment.dueDate) : undefined,
        estimatedMinutes: assignment.estimatedMinutes?.toString() || "",
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
        customerAvatars: [],
        landingPage: "",
        assignedToId: "",
        creativeStrategistId: "",
        priority: "MEDIUM",
        dueDate: undefined,
        estimatedMinutes: "",
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
      hooks: [...prev.hooks, { id: `h${num}`, label: `H${num}`, eng: "", se: "" }],
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
      customerAvatars: form.customerAvatars,
      landingPage: form.landingPage || undefined,
      assignedToId: form.assignedToId,
      creativeStrategistId: form.creativeStrategistId || undefined,
      priority: form.priority,
      dueDate: form.dueDate ? format(form.dueDate, "yyyy-MM-dd") : undefined,
      estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>
            {assignment ? "Edit Assignment" : "Create New Assignment"}
          </DialogTitle>
        </DialogHeader>

        {optionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[75vh]">
            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
              {/* Row 1: Batch, Version, Format */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Batch Number *</Label>
                  <Input
                    type="number"
                    value={form.batchNumber}
                    onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                    placeholder="e.g. 146"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    type="number"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={form.formatId}
                    onValueChange={(v) => setForm({ ...form, formatId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format..." />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.formats.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Country, Product, Offer Type */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select
                    value={form.countryId}
                    onValueChange={(v) => setForm({ ...form, countryId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.countries.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={form.productId}
                    onValueChange={(v) => setForm({ ...form, productId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Offer Type</Label>
                  <Select
                    value={form.offerTypeId}
                    onValueChange={(v) => setForm({ ...form, offerTypeId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select offer type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.offerTypes.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Angle */}
              <div className="space-y-2">
                <Label>Angle</Label>
                <Select
                  value={form.angleId}
                  onValueChange={(v) => setForm({ ...form, angleId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select angle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.angles.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Landing Page */}
              <div className="space-y-2">
                <Label>Landing Page</Label>
                <Input
                  value={form.landingPage}
                  onChange={(e) => setForm({ ...form, landingPage: e.target.value })}
                  placeholder="e.g. LP, LP3, etc."
                />
              </div>

              {/* Customer Avatars */}
              <div className="space-y-2">
                <Label>Customer Avatars</Label>
                <div className="flex flex-wrap gap-2">
                  {options?.customerAvatars.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => toggleCustomerAvatar(avatar.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors",
                        form.customerAvatars.includes(avatar.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground"
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

              {/* Assigned Editor & Creative Strategist */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assigned Editor *</Label>
                  <Select
                    value={form.assignedToId}
                    onValueChange={(v) => setForm({ ...form, assignedToId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select editor..." />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="space-y-2">
                  <Label>Creative Strategist</Label>
                  <Select
                    value={form.creativeStrategistId}
                    onValueChange={(v) => setForm({ ...form, creativeStrategistId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select strategist..." />
                    </SelectTrigger>
                    <SelectContent>
                      {admins.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Priority, Due Date, Estimated Time */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) =>
                      setForm({ ...form, priority: v as AssignmentPriority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.dueDate ? format(form.dueDate, "yyyy-MM-dd") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.dueDate}
                        onSelect={(date) => setForm({ ...form, dueDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Est. Minutes</Label>
                  <Input
                    type="number"
                    value={form.estimatedMinutes}
                    onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
                    placeholder="e.g. 120"
                    min="1"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description / Notes</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Script Editor */}
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Script</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addHook}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Hook
                  </Button>
                </div>

                <div className="space-y-3">
                  {script.hooks.map((hook) => (
                    <div key={hook.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-1 flex items-center justify-center pt-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {hook.label}
                        </span>
                      </div>
                      <div className="col-span-5">
                        <Input
                          value={hook.eng}
                          onChange={(e) => updateHook(hook.id, "eng", e.target.value)}
                          placeholder="English"
                        />
                      </div>
                      <div className="col-span-5">
                        <Input
                          value={hook.se}
                          onChange={(e) => updateHook(hook.id, "se", e.target.value)}
                          placeholder="Svenska"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pt-1">
                        {script.hooks.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeHook(hook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Body */}
                  <Separator className="my-2" />
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-1 flex items-center justify-center pt-2">
                      <span className="text-sm font-medium text-muted-foreground">Body</span>
                    </div>
                    <div className="col-span-5">
                      <Textarea
                        value={script.body.eng}
                        onChange={(e) =>
                          setScript({ ...script, body: { ...script.body, eng: e.target.value } })
                        }
                        placeholder="English body text"
                        rows={3}
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
                      />
                    </div>
                    <div className="col-span-1" />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
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
