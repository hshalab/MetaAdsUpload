"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Video, Lightbulb, Check, Loader2, UserPlus, X } from "lucide-react";

export interface TeamMember {
  id: string;
  name: string;
  userType?: string | null;
  role?: string;
}

interface Props {
  adsetId: string;
  adsetName?: string | null;
  campaignId?: string | null;
  videoEditorId?: string | null;
  creativeStrategistId?: string | null;
  members: TeamMember[];
  source?: string;
  onSaved?: (videoEditorId: string | null, creativeStrategistId: string | null) => void;
}

const isStrategist = (m: TeamMember) => m.userType === "creative_strategist";

/** Assign an AD SET to a video editor (earns the bonus) + creative strategist (stats). */
export function AdsetOwnerPicker({
  adsetId,
  adsetName,
  campaignId,
  videoEditorId,
  creativeStrategistId,
  members,
  source = "analyzer",
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editorId, setEditorId] = useState(videoEditorId || "");
  const [stratId, setStratId] = useState(creativeStrategistId || "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setEditorId(videoEditorId || ""), [videoEditorId]);
  useEffect(() => setStratId(creativeStrategistId || ""), [creativeStrategistId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (members.length === 0) return null;

  const editors = members.filter((m) => !isStrategist(m));
  const strategists = members.filter(isStrategist);
  const currentEditor = members.find((m) => m.id === videoEditorId);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/adset-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adsetId, adsetName, campaignId, source, videoEditorId: editorId || null, creativeStrategistId: stratId || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not save owner");
      }
      toast.success("Owner saved");
      onSaved?.(editorId || null, stratId || null);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const clearOwner = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/adset-owner", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adsetId }),
      });
      if (!res.ok) throw new Error("Could not remove owner");
      toast.success("Owner removed");
      setEditorId(""); setStratId("");
      onSaved?.(null, null);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all",
          currentEditor
            ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20"
            : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200"
        )}
        title={currentEditor ? `Owner: ${currentEditor.name}` : "Assign editor to this ad set"}
      >
        <UserPlus className="h-3.5 w-3.5" />
        {currentEditor ? currentEditor.name.split(" ")[0] : "Owner"}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-white/10 bg-[#0f1629] p-3 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                <Video className="h-3 w-3" /> Video Editor <span className="text-slate-600">(earns bonus)</span>
              </label>
              <select value={editorId} onChange={(e) => setEditorId(e.target.value)} className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white [color-scheme:dark]">
                <option value="">— None —</option>
                {editors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                <Lightbulb className="h-3 w-3" /> Creative Strategist <span className="text-slate-600">(stats only)</span>
              </label>
              <select value={stratId} onChange={(e) => setStratId(e.target.value)} className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white [color-scheme:dark]">
                <option value="">— None —</option>
                {strategists.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
              {(videoEditorId || creativeStrategistId) && (
                <button type="button" onClick={clearOwner} disabled={saving} className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-50" title="Remove owner">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
