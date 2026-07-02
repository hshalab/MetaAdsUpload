"use client";

import { useState, useEffect, useCallback } from "react";
import { Route, Plus, RefreshCw, X, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type RoadmapEntry = {
  id: string;
  batchNumber: number | null;
  conceptName: string;
  authorId: string | null;
  desireId: string | null;
  subAvatarId: string | null;
  angleId: string | null;
  awarenessLevel: string | null;
  fileType: string | null;
  status: string;
  hypothesis: string | null;
  variableTested: string | null;
  whatHappened: string | null;
  whatWeLearned: string | null;
  metaAdId: string | null;
  assignmentId: string | null;
  adType: string | null;
  breakthroughMemo: string | null;
  linkToBrief: string | null;
  linkToAd: string | null;
  upvotes: number;
  lastClassification: string | null;
  lastSpend: number | null;
  lastRoas: number | null;
  lastCpa: number | null;
  createdAt: string;
};

type Desire = { id: string; name: string; subAvatars: { id: string; name: string; angles: { id: string; name: string }[] }[] };

const COLUMNS = [
  { key: "ideation", label: "Ideation", color: "border-slate-500/30 bg-slate-500/5" },
  { key: "in_production", label: "In Production", color: "border-yellow-500/30 bg-yellow-500/5" },
  { key: "uploaded", label: "Uploaded", color: "border-blue-500/30 bg-blue-500/5" },
  { key: "learning", label: "Learning", color: "border-purple-500/30 bg-purple-500/5" },
  { key: "breakthrough", label: "Breakthrough", color: "border-emerald-500/30 bg-emerald-500/5" },
  { key: "loser", label: "Loser", color: "border-red-500/30 bg-red-500/5" },
];

const awarenessLabels: Record<string, string> = {
  unaware: "Unaware",
  problem_aware: "Problem Aware",
  solution_aware: "Solution Aware",
  product_aware: "Product Aware",
  most_aware: "Most Aware",
};

const classColors: Record<string, string> = {
  breakthrough: "text-emerald-400",
  spend_winner: "text-blue-400",
  kpi_winner: "text-cyan-400",
  loser: "text-red-400",
  new: "text-yellow-400",
};

const adTypeLabels: Record<string, { label: string; color: string }> = {
  ideation: { label: "Ideation", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  iteration: { label: "Iteration", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

export default function RoadmapPage() {
  const [entries, setEntries] = useState<RoadmapEntry[]>([]);
  const [desires, setDesires] = useState<Desire[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<RoadmapEntry | null>(null);
  const [form, setForm] = useState({ conceptName: "", batchNumber: "", desireId: "", subAvatarId: "", angleId: "", awarenessLevel: "", fileType: "", hypothesis: "", status: "ideation", adType: "", linkToBrief: "" });

  // Filters
  const [filterDesireId, setFilterDesireId] = useState("");
  const [filterAwareness, setFilterAwareness] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterDesireId) params.set("desireId", filterDesireId);
      if (filterAwareness) params.set("awarenessLevel", filterAwareness);
      const qs = params.toString();
      const [roadRes, avatarRes] = await Promise.all([
        fetch(`/api/strategy/roadmap${qs ? `?${qs}` : ""}`),
        fetch("/api/strategy/avatars"),
      ]);
      if (roadRes.ok) setEntries(await roadRes.json());
      if (avatarRes.ok) setDesires(await avatarRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterDesireId, filterAwareness]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/strategy/roadmap/sync", { method: "POST" });
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  const handleCreate = async () => {
    if (!form.conceptName.trim()) return;
    const res = await fetch("/api/strategy/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conceptName: form.conceptName,
        batchNumber: form.batchNumber ? parseInt(form.batchNumber) : null,
        desireId: form.desireId || null,
        subAvatarId: form.subAvatarId || null,
        angleId: form.angleId || null,
        awarenessLevel: form.awarenessLevel || null,
        fileType: form.fileType || null,
        hypothesis: form.hypothesis || null,
        status: form.status,
        adType: form.adType || null,
        linkToBrief: form.linkToBrief || null,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ conceptName: "", batchNumber: "", desireId: "", subAvatarId: "", angleId: "", awarenessLevel: "", fileType: "", hypothesis: "", status: "ideation", adType: "", linkToBrief: "" });
      fetchData();
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/strategy/roadmap/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const handleUpvote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`/api/strategy/roadmap/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upvote" }),
    });
    fetchData();
  };

  const handleDetailSave = async () => {
    if (!detail) return;
    await fetch(`/api/strategy/roadmap/${detail.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatHappened: detail.whatHappened,
        whatWeLearned: detail.whatWeLearned,
        variableTested: detail.variableTested,
        breakthroughMemo: detail.breakthroughMemo,
        linkToBrief: detail.linkToBrief,
        linkToAd: detail.linkToAd,
        adType: detail.adType,
        status: detail.status,
      }),
    });
    setDetail(null);
    fetchData();
  };

  const desireName = (id: string | null) => desires.find((d) => d.id === id)?.name;

  const selectedDesire = desires.find((d) => d.id === form.desireId);
  const selectedSub = selectedDesire?.subAvatars.find((s) => s.id === form.subAvatarId);

  const getLinkToAd = (entry: RoadmapEntry) => {
    if (entry.linkToAd) return entry.linkToAd;
    if (entry.metaAdId) return `https://www.facebook.com/ads/manager/account/ads?act=&selected_ad_ids=${entry.metaAdId}`;
    return null;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Route className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Creative Roadmap</h1>
            <p className="text-sm text-slate-400">Pipeline från idé till resultat</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-slate-400 hover:text-white border border-white/10 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} /> Synka resultat
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Nytt koncept
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterDesireId}
          onChange={(e) => setFilterDesireId(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
        >
          <option value="">Alla kundproblem</option>
          {desires.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={filterAwareness}
          onChange={(e) => setFilterAwareness(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
        >
          <option value="">Alla awareness</option>
          {Object.entries(awarenessLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filterDesireId || filterAwareness) && (
          <button
            onClick={() => { setFilterDesireId(""); setFilterAwareness(""); }}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Rensa filter
          </button>
        )}
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const colEntries = entries
            .filter((e) => e.status === col.key)
            .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
          return (
            <div key={col.key} className={cn("rounded-xl border p-3 min-h-[300px]", col.color)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{col.label}</h3>
                <span className="text-xs text-slate-500">{colEntries.length}</span>
              </div>
              <div className="space-y-2">
                {colEntries.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => setDetail(entry)}
                    className="rounded-lg bg-[#111827] border border-white/10 p-3 cursor-pointer hover:border-white/20 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-sm font-medium text-white truncate flex-1">{entry.conceptName}</div>
                      {/* Upvote button */}
                      <button
                        onClick={(e) => handleUpvote(e, entry.id)}
                        className="flex flex-col items-center gap-0 p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
                        title="Upvote"
                      >
                        <ChevronUp className="h-3.5 w-3.5 text-slate-400 hover:text-cyan-400" />
                        {entry.upvotes > 0 && <span className="text-[9px] text-cyan-400 font-medium -mt-0.5">{entry.upvotes}</span>}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entry.batchNumber && <span className="text-[10px] text-slate-500">Batch #{entry.batchNumber}</span>}
                      {entry.adType && (
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] border", adTypeLabels[entry.adType]?.color || "text-slate-400")}>
                          {adTypeLabels[entry.adType]?.label || entry.adType}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entry.desireId && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 truncate max-w-full">
                          {desireName(entry.desireId) || "Desire"}
                        </span>
                      )}
                      {entry.awarenessLevel && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-slate-400 border border-white/10">
                          {awarenessLabels[entry.awarenessLevel] || entry.awarenessLevel}
                        </span>
                      )}
                    </div>
                    {(entry.lastClassification || entry.lastSpend) && (
                      <div className="flex items-center gap-2 text-[10px]">
                        {entry.lastClassification && (
                          <span className={classColors[entry.lastClassification] || "text-slate-400"}>
                            {entry.lastClassification}
                          </span>
                        )}
                        {entry.lastSpend != null && <span className="text-slate-500">{entry.lastSpend.toFixed(0)} kr</span>}
                        {entry.lastRoas != null && <span className="text-slate-500">{entry.lastRoas.toFixed(2)}x</span>}
                      </div>
                    )}
                    {/* Status dropdown */}
                    <select
                      value={entry.status}
                      onChange={(e) => { e.stopPropagation(); handleStatusChange(entry.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-1 text-slate-400 focus:outline-none [color-scheme:dark]"
                    >
                      {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Nytt koncept</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <input placeholder="Konceptnamn *" value={form.conceptName} onChange={(e) => setForm({ ...form, conceptName: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
            <div className="grid grid-cols-3 gap-3">
              <input placeholder="Batch #" type="number" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
              <select value={form.fileType} onChange={(e) => setForm({ ...form, fileType: e.target.value })} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]">
                <option value="">Filtyp</option>
                <option value="video">Video</option>
                <option value="image">Bild</option>
                <option value="carousel">Carousel</option>
              </select>
              <select value={form.adType} onChange={(e) => setForm({ ...form, adType: e.target.value })} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]">
                <option value="">Ad Type</option>
                <option value="ideation">Ideation</option>
                <option value="iteration">Iteration</option>
              </select>
            </div>
            <select value={form.desireId} onChange={(e) => setForm({ ...form, desireId: e.target.value, subAvatarId: "", angleId: "" })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]">
              <option value="">Kundproblem (valfritt)</option>
              {desires.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {selectedDesire && (
              <select value={form.subAvatarId} onChange={(e) => setForm({ ...form, subAvatarId: e.target.value, angleId: "" })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]">
                <option value="">Sub Avatar (valfritt)</option>
                {selectedDesire.subAvatars.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {selectedSub && (
              <select value={form.angleId} onChange={(e) => setForm({ ...form, angleId: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]">
                <option value="">Vinkel (valfritt)</option>
                {selectedSub.angles.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <select value={form.awarenessLevel} onChange={(e) => setForm({ ...form, awarenessLevel: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]">
              <option value="">Awareness Level</option>
              {Object.entries(awarenessLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Link to brief (optional)" value={form.linkToBrief} onChange={(e) => setForm({ ...form, linkToBrief: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
            <textarea placeholder="Hypothesis — We believe X works because Y" value={form.hypothesis} onChange={(e) => setForm({ ...form, hypothesis: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Avbryt</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20">Skapa</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">{detail.conceptName}</h2>
                {detail.adType && (
                  <span className={cn("px-2 py-0.5 rounded text-[10px] border", adTypeLabels[detail.adType]?.color || "text-slate-400")}>
                    {adTypeLabels[detail.adType]?.label || detail.adType}
                  </span>
                )}
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {detail.hypothesis && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Hypotes</label>
                <p className="text-sm text-slate-300">{detail.hypothesis}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {detail.batchNumber && <div><span className="text-slate-500">Batch:</span> <span className="text-white">#{detail.batchNumber}</span></div>}
              {detail.awarenessLevel && <div><span className="text-slate-500">Awareness:</span> <span className="text-white">{awarenessLabels[detail.awarenessLevel]}</span></div>}
              {detail.fileType && <div><span className="text-slate-500">Filtyp:</span> <span className="text-white">{detail.fileType}</span></div>}
              {detail.metaAdId && <div><span className="text-slate-500">Meta Ad:</span> <span className="text-white font-mono text-xs">{detail.metaAdId}</span></div>}
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              {detail.linkToBrief && (
                <a href={detail.linkToBrief} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  <ExternalLink className="h-3 w-3" /> Brief
                </a>
              )}
              {getLinkToAd(detail) && (
                <a href={getLinkToAd(detail)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  <ExternalLink className="h-3 w-3" /> Meta Ad
                </a>
              )}
            </div>

            {/* Ad Type selector */}
            <div>
              <label className="text-xs text-slate-500 block mb-1">Ad Type</label>
              <select
                value={detail.adType || ""}
                onChange={(e) => setDetail({ ...detail, adType: e.target.value || null })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
              >
                <option value="">Inte valt</option>
                <option value="ideation">Ideation</option>
                <option value="iteration">Iteration</option>
              </select>
            </div>

            {(detail.lastClassification || detail.lastSpend != null) && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1">
                <h3 className="text-xs font-semibold text-slate-400 uppercase">Meta Resultat</h3>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  {detail.lastClassification && <div><span className="text-slate-500">Klass:</span> <span className={classColors[detail.lastClassification] || "text-white"}>{detail.lastClassification}</span></div>}
                  {detail.lastSpend != null && <div><span className="text-slate-500">Spend:</span> <span className="text-white">{detail.lastSpend.toFixed(0)} kr</span></div>}
                  {detail.lastRoas != null && <div><span className="text-slate-500">ROAS:</span> <span className="text-white">{detail.lastRoas.toFixed(2)}</span></div>}
                  {detail.lastCpa != null && <div><span className="text-slate-500">CPA:</span> <span className="text-white">{detail.lastCpa.toFixed(0)} kr</span></div>}
                </div>
              </div>
            )}

            <div className="border-t border-white/10 pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase">Learning Loop</h3>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Variabel testad</label>
                <input value={detail.variableTested || ""} onChange={(e) => setDetail({ ...detail, variableTested: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Vad hände?</label>
                <textarea value={detail.whatHappened || ""} onChange={(e) => setDetail({ ...detail, whatHappened: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Vad lärde vi oss?</label>
                <textarea value={detail.whatWeLearned || ""} onChange={(e) => setDetail({ ...detail, whatWeLearned: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Varför funkar det? (Breakthrough Memo)</label>
                <textarea value={detail.breakthroughMemo || ""} onChange={(e) => setDetail({ ...detail, breakthroughMemo: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
              </div>
            </div>

            {/* Link fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Länk till brief</label>
                <input value={detail.linkToBrief || ""} onChange={(e) => setDetail({ ...detail, linkToBrief: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Länk till ad</label>
                <input value={detail.linkToAd || ""} onChange={(e) => setDetail({ ...detail, linkToAd: e.target.value })} placeholder={detail.metaAdId ? "(auto from Meta Ad ID)" : "https://..."} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDetail(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Stäng</button>
              <button onClick={handleDetailSave} className="px-4 py-2 text-sm rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20">Spara</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
