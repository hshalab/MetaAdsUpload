"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Unlink, CheckCircle, AlertCircle, ExternalLink, Settings, Shield, FileText, MessageCircle } from "lucide-react";
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

type TabKey = "meta" | "fortnox" | "telegram";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "meta", label: "Meta", icon: <Shield className="h-4 w-4" /> },
  { key: "fortnox", label: "Fortnox", icon: <FileText className="h-4 w-4" /> },
  { key: "telegram", label: "Telegram", icon: <MessageCircle className="h-4 w-4" /> },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as TabKey | null;
  const initialTab: TabKey = tabParam && ["meta", "fortnox", "telegram"].includes(tabParam) ? tabParam : "meta";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Meta state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixelInput, setPixelInput] = useState("");

  // Fortnox state
  const [fortnoxClientId, setFortnoxClientId] = useState("");
  const [fortnoxClientSecret, setFortnoxClientSecret] = useState("");
  const [fortnoxConnected, setFortnoxConnected] = useState(false);

  // Telegram state
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramActive, setTelegramActive] = useState(false);

  // Load Fortnox & Telegram from localStorage
  useEffect(() => {
    try {
      const fortnoxData = localStorage.getItem("fortnox_settings");
      if (fortnoxData) {
        const parsed = JSON.parse(fortnoxData);
        setFortnoxClientId(parsed.clientId || "");
        setFortnoxClientSecret(parsed.clientSecret || "");
        setFortnoxConnected(parsed.connected || false);
      }
      const telegramData = localStorage.getItem("telegram_settings");
      if (telegramData) {
        const parsed = JSON.parse(telegramData);
        setTelegramBotToken(parsed.botToken || "");
        setTelegramActive(parsed.active || false);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Meta: fetch connections
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
    if (success === "connected") toast.success("Meta account connected successfully!");
    if (error) toast.error(`Connection failed: ${error}`);
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

  // Fortnox handlers
  const handleFortnoxSave = () => {
    if (!fortnoxClientId.trim() || !fortnoxClientSecret.trim()) {
      toast.error("Fyll i b\u00e5de Client ID och Client Secret");
      return;
    }
    const data = { clientId: fortnoxClientId.trim(), clientSecret: fortnoxClientSecret.trim(), connected: true };
    localStorage.setItem("fortnox_settings", JSON.stringify(data));
    setFortnoxConnected(true);
    toast.success("Fortnox-uppgifter sparade");
  };

  const handleFortnoxDisconnect = () => {
    localStorage.removeItem("fortnox_settings");
    setFortnoxClientId("");
    setFortnoxClientSecret("");
    setFortnoxConnected(false);
    toast.success("Fortnox-koppling borttagen");
  };

  // Telegram handlers
  const handleTelegramActivate = () => {
    if (!telegramBotToken.trim()) {
      toast.error("Ange en bot-token");
      return;
    }
    const data = { botToken: telegramBotToken.trim(), active: true };
    localStorage.setItem("telegram_settings", JSON.stringify(data));
    setTelegramActive(true);
    toast.success("Telegram-bot aktiverad");
  };

  const handleTelegramDeactivate = () => {
    localStorage.removeItem("telegram_settings");
    setTelegramBotToken("");
    setTelegramActive(false);
    toast.success("Telegram-bot inaktiverad");
  };

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "meta") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(`/settings${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="h-6 w-6 text-cyan-400" />
          Inst\u00e4llningar
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Hantera kopplingar och integrationer</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
              activeTab === tab.key
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====================== META TAB ====================== */}
      {activeTab === "meta" && (
        <>
          {/* Meta Connection */}
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

          {/* Other connections */}
          {connections.filter((c) => !c.isActive).length > 0 && (
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
        </>
      )}

      {/* ====================== FORTNOX TAB ====================== */}
      {activeTab === "fortnox" && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Fortnox Integration</h3>
            </div>
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                fortnoxConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/5 text-slate-500 border-white/10"
              )}
            >
              {fortnoxConnected ? "Ansluten" : "Ej ansluten"}
            </span>
          </div>
          <div className="p-5 space-y-5">
            <p className="text-sm text-slate-400">
              Koppla ihop med Fortnox f\u00f6r att automatiskt synka verifikationer. Du beh\u00f6ver ett Fortnox-konto med API-\u00e5tkomst.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Client ID</label>
              <Input
                value={fortnoxClientId}
                onChange={(e) => setFortnoxClientId(e.target.value)}
                placeholder="Fortnox Client ID"
                className="bg-white/5 border-white/10 placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Client Secret</label>
              <Input
                type="password"
                value={fortnoxClientSecret}
                onChange={(e) => setFortnoxClientSecret(e.target.value)}
                placeholder="Fortnox Client Secret"
                className="bg-white/5 border-white/10 placeholder:text-slate-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {!fortnoxConnected ? (
                <button
                  onClick={handleFortnoxSave}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
                >
                  <Link2 className="h-4 w-4" /> Anslut Fortnox
                </button>
              ) : (
                <>
                  <button
                    onClick={handleFortnoxSave}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
                  >
                    Spara \u00e4ndringar
                  </button>
                  <button
                    onClick={handleFortnoxDisconnect}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Unlink className="h-4 w-4" /> Koppla fr\u00e5n
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================== TELEGRAM TAB ====================== */}
      {activeTab === "telegram" && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Telegram Kvittobot</h3>
            </div>
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                telegramActive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/5 text-slate-500 border-white/10"
              )}
            >
              {telegramActive ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
          <div className="p-5 space-y-5">
            <p className="text-sm text-slate-400">
              Telegram-boten l\u00e5ter dig fotografera kvitton och f\u00e5 dem automatiskt bokf\u00f6rda. Skapa en bot via @BotFather i Telegram.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Bot Token</label>
              <Input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="bg-white/5 border-white/10 placeholder:text-slate-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {!telegramActive ? (
                <button
                  onClick={handleTelegramActivate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
                >
                  <MessageCircle className="h-4 w-4" /> Aktivera bot
                </button>
              ) : (
                <>
                  <button
                    onClick={handleTelegramActivate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
                  >
                    Spara \u00e4ndringar
                  </button>
                  <button
                    onClick={handleTelegramDeactivate}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Unlink className="h-4 w-4" /> Inaktivera
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
