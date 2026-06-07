"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal, Save, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Settings {
  targetRoas: number;
  holdRoas: number;
  breakevenRoas: number;
  targetCpa: number;
  minDailySpend: number;
  sekPerUsd: number;
  learningPeriodDays: number;
  scalingProtocolDays: number;
  zombieCostCapDiscount: number;
  maxAdSetsPerCampaign: number;
  surfModeEnabled: boolean;
  surfModeCampaignIds: string[];
  surfIntervalHours: number;
  graveyardCampaignId: string | null;
  graveyardMappings: Record<string, string>;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

function SettingField({
  label,
  description,
  value,
  onChange,
  type = "number",
  step,
  suffix,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  type?: string;
  step?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type={type}
          step={step || "any"}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white text-right [color-scheme:dark] focus:border-cyan-500/50 focus:outline-none transition-colors"
        />
        {suffix && <span className="text-xs text-slate-500 w-8">{suffix}</span>}
      </div>
    </div>
  );
}

export default function EvolveSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, campaignsRes] = await Promise.all([
        fetch("/api/evolve/settings"),
        fetch("/api/meta/campaigns"),
      ]);
      if (!settingsRes.ok) throw new Error("Failed to fetch settings");
      const data = await settingsRes.json();
      setSettings(data);
      if (campaignsRes.ok) {
        const campData = await campaignsRes.json();
        setCampaigns(campData.data || []);
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/evolve/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setSettings(updated);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Settings, value: number | boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#111827] py-12 text-center">
        <p className="text-slate-500">Failed to load settings</p>
        <button onClick={fetchSettings} className="mt-4 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <RefreshCw className="h-4 w-4 inline mr-2" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <SlidersHorizontal className="h-6 w-6 text-cyan-400" />
            Evolve KPI Settings
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure the Evolve media buying framework thresholds
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </div>

      {/* ROAS Thresholds */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">ROAS Thresholds</h2>
        <p className="text-xs text-slate-500 mb-4">Define your ROAS zones for ad classification and scaling decisions</p>
        <div className="divide-y divide-white/5">
          <SettingField
            label="Target ROAS"
            description="Ads above this are Breakthroughs — scale aggressively"
            value={settings.targetRoas}
            onChange={(v) => update("targetRoas", v)}
            step="0.1"
            suffix="x"
          />
          <SettingField
            label="Hold ROAS"
            description="Between hold and target — profitable, let it run"
            value={settings.holdRoas}
            onChange={(v) => update("holdRoas", v)}
            step="0.1"
            suffix="x"
          />
          <SettingField
            label="Breakeven ROAS"
            description="Below this you're losing money — pause or cut budget"
            value={settings.breakevenRoas}
            onChange={(v) => update("breakevenRoas", v)}
            step="0.1"
            suffix="x"
          />
        </div>
      </div>

      {/* CPA & Budget */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">CPA & Budget</h2>
        <p className="text-xs text-slate-500 mb-4">Cost-per-acquisition targets and spend thresholds</p>
        <div className="divide-y divide-white/5">
          <SettingField
            label="Target CPA"
            description="Your ideal cost per purchase"
            value={settings.targetCpa}
            onChange={(v) => update("targetCpa", v)}
            step="1"
            suffix="SEK"
          />
          <SettingField
            label="Min Daily Spend"
            description="Below this spend, an ad is considered 'New' (not enough data)"
            value={settings.minDailySpend}
            onChange={(v) => update("minDailySpend", v)}
            step="10"
            suffix="SEK"
          />
          <SettingField
            label="SEK per USD"
            description="Växelkurs för editor-bonus: annonsernas spend (SEK) räknas om till USD innan bonuströsklarna ($500/$1 000/$3 750/$7 500) jämförs"
            value={settings.sekPerUsd}
            onChange={(v) => update("sekPerUsd", v)}
            step="0.1"
            suffix="SEK/$"
          />
        </div>
      </div>

      {/* Timing */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Timing</h2>
        <p className="text-xs text-slate-500 mb-4">Learning period and consistency thresholds</p>
        <div className="divide-y divide-white/5">
          <SettingField
            label="Learning Period"
            description="Days before classifying a new ad (let it learn)"
            value={settings.learningPeriodDays}
            onChange={(v) => update("learningPeriodDays", v)}
            step="1"
            suffix="days"
          />
          <SettingField
            label="Scaling Protocol Days"
            description="Consecutive days above target before scaling"
            value={settings.scalingProtocolDays}
            onChange={(v) => update("scalingProtocolDays", v)}
            step="1"
            suffix="days"
          />
        </div>
      </div>

      {/* Zombie Config */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Graveyard / Zombie Campaign</h2>
        <p className="text-xs text-slate-500 mb-4">Koppla varje CBO-kampanj till sin Graveyard. Annonser som flyttas dupliceras med post-ID så att all engagement (likes, kommentarer) bevaras.</p>
        <div className="divide-y divide-white/5">
          {/* Per-campaign graveyard mapping */}
          <div className="py-3">
            <p className="text-sm font-medium text-white mb-1">CBO → Graveyard mappning</p>
            <p className="text-xs text-slate-500 mb-3">Välj vilken Graveyard-kampanj varje CBO ska skicka zombies till</p>
            {(() => {
              // All campaign IDs currently used as graveyards
              const graveyardIds = new Set(Object.values(settings.graveyardMappings));
              // Source campaigns = all campaigns that are NOT used as a graveyard target
              const sourceCampaigns = campaigns.filter((c) => !graveyardIds.has(c.id));
              // Graveyard-eligible campaigns = all campaigns (you pick which is a graveyard)
              const graveyardOptions = campaigns;

              if (sourceCampaigns.length === 0) {
                return <p className="text-xs text-slate-500 italic">Inga kampanjer hittade</p>;
              }

              return (
                <div className="space-y-2">
                  {sourceCampaigns.map((source) => {
                    const mappedGraveyardId = settings.graveyardMappings[source.id] || "";
                    return (
                      <div key={source.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{source.name}</p>
                          <p className="text-xs text-slate-500">{source.status !== "ACTIVE" ? source.status : "Aktiv"}</p>
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">→</span>
                        <select
                          value={mappedGraveyardId}
                          onChange={(e) => {
                            const newMappings = { ...settings.graveyardMappings };
                            if (e.target.value) {
                              newMappings[source.id] = e.target.value;
                            } else {
                              delete newMappings[source.id];
                            }
                            setSettings({ ...settings, graveyardMappings: newMappings });
                          }}
                          className="w-56 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:border-cyan-500/50 focus:outline-none transition-colors"
                        >
                          <option value="">Välj Graveyard...</option>
                          {graveyardOptions
                            .filter((g) => g.id !== source.id)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} {g.status !== "ACTIVE" ? `(${g.status})` : ""}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {Object.keys(settings.graveyardMappings).length > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
                <p className="text-xs text-emerald-400">
                  {Object.keys(settings.graveyardMappings).length} kampanj{Object.keys(settings.graveyardMappings).length > 1 ? "er" : ""} kopplad{Object.keys(settings.graveyardMappings).length > 1 ? "e" : ""} till Graveyard — flytt med post-ID sker automatiskt.
                </p>
              </div>
            )}
          </div>

          {/* Legacy fallback */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Standard-Graveyard (fallback)</p>
              <p className="text-xs text-slate-500 mt-0.5">Används om en kampanj saknar specifik mappning ovan</p>
            </div>
            <select
              value={settings.graveyardCampaignId || ""}
              onChange={(e) => setSettings({ ...settings, graveyardCampaignId: e.target.value || null })}
              className="w-56 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:border-cyan-500/50 focus:outline-none transition-colors"
            >
              <option value="">Ingen fallback</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.status !== "ACTIVE" ? `(${c.status})` : ""}
                </option>
              ))}
            </select>
          </div>

          <SettingField
            label="Cost Cap Discount"
            description="% under target CPA för zombie cost cap (0.20 = 20% under)"
            value={settings.zombieCostCapDiscount}
            onChange={(v) => update("zombieCostCapDiscount", v)}
            step="0.05"
            suffix="%"
          />
        </div>
      </div>

      {/* Guard Rails */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Guard Rails</h2>
        <p className="text-xs text-slate-500 mb-4">Limits to keep your account healthy</p>
        <div className="divide-y divide-white/5">
          <SettingField
            label="Max Ad Sets per Campaign"
            description="For många ad sets i en kampanj gör att budgeten sprids för tunt och Meta's algoritm lär sig långsammare. Auditen varnar om en kampanj överstiger detta."
            value={settings.maxAdSetsPerCampaign}
            onChange={(v) => update("maxAdSetsPerCampaign", v)}
            step="1"
          />
        </div>
      </div>

      {/* Surf Mode */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Surf Mode</h2>
        <p className="text-xs text-slate-500 mb-4">Aggressiv skalning under kampanjperioder och lanseringar</p>

        {/* Explanation box */}
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 mb-4">
          <p className="text-sm font-medium text-cyan-400 mb-2">Vad är Surf Mode?</p>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">
            Surf Mode är till för korta perioder med hög potential — t.ex. under en rea, produktlansering eller kampanjperiod.
            Istället för att vänta 2-3 dagar på konsekvent data (som vanliga protokollet gör) agerar Surf Mode snabbare och mer aggressivt:
          </p>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">50%+ ovanför target ROAS</span>
              <span className="text-slate-500">&rarr;</span>
              <span>Dubbla budgeten direkt</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold shrink-0">20-50% ovanför target</span>
              <span className="text-slate-500">&rarr;</span>
              <span>Skala +20%</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-bold shrink-0">Vid target ROAS</span>
              <span className="text-slate-500">&rarr;</span>
              <span>Håll nuvarande budget</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold shrink-0">Under breakeven</span>
              <span className="text-slate-500">&rarr;</span>
              <span>Minska 20%</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-400 font-bold shrink-0">Långt under breakeven</span>
              <span className="text-slate-500">&rarr;</span>
              <span>Pausa direkt</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Slå på Surf Mode vid kampanjstart och stäng av det när kampanjen är slut. Använd inte Surf Mode som standard — det är för aggressivt för normala perioder.
          </p>
        </div>

        <div className="divide-y divide-white/5">
          <div className="py-3">
            <p className="text-sm font-medium text-white mb-1">Välj kampanjer för Surf Mode</p>
            <p className="text-xs text-slate-500 mb-3">Markera de kampanjer som ska köra med aggressivare scaling-regler</p>
            {campaigns.filter((c) => c.status === "ACTIVE" && c.id !== settings.graveyardCampaignId).length === 0 ? (
              <p className="text-xs text-slate-500 italic">Inga aktiva kampanjer hittade</p>
            ) : (
              <div className="space-y-2">
                {campaigns
                  .filter((c) => c.status === "ACTIVE" && c.id !== settings.graveyardCampaignId)
                  .map((c) => {
                    const isSelected = settings.surfModeCampaignIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          const ids = isSelected
                            ? settings.surfModeCampaignIds.filter((id) => id !== c.id)
                            : [...settings.surfModeCampaignIds, c.id];
                          setSettings({ ...settings, surfModeCampaignIds: ids, surfModeEnabled: ids.length > 0 });
                        }}
                        className={cn(
                          "flex items-center gap-3 w-full rounded-lg border px-4 py-2.5 text-left transition-all",
                          isSelected
                            ? "border-cyan-500/30 bg-cyan-500/10"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "flex h-5 w-5 items-center justify-center rounded border transition-colors shrink-0",
                          isSelected ? "border-cyan-500 bg-cyan-500" : "border-white/20"
                        )}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={cn("text-sm", isSelected ? "text-cyan-400 font-medium" : "text-slate-300")}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
            {settings.surfModeCampaignIds.length > 0 && (
              <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2">
                <p className="text-xs text-cyan-400">
                  Surf Mode aktiv på {settings.surfModeCampaignIds.length} kampanj{settings.surfModeCampaignIds.length > 1 ? "er" : ""}
                </p>
              </div>
            )}
          </div>
          <SettingField
            label="Surf Interval"
            description="Hur ofta systemet kollar skalning i Surf Mode"
            value={settings.surfIntervalHours}
            onChange={(v) => update("surfIntervalHours", v)}
            step="1"
            suffix="tim"
          />
        </div>
      </div>

      {/* Bottom Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
