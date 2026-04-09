"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Angle = { id: string; name: string; description: string | null; subAvatarId: string };
type SubAvatar = { id: string; name: string; behavior: string | null; desireId: string; angles: Angle[] };
type Desire = { id: string; name: string; description: string | null; subAvatars: SubAvatar[] };

export default function AvatarLibraryPage() {
  const [desires, setDesires] = useState<Desire[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDesires, setExpandedDesires] = useState<Set<string>>(new Set());
  const [expandedSubAvatars, setExpandedSubAvatars] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<{ type: string; parentId?: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editing, setEditing] = useState<{ id: string; type: string; name: string; desc: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/strategy/avatars");
      if (res.ok) setDesires(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDesire = (id: string) => {
    setExpandedDesires((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSubAvatar = (id: string) => {
    setExpandedSubAvatars((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!addingTo || !newName.trim()) return;
    const body: Record<string, string> = { type: addingTo.type, name: newName.trim() };
    if (addingTo.type === "desire") body.description = newDesc;
    if (addingTo.type === "sub_avatar") { body.desireId = addingTo.parentId!; body.behavior = newDesc; }
    if (addingTo.type === "angle") { body.subAvatarId = addingTo.parentId!; body.description = newDesc; }

    const res = await fetch("/api/strategy/avatars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setAddingTo(null);
      setNewName("");
      setNewDesc("");
      fetchData();
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    const body: Record<string, string> = { type: editing.type, name: editing.name };
    if (editing.type === "desire") body.description = editing.desc;
    if (editing.type === "sub_avatar") body.behavior = editing.desc;
    if (editing.type === "angle") body.description = editing.desc;

    const res = await fetch(`/api/strategy/avatars/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setEditing(null); fetchData(); }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm("Vill du ta bort detta?")) return;
    const res = await fetch(`/api/strategy/avatars/${id}?type=${type}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Users2 className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Avatar-bibliotek</h1>
            <p className="text-sm text-slate-400">Kundproblem, Sub Avatars och Vinklar</p>
          </div>
        </div>
        <button
          onClick={() => { setAddingTo({ type: "desire" }); setNewName(""); setNewDesc(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Nytt Kundproblem
        </button>
      </div>

      {/* Add/Edit modals */}
      {(addingTo || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setAddingTo(null); setEditing(null); }}>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">
              {editing ? "Redigera" : "Lägg till"} {(editing?.type || addingTo?.type) === "desire" ? "Kundproblem" : (editing?.type || addingTo?.type) === "sub_avatar" ? "Sub Avatar" : "Vinkel"}
            </h2>
            <input
              autoFocus
              placeholder="Namn"
              value={editing ? editing.name : newName}
              onChange={(e) => editing ? setEditing({ ...editing, name: e.target.value }) : setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <input
              placeholder={(editing?.type || addingTo?.type) === "sub_avatar" ? "Beteende (valfritt)" : "Beskrivning (valfritt)"}
              value={editing ? editing.desc : newDesc}
              onChange={(e) => editing ? setEditing({ ...editing, desc: e.target.value }) : setNewDesc(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAddingTo(null); setEditing(null); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                Avbryt
              </button>
              <button onClick={editing ? handleEdit : handleAdd} className="px-4 py-2 text-sm rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors">
                {editing ? "Spara" : "Lägg till"}
              </button>
            </div>
          </div>
        </div>
      )}

      {desires.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Users2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Inga kundproblem ännu. Klicka &quot;Nytt Kundproblem&quot; för att börja.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {desires.map((desire) => (
            <div key={desire.id} className="rounded-xl border border-purple-500/20 bg-purple-500/5 overflow-hidden">
              {/* Desire row */}
              <div className="flex items-center gap-3 px-4 py-3 group">
                <button onClick={() => toggleDesire(desire.id)} className="text-purple-400">
                  {expandedDesires.has(desire.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="h-2 w-2 rounded-full bg-purple-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-purple-300">{desire.name}</span>
                  {desire.description && <span className="ml-2 text-xs text-slate-500">{desire.description}</span>}
                </div>
                <span className="text-xs text-slate-500">{desire.subAvatars.length} sub avatars</span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button onClick={() => setEditing({ id: desire.id, type: "desire", name: desire.name, desc: desire.description || "" })} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(desire.id, "desire")} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub Avatars */}
              {expandedDesires.has(desire.id) && (
                <div className="border-t border-white/5 pl-8">
                  {desire.subAvatars.map((sa) => (
                    <div key={sa.id}>
                      <div className="flex items-center gap-3 px-4 py-2.5 group border-b border-white/5 bg-blue-500/5">
                        <button onClick={() => toggleSubAvatar(sa.id)} className="text-blue-400">
                          {expandedSubAvatars.has(sa.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-blue-300">{sa.name}</span>
                          {sa.behavior && <span className="ml-2 text-xs text-slate-500">{sa.behavior}</span>}
                        </div>
                        <span className="text-xs text-slate-500">{sa.angles.length} vinklar</span>
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button onClick={() => setEditing({ id: sa.id, type: "sub_avatar", name: sa.name, desc: sa.behavior || "" })} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(sa.id, "sub_avatar")} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Angles */}
                      {expandedSubAvatars.has(sa.id) && (
                        <div className="pl-8">
                          {sa.angles.map((angle) => (
                            <div key={angle.id} className="flex items-center gap-3 px-4 py-2 group border-b border-white/5 bg-cyan-500/5">
                              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-cyan-300">{angle.name}</span>
                                {angle.description && <span className="ml-2 text-xs text-slate-500">{angle.description}</span>}
                              </div>
                              <div className="hidden group-hover:flex items-center gap-1">
                                <button onClick={() => setEditing({ id: angle.id, type: "angle", name: angle.name, desc: angle.description || "" })} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDelete(angle.id, "angle")} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => { setAddingTo({ type: "angle", parentId: sa.id }); setNewName(""); setNewDesc(""); }}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors w-full"
                          >
                            <Plus className="h-3 w-3" /> Lägg till vinkel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => { setAddingTo({ type: "sub_avatar", parentId: desire.id }); setNewName(""); setNewDesc(""); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs text-blue-400/60 hover:text-blue-400 transition-colors w-full"
                  >
                    <Plus className="h-3 w-3" /> Lägg till sub avatar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
