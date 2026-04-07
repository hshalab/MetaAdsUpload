"use client";

import { useState, useEffect } from "react";
import {
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Severity = "pass" | "warning" | "fail";
type Category = "structure" | "zombie" | "budget" | "frequency" | "ad_count" | "classification";

interface Finding {
  category: Category;
  severity: Severity;
  title: string;
  description: string | null;
  entityId?: string | null;
  entityType?: string | null;
  details?: Record<string, unknown> | null;
}

interface AuditData {
  findings: Finding[];
  counts: { pass: number; warning: number; fail: number };
  auditedAt: string | null;
}

const SEVERITY_CONFIG: Record<Severity, { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }> = {
  pass: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Pass" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Warning" },
  fail: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Fail" },
};

const CATEGORY_LABELS: Record<Category, string> = {
  structure: "Campaign Structure",
  zombie: "Zombie Campaign",
  budget: "Budget Distribution",
  frequency: "Frequency",
  ad_count: "Ad Set Count",
  classification: "Ad Classification",
};

export default function AuditPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/evolve/audit");
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      // No previous audit
      setData({ findings: [], counts: { pass: 0, warning: 0, fail: 0 }, auditedAt: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, []);

  const runAudit = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/evolve/audit", { method: "POST" });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Audit failed");
      }
      const result = await res.json();
      setData(result);
      // Expand all categories with findings
      const cats = new Set<string>(result.findings.map((f: Finding) => f.category));
      setExpandedCategories(cats);
      toast.success(`Audit complete: ${result.counts.pass} pass, ${result.counts.warning} warnings, ${result.counts.fail} failures`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setRunning(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Group findings by category
  const grouped = (data?.findings || []).reduce<Record<string, Finding[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const worstSeverity = (findings: Finding[]): Severity => {
    if (findings.some((f) => f.severity === "fail")) return "fail";
    if (findings.some((f) => f.severity === "warning")) return "warning";
    return "pass";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-cyan-400" />
            Account Audit
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.auditedAt
              ? `Last audit: ${new Date(data.auditedAt).toLocaleString()}`
              : "No audit run yet"}
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
        >
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running Audit...</>
          ) : (
            <><Play className="h-4 w-4" /> Run Audit</>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Score Summary */}
          {data && (data.counts.pass > 0 || data.counts.warning > 0 || data.counts.fail > 0) && (
            <div className="grid grid-cols-3 gap-4">
              {(["pass", "warning", "fail"] as const).map((sev) => {
                const config = SEVERITY_CONFIG[sev];
                const SevIcon = config.icon;
                return (
                  <div key={sev} className={cn("rounded-xl border p-4", config.bg, config.border)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SevIcon className={cn("h-5 w-5", config.color)} />
                        <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
                      </div>
                      <span className={cn("text-2xl font-bold", config.color)}>
                        {data.counts[sev]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No audit yet */}
          {(!data || data.findings.length === 0) && !running && (
            <div className="rounded-xl border border-white/5 bg-[#111827] py-16 text-center">
              <ClipboardCheck className="h-16 w-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {data?.auditedAt ? "No findings from last audit" : "Run your first audit"}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                The audit checks your campaign structure, zombie setup, ad set counts, frequency, and budget distribution.
              </p>
              <button
                onClick={runAudit}
                disabled={running}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
              >
                <Play className="h-4 w-4" /> Run Audit
              </button>
            </div>
          )}

          {/* Findings by Category */}
          {data && data.findings.length > 0 && (
            <div className="space-y-3">
              {Object.entries(grouped).map(([category, findings]) => {
                const severity = worstSeverity(findings);
                const config = SEVERITY_CONFIG[severity];
                const SevIcon = config.icon;
                const expanded = expandedCategories.has(category);

                return (
                  <div key={category} className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <SevIcon className={cn("h-5 w-5", config.color)} />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">
                            {CATEGORY_LABELS[category as Category] || category}
                          </p>
                          <p className="text-xs text-slate-500">
                            {findings.length} finding{findings.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          {findings.filter((f) => f.severity === "pass").length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {findings.filter((f) => f.severity === "pass").length} pass
                            </span>
                          )}
                          {findings.filter((f) => f.severity === "warning").length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {findings.filter((f) => f.severity === "warning").length} warn
                            </span>
                          )}
                          {findings.filter((f) => f.severity === "fail").length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                              {findings.filter((f) => f.severity === "fail").length} fail
                            </span>
                          )}
                        </div>
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-white/5 divide-y divide-white/5">
                        {findings.map((finding, i) => {
                          const fConfig = SEVERITY_CONFIG[finding.severity];
                          const FIcon = fConfig.icon;
                          return (
                            <div key={i} className="px-5 py-3 flex items-start gap-3">
                              <FIcon className={cn("h-4 w-4 mt-0.5 shrink-0", fConfig.color)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white">{finding.title}</p>
                                {finding.description && (
                                  <p className="text-xs text-slate-500 mt-0.5">{finding.description}</p>
                                )}
                                {finding.entityId && (
                                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                                    {finding.entityType}: {finding.entityId}
                                  </p>
                                )}
                              </div>
                              <span className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                                fConfig.bg, fConfig.color, fConfig.border
                              )}>
                                {fConfig.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
