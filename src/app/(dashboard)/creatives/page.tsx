"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Image, Video, Search, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Creative {
  id: number;
  name: string;
  type: string;
  source: string;
  thumbnailUrl: string | null;
  fileSize: number | null;
  tags: string[];
  createdAt: string;
}

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCreatives = async () => {
    const res = await fetch("/api/meta/creatives");
    const data = await res.json();
    setCreatives(data.data || []);
  };

  useEffect(() => { fetchCreatives(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      const res = await fetch("/api/meta/creatives", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      toast.success("Creative uploaded");
      fetchCreatives();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const filtered = creatives.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Film className="h-6 w-6 text-cyan-400" />
            Creatives
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your uploaded media assets</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload Creative"}
        </button>
        <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleUpload} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
          placeholder="Search creatives..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden hover:border-white/10 transition-all">
            <div className="flex aspect-video items-center justify-center bg-white/[0.02]">
              {c.thumbnailUrl ? (
                <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-cover" />
              ) : c.type === "video" ? (
                <Video className="h-12 w-12 text-slate-600" />
              ) : (
                <Image className="h-12 w-12 text-slate-600" />
              )}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium text-white">{c.name}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  c.type === "video" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-pink-500/10 text-pink-400 border-pink-500/20"
                )}>
                  {c.type}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                  {c.source}
                </span>
              </div>
              {c.fileSize && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {(c.fileSize / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
              {c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            {creatives.length === 0 ? "No creatives uploaded yet." : "No matches found."}
          </div>
        )}
      </div>
    </div>
  );
}
