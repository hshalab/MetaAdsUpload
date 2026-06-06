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

interface OwnerPickerProps {
  adId: string;
  adName?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  videoEditorId?: string | null;
  creativeStrategistId?: string | null;
  angle?: string | null;
  problem?: string | null;
  members: TeamMember[];
  source?: string;
  /** Compact pill style for dense tables. */
  compact?: boolean;
  onSaved?: (data: { videoEditorId: string | null; creativeStrategistId: string | null; angle: string | null; problem: string | null }) => void;
}

function isStrategist(m: TeamMember) {
  return m.userType === "creative_strategist";
}

/**
 * One-click owner assignment for a Meta ad.
 * Pick the video editor (earns the bonus) and optionally the creative strategist
 * (tracked for stats). Writes to /api/ad-owner. Renders nothing if there are no
 * team members to choose from (e.g. a non-admin viewer).
 */
export function OwnerPicker({
  adId,
  adName,
  campaignId,
  adsetId,
  videoEditorId,
  creativeStrategistId,
  angle,
  problem,
  members,
  source = "analyzer",
  compact,
  onSaved,
}: OwnerPickerProps) {
  const [open, setOpen] = useState(false);
  const [editorId, setEditorId] = useState(videoEditorId || "");
  const [stratId, setStratId] = useState(creativeStrategistId || "");
  const [angleVal, setAngleVal] = useState(angle || "");
  const [problemVal, setProblemVal] = useState(problem || "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setEditorId(videoEditorId || ""), [videoEditorId]);
  useEffect(() => setStratId(creativeStrategistId || ""), [creativeStrategistId]);
  useEffect(() => setAngleVal(angle || ""), [angle]);
  useEffect(() => setProblemVal(problem || ""), [problem]);

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
      const res = await fetch("/api/ad-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adId,
          adName,
          campaignId,
          adsetId,
          source,
          videoEditorId: editorId || null,
          creativeStrategistId: stratId || null,
          angle: angleVal || null,
          problem: problemVal || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Kunde inte spara ägare");
      }
      toast.success("Ägare sparad");
      onSaved?.({ videoEditorId: editorId || null, creativeStrategistId: stratId || null, angle: angleVal || null, problem: problemVal || null });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setSaving(false);
    }
  };

  const clearOwner = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ad-owner", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId }),
      });
      if (!res.ok) throw new Error("Kunde inte ta bort ägare");
      toast.success("Ägare borttagen");
      setEditorId("");
      setStratId("");
      setAngleVal("");
      setProblemVal("");
      onSaved?.({ videoEditorId: null, creativeStrategistId: null, angle: null, problem: null });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border transition-all",
          compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
          currentEditor
            ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20"
            : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200"
        )}
        title={currentEditor ? `Ägare: ${currentEditor.name}` : "Tilldela ägare"}
      >
        <UserPlus className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        {currentEditor ? currentEditor.name.split(" ")[0] : "Ägare"}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-white/10 bg-[#0f1629] p-3 shadow-2xl shadow-black/50">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                <Video className="h-3 w-3" /> Video Editor <span className="text-slate-600">(får bonus)</span>
              </label>
              <select
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white [color-scheme:dark]"
              >
                <option value="">— Ingen —</option>
                {editors.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                <Lightbulb className="h-3 w-3" /> Creative Strategist <span className="text-slate-600">(stats)</span>
              </label>
              <select
                value={stratId}
                onChange={(e) => setStratId(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white [color-scheme:dark]"
              >
                <option value="">— Ingen —</option>
                {strategists.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Angle</label>
                <input
                  value={angleVal}
                  onChange={(e) => setAngleVal(e.target.value)}
                  placeholder="Vinkel"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Problem</label>
                <input
                  value={problemVal}
                  onChange={(e) => setProblemVal(e.target.value)}
                  placeholder="Problem"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Spara
              </button>
              {(videoEditorId || creativeStrategistId) && (
                <button
                  type="button"
                  onClick={clearOwner}
                  disabled={saving}
                  className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-50"
                  title="Ta bort ägare"
                >
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
