"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Check, Trash2, X } from "lucide-react";

interface Option { id: string; name: string; isActive?: boolean }

interface Props {
  type: "angles" | "problems";
  value: string;
  onChange: (value: string) => void;
  /** Same className the uploader uses for its selects. */
  selectClassName?: string;
}

/**
 * Managed dropdown (select) + a "+" to add / remove options — so identical
 * angles/problems "stack" instead of fragmenting from free text. Mirrors the
 * team-member quick-add UX. Stores the option NAME (controlled list).
 */
export function OptionPicker({ type, value, onChange, selectClassName }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch(`/api/options/${type}`);
      if (!res.ok) return;
      const items = await res.json();
      setOptions((items || []).filter((o: Option) => o.isActive !== false));
    } catch { /* ignore */ }
  }, [type]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const add = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/options/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not add");
      const name = newName.trim();
      setNewName("");
      await fetchOptions();
      onChange(name);
      toast.success(`"${name}" added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (o: Option) => {
    setRemovingId(o.id);
    try {
      const res = await fetch(`/api/options/${type}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: o.id }),
      });
      if (!res.ok) throw new Error("Could not remove");
      if (value === o.name) onChange("");
      await fetchOptions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setRemovingId(null);
    }
  };

  // Ensure the currently-stored value is selectable even if not in the active list.
  const hasValue = !value || options.some((o) => o.name === value);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClassName}>
          <option value="">None selected...</option>
          {!hasValue && <option value={value}>{value}</option>}
          {options.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
        </select>
      </div>
      <div className="relative shrink-0" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={`Add / manage ${type}`}
          className={cn(
            "flex h-[38px] w-[38px] items-center justify-center rounded-lg border transition-all",
            open
              ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
              : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-white/10 bg-[#0f1629] p-3 shadow-2xl shadow-black/50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-2">
              New {type === "angles" ? "angle" : "problem"}
            </p>
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder={type === "angles" ? "e.g. Fatigue" : "e.g. Itchy skin"}
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
              />
              <button type="button" onClick={add} disabled={saving} className="flex items-center justify-center rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
            {options.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Existing ({options.length})</p>
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/[0.03]">
                      <span className="flex-1 truncate text-xs text-slate-300">{o.name}</span>
                      <button type="button" onClick={() => remove(o)} disabled={removingId === o.id} title={`Remove ${o.name}`} className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                        {removingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={() => setOpen(false)} className="absolute top-2 right-2 text-slate-500 hover:text-slate-300" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
