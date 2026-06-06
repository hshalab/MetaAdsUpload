"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Check, Trash2, Video, Lightbulb, X } from "lucide-react";

export interface QuickMember {
  id: string;
  name: string;
  email?: string;
  userType?: string | null;
}

interface Props {
  defaultType: "video_editor" | "creative_strategist";
  members: QuickMember[];
  /** Called after a member is created — receives the new email so the parent can refetch + select. */
  onAdded: (email: string) => void | Promise<void>;
  /** Called after a member is deactivated so the parent can refetch. */
  onRemoved: () => void | Promise<void>;
}

function matchesType(m: QuickMember, type: "video_editor" | "creative_strategist") {
  return type === "creative_strategist"
    ? m.userType === "creative_strategist"
    : m.userType !== "creative_strategist";
}

/**
 * A "+" button that opens an inline popover to add a new team member (role
 * pre-set by which dropdown it sits next to) or deactivate existing ones —
 * so you never have to leave the uploader to manage the team.
 */
export function MemberQuickAdd({ defaultType, members, onAdded, onRemoved }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const isStrat = defaultType === "creative_strategist";
  const accent = isStrat ? "purple" : "cyan";
  const existing = members.filter((m) => matchesType(m, defaultType));

  const add = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password) { setError("Alla fält krävs"); return; }
    if (password.length < 8) { setError("Lösenord måste vara minst 8 tecken"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          userType: defaultType,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Kunde inte skapa medlem");
      }
      toast.success(`${name.trim()} tillagd`);
      const newEmail = email.trim().toLowerCase();
      setName(""); setEmail(""); setPassword("");
      await onAdded(newEmail);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa medlem");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: QuickMember) => {
    if (!confirm(`Ta bort ${m.name}? (inaktiveras — bonus-historik behålls)`)) return;
    setRemovingId(m.id);
    try {
      const res = await fetch(`/api/users/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte ta bort");
      toast.success(`${m.name} borttagen`);
      await onRemoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte ta bort");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={isStrat ? "Lägg till / hantera strateger" : "Lägg till / hantera editors"}
        className={cn(
          "flex h-[38px] w-[38px] items-center justify-center rounded-lg border transition-all",
          open
            ? isStrat
              ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
              : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200"
        )}
      >
        <Plus className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-72 rounded-xl border border-white/10 bg-[#0f1629] p-3 shadow-2xl shadow-black/50">
          {/* Add form */}
          <div className="flex items-center gap-1.5 mb-2.5">
            {isStrat ? <Lightbulb className="h-3.5 w-3.5 text-purple-400" /> : <Video className="h-3.5 w-3.5 text-cyan-400" />}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Ny {isStrat ? "creative strategist" : "video editor"}
            </span>
          </div>
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Namn"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-post"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Lösenord (min 8 tecken)"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
            />
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <button
              type="button"
              onClick={add}
              disabled={saving}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-50",
                isStrat ? "bg-purple-600 hover:bg-purple-500" : "bg-cyan-600 hover:bg-cyan-500"
              )}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Lägg till
            </button>
          </div>

          {/* Existing members — remove */}
          {existing.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Befintliga ({existing.length})
              </p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {existing.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/[0.03]">
                    <span className="flex-1 truncate text-xs text-slate-300">{m.name}</span>
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      disabled={removingId === m.id}
                      title={`Ta bort ${m.name}`}
                      className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
            aria-label="Stäng"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
