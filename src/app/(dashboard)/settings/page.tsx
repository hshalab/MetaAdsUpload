"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Unlink, CheckCircle, AlertCircle, ExternalLink, Settings, Shield, Upload, RefreshCw, FileText, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdAccount {
  id: string;
  name: string;
  currency: string;
  status: number;
}

interface Page {
  id: string;
  name: string;
}

interface Connection {
  id: number;
  name: string;
  facebookUserId: string;
  adAccounts: AdAccount[];
  activeAdAccountId: string | null;
  pages: Page[];
  activePageId: string | null;
  pixelId: string | null;
  isActive: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

type Tab = "meta" | "fortnox" | "import";

function SettingsContent() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixelInput, setPixelInput] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("meta");
  const searchParams = useSearchParams();

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta/connection");
      const data = await res.json();
      setConnections(data.connections || []);
    } catch {
      toast.error("Failed to fetch connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConnections(); }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const fortnox = searchParams.get("fortnox");
    if (success === "connected") toast.success("Meta account connected successfully!");
    if (error) toast.error(`Connection failed: ${error}`);
    if (fortnox === "connected") {
      toast.success("Fortnox connected!");
      setActiveTab("fortnox");
    }
  }, [searchParams]);

  const handleConnect = () => { window.location.href = "/api/meta/connect"; };

  const handleUpdateConnection = async (id: number, updates: Record<string, unknown>) => {
    try {
      await fetch("/api/meta/connection", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      toast.success("Settings updated");
      fetchConnections();
    } catch { toast.error("Failed to update"); }
  };

  const handleDisconnect = async (id: number) => {
    if (!confirm("Are you sure you want to disconnect this Meta account?")) return;
    try {
      await fetch("/api/meta/connection", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      toast.success("Account disconnected");
      fetchConnections();
    } catch { toast.error("Failed to disconnect"); }
  };

  const activeConnection = connections.find((c) => c.isActive);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "meta", label: "Meta", icon: <Shield className="h-4 w-4" /> },
    { key: "fortnox", label: "Fortnox", icon: <RefreshCw className="h-4 w-4" /> },
    { key: "import", label: "Import", icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="h-6 w-6 text-cyan-400" />
          Settings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage connections, integrations and data import</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center",
              activeTab === tab.key
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Meta Tab */}
      {activeTab === "meta" && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Meta Connection</h3>
          </div>
          <div className="p-5 space-y-5">
            {loading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent mx-auto" />
              </div>
            ) : activeConnection ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{activeConnection.name}</p>
                    <p className="text-xs text-slate-500">
                      Connected {new Date(activeConnection.createdAt).toLocaleDateString("sv-SE")}
                      {activeConnection.tokenExpiresAt && (
                        <> &middot; Token expires {new Date(activeConnection.tokenExpiresAt).toLocaleDateString("sv-SE")}</>
                      )}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Connected
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Ad Account</label>
                  <Select
                    value={activeConnection.activeAdAccountId || ""}
                    onValueChange={(v) => handleUpdateConnection(activeConnection.id, { activeAdAccountId: v })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="Select ad account..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      {activeConnection.adAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.id}) - {a.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Page</label>
                  <Select
                    value={activeConnection.activePageId || ""}
                    onValueChange={(v) => handleUpdateConnection(activeConnection.id, { activePageId: v })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="Select page..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-white/10">
                      {activeConnection.pages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pixel ID (optional)</label>
                  <div className="flex gap-2">
                    <Input
                      value={pixelInput || activeConnection.pixelId || ""}
                      onChange={(e) => setPixelInput(e.target.value)}
                      placeholder="Enter your Meta Pixel ID"
                      className="bg-white/5 border-white/10 placeholder:text-slate-600"
                    />
                    <button
                      onClick={() => handleUpdateConnection(activeConnection.id, { pixelId: pixelInput })}
                      className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={handleConnect}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
                  >
                    <Link2 className="h-4 w-4" /> Reconnect
                  </button>
                  <button
                    onClick={() => handleDisconnect(activeConnection.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Unlink className="h-4 w-4" /> Disconnect
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="mb-1 font-medium text-white">No Meta account connected</p>
                <p className="mb-4 text-sm text-slate-500">Connect your Meta account to start managing ads.</p>
                <button
                  onClick={handleConnect}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
                >
                  <ExternalLink className="h-4 w-4" /> Connect Meta Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fortnox Tab */}
      {activeTab === "fortnox" && <FortnoxSection />}

      {/* Import Tab */}
      {activeTab === "import" && <ImportSection />}

      {/* Other connections */}
      {activeTab === "meta" && connections.filter((c) => !c.isActive).length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Other Connections</h3>
          </div>
          <div className="p-5 space-y-3">
            {connections.filter((c) => !c.isActive).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.adAccounts.length} ad accounts</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateConnection(c.id, { isActive: true })}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleDisconnect(c.id)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition-all"
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fortnox Section ──────────────────────────────────────────────────────────

function FortnoxSection() {
  const [status, setStatus] = useState<{ connected: boolean; expiresAt: string | null; expiresIn?: number } | null>(null);
  const [syncStats, setSyncStats] = useState<{ total: number; synced: number; unsynced: number; failed: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ synced: 0, failed: 0, total: 0 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [syncErrors, setSyncErrors] = useState<Array<{ voucherId: string; series: string; number: number; error: string }>>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/fortnox/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, expiresAt: null });
    }
  }, []);

  const fetchSyncStats = useCallback(async () => {
    try {
      const res = await fetch("/api/fortnox/sync");
      const data = await res.json();
      setSyncStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSyncStats();
  }, [fetchStatus, fetchSyncStats]);

  const handleConnectFortnox = () => {
    const clientId = prompt("Enter Fortnox Client ID (or set FORTNOX_CLIENT_ID env var):");
    if (!clientId) return;
    const redirectUri = `${window.location.origin}/api/fortnox/callback`;
    const authUrl = `https://apps.fortnox.se/oauth-v1/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=voucher&state=fortnox&response_type=code`;
    window.location.href = authUrl;
  };

  const handleBulkSync = async () => {
    setSyncing(true);
    setPaused(false);
    pausedRef.current = false;
    setSyncProgress({ synced: 0, failed: 0, total: syncStats?.unsynced ?? 0 });
    setSyncErrors([]);

    let cursor: string | undefined;
    let totalSynced = 0;
    let totalFailed = 0;
    const allErrors: typeof syncErrors = [];

    while (true) {
      if (pausedRef.current) break;

      try {
        const res = await fetch("/api/fortnox/bulk-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: 200, cursor }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Sync failed");
          break;
        }

        const data = await res.json();
        totalSynced += data.synced;
        totalFailed += data.failed;
        allErrors.push(...(data.errors || []));

        setSyncProgress({ synced: totalSynced, failed: totalFailed, total: syncStats?.unsynced ?? 0 });
        setSyncErrors(allErrors);

        if (!data.hasMore || !data.cursor) break;
        cursor = data.cursor;
      } catch (err) {
        toast.error("Sync request failed");
        break;
      }
    }

    setSyncing(false);
    fetchSyncStats();
    if (totalSynced > 0) toast.success(`Synkade ${totalSynced} verifikationer till Fortnox`);
    if (totalFailed > 0) toast.error(`${totalFailed} verifikationer misslyckades`);
  };

  const handlePause = () => {
    pausedRef.current = true;
    setPaused(true);
  };

  const handleResume = () => {
    setPaused(false);
    pausedRef.current = false;
    handleBulkSync();
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Fortnox Connection</h3>
        </div>
        <div className="p-5 space-y-4">
          {status === null ? (
            <div className="py-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-500" /></div>
          ) : status.connected ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <div className="flex-1">
                <p className="font-medium text-white text-sm">Fortnox Ansluten</p>
                <p className="text-xs text-slate-500">
                  Token giltig till {status.expiresAt ? new Date(status.expiresAt).toLocaleString("sv-SE") : "okänt"}
                </p>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Ansluten
              </span>
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="mb-1 font-medium text-white text-sm">Fortnox ej anslutet</p>
              <p className="mb-3 text-xs text-slate-500">Anslut ditt Fortnox-konto för att synka verifikationer.</p>
              <button
                onClick={handleConnectFortnox}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
              >
                <ExternalLink className="h-4 w-4" /> Anslut Fortnox
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync Section */}
      {status?.connected && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Synka till Fortnox</h3>
            </div>
            {syncStats && (
              <span className="text-xs text-slate-500">
                {syncStats.synced} / {syncStats.total} synkade
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {syncStats && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Totalt", value: syncStats.total, color: "text-white" },
                  { label: "Synkade", value: syncStats.synced, color: "text-emerald-400" },
                  { label: "Osynkade", value: syncStats.unsynced, color: "text-amber-400" },
                  { label: "Fel", value: syncStats.failed, color: "text-red-400" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <p className={cn("text-lg font-bold", stat.color)}>{stat.value.toLocaleString("sv-SE")}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Progress bar during sync */}
            {syncing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Synkar verifikationer...</span>
                  <span>{syncProgress.synced.toLocaleString("sv-SE")} / {syncProgress.total.toLocaleString("sv-SE")}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress.total > 0 ? Math.round((syncProgress.synced / syncProgress.total) * 100) : 0}%` }}
                  />
                </div>
                {syncProgress.failed > 0 && (
                  <p className="text-xs text-red-400">{syncProgress.failed} misslyckade</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {!syncing ? (
                <button
                  onClick={handleBulkSync}
                  disabled={!syncStats || syncStats.unsynced === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-4 w-4" /> Synka alla till Fortnox
                </button>
              ) : (
                <button
                  onClick={paused ? handleResume : handlePause}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
                >
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {paused ? "Fortsätt" : "Pausa"}
                </button>
              )}
            </div>

            {/* Error summary */}
            {syncErrors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-400">Fel ({syncErrors.length}):</p>
                <div className="max-h-40 overflow-auto space-y-1">
                  {syncErrors.slice(0, 20).map((err, i) => (
                    <div key={i} className="text-xs text-slate-400 p-2 rounded bg-red-500/5 border border-red-500/10">
                      <span className="text-red-400 font-medium">{err.series} {err.number}:</span> {err.error}
                    </div>
                  ))}
                  {syncErrors.length > 20 && (
                    <p className="text-xs text-slate-500">...och {syncErrors.length - 20} till</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Import Section ───────────────────────────────────────────────────────────

function ImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    warnings?: string[];
    totalInFile?: number;
    accountsFound?: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);

    // Preview first few lines
    const text = await f.text();
    const lines = text.split("\n").slice(0, 30);
    setPreview(lines.join("\n"));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/sie/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      if (data.imported > 0) {
        toast.success(`Importerade ${data.imported} verifikationer`);
      }
      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} fel vid import`);
      }
    } catch {
      toast.error("Import misslyckades");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">SIE-import</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Ladda upp en SIE4-fil (.se, .si, .sie) för att importera verifikationer till BookKeeper.
            Dubbletter (samma serie + nummer + datum) hoppas över automatiskt.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer",
              dragOver
                ? "border-cyan-500/50 bg-cyan-500/5"
                : "border-white/10 hover:border-white/20"
            )}
            onClick={() => document.getElementById("sie-file-input")?.click()}
          >
            <Upload className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-300 mb-1">
              {file ? file.name : "Dra och släpp SIE-fil här, eller klicka för att välja"}
            </p>
            <p className="text-xs text-slate-500">.se, .si, .sie filer</p>
            <input
              id="sie-file-input"
              type="file"
              accept=".se,.si,.sie"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">Förhandsvisning (30 rader):</p>
              <pre className="text-[11px] text-slate-400 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono">
                {preview}
              </pre>
            </div>
          )}

          {/* Upload button */}
          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Importerar..." : "Importera verifikationer"}
            </button>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-lg font-bold text-emerald-400">{result.imported}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Importerade</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <p className="text-lg font-bold text-amber-400">{result.skipped}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Skippade</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <p className="text-lg font-bold text-red-400">{result.errors?.length ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Fel</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-red-400">Fel:</p>
                  <div className="max-h-32 overflow-auto space-y-1">
                    {result.errors.slice(0, 20).map((err, i) => (
                      <p key={i} className="text-xs text-red-300 p-2 rounded bg-red-500/5 border border-red-500/10">{err}</p>
                    ))}
                  </div>
                </div>
              )}

              {result.warnings && result.warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-400">Varningar ({result.warnings.length}):</p>
                  <div className="max-h-32 overflow-auto space-y-1">
                    {result.warnings.slice(0, 10).map((w, i) => (
                      <p key={i} className="text-xs text-amber-300 p-2 rounded bg-amber-500/5 border border-amber-500/10">{w}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
