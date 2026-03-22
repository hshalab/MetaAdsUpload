"use client";

import { useState, useEffect, useCallback } from "react";
import { UploadWizard } from "@/components/upload/upload-wizard";
import { UploadQueue } from "@/components/upload/upload-queue";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { PublishDialog } from "@/components/assignments/publish-dialog";
import type { EditorAssignment, ScriptContent } from "@/components/assignments/assignment-card";
import {
  Upload,
  Rocket,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileVideo,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TemplateSummary {
  id: string;
  name: string;
  isDefault: boolean;
}

interface BatchGroup {
  batchNumber: number;
  assignments: EditorAssignment[];
}

export default function UploadPage() {
  const { jobs, addJob, startAll, removeJob, clearCompleted } = useUploadQueue();

  // Ready-to-publish assignments
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Record<number, string>>({});
  const [publishingAssignment, setPublishingAssignment] = useState<EditorAssignment | null>(null);

  const fetchReadyToPublish = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const [assignmentsRes, templatesRes] = await Promise.all([
        fetch("/api/assignments?status=READY_FOR_POSTING"),
        fetch("/api/templates"),
      ]);

      if (assignmentsRes.ok) {
        const assignments: EditorAssignment[] = await assignmentsRes.json();
        // Group by batch number
        const batchMap = new Map<number, EditorAssignment[]>();
        for (const a of assignments) {
          const batch = a.batchNumber;
          if (!batchMap.has(batch)) batchMap.set(batch, []);
          batchMap.get(batch)!.push(a);
        }
        const groups: BatchGroup[] = Array.from(batchMap.entries())
          .map(([batchNumber, assignments]) => ({ batchNumber, assignments }))
          .sort((a, b) => b.batchNumber - a.batchNumber);
        setBatches(groups);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data || []);
      }
    } catch {
      toast.error("Failed to load ready-to-publish assignments");
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => { fetchReadyToPublish(); }, [fetchReadyToPublish]);

  const handleAddToQueue = (config: Record<string, unknown>) => {
    addJob(config);
    toast.success("Added to upload queue");
  };

  const handleSaveTemplate = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save template");
      toast.success("Template saved");
    } catch {
      toast.error("Failed to save template");
    }
  };

  const renderScript = (script: ScriptContent | null) => {
    if (!script) return <p className="text-xs text-slate-600 italic">No script</p>;
    return (
      <div className="space-y-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="text-left py-1.5 pr-3 text-[9px] font-medium text-slate-600 uppercase w-10" />
              <th className="text-left py-1.5 pr-3 text-[9px] font-medium text-slate-600 uppercase">English</th>
              <th className="text-left py-1.5 text-[9px] font-medium text-slate-600 uppercase">Svenska</th>
            </tr>
          </thead>
          <tbody>
            {script.hooks.map((hook) => (
              <tr key={hook.id} className="border-b border-white/[0.02]">
                <td className="py-1.5 pr-3 font-bold text-slate-500">{hook.label}</td>
                <td className="py-1.5 pr-3 text-slate-300">{hook.eng || <span className="text-slate-700">—</span>}</td>
                <td className="py-1.5 text-slate-300">{hook.se || <span className="text-slate-700">—</span>}</td>
              </tr>
            ))}
            {(script.body.eng || script.body.se) && (
              <tr>
                <td className="py-1.5 pr-3 font-bold text-slate-500 align-top">Body</td>
                <td className="py-1.5 pr-3 text-slate-300 whitespace-pre-wrap">{script.body.eng || "—"}</td>
                <td className="py-1.5 text-slate-300 whitespace-pre-wrap">{script.body.se || "—"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Upload className="h-6 w-6 text-cyan-400" />
          Upload Ads
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Publish finished assignments or upload ads manually</p>
      </div>

      {/* ─── Ready to Publish Section ─── */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111827] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <Rocket className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Ready to Publish</h2>
            {batches.length > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {batches.reduce((s, b) => s + b.assignments.length, 0)} ads
              </span>
            )}
          </div>
          <button
            onClick={fetchReadyToPublish}
            disabled={loadingBatches}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", loadingBatches && "animate-spin")} />
            Refresh
          </button>
        </div>

        {loadingBatches ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          </div>
        ) : batches.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-600">No assignments ready for publishing</p>
            <p className="text-xs text-slate-700 mt-1">Assignments appear here when moved to &quot;Ready for Posting&quot;</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {batches.map((batch) => {
              const isExpanded = expandedBatch === batch.batchNumber;
              return (
                <div key={batch.batchNumber}>
                  {/* Batch header */}
                  <div
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors",
                      isExpanded && "bg-white/[0.02]"
                    )}
                    onClick={() => setExpandedBatch(isExpanded ? null : batch.batchNumber)}
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-slate-500" />
                      : <ChevronRight className="h-4 w-4 text-slate-500" />
                    }
                    <span className="text-sm font-semibold text-white">
                      Batch #{batch.batchNumber}
                    </span>
                    <span className="text-xs text-slate-500">
                      {batch.assignments.length} {batch.assignments.length === 1 ? "ad" : "ads"}
                    </span>

                    {/* Compact info pills */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {batch.assignments[0]?.product && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/[0.06] text-slate-400">
                          {batch.assignments[0].product.code || batch.assignments[0].product.name}
                        </span>
                      )}
                      {batch.assignments[0]?.country && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/[0.06] text-slate-400">
                          {batch.assignments[0].country.code}
                        </span>
                      )}
                    </div>

                    {/* Template dropdown — stop propagation so click doesn't toggle batch */}
                    <div onClick={(e) => e.stopPropagation()} className="ml-2">
                      <Select
                        value={selectedTemplates[batch.batchNumber] || "___none___"}
                        onValueChange={(v) =>
                          setSelectedTemplates((prev) => ({
                            ...prev,
                            [batch.batchNumber]: v === "___none___" ? "" : v,
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 w-[160px] bg-white/[0.03] border-white/[0.06] text-[10px]">
                          <SelectValue placeholder="Template..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111827] border-white/10">
                          <SelectItem value="___none___" className="text-xs text-slate-600">— No Template —</SelectItem>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.name} {t.isDefault && "(Default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Expanded: show assignments */}
                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-2">
                      {batch.assignments.map((a) => {
                        const scriptExpanded = expandedScript === a.id;
                        return (
                          <div
                            key={a.id}
                            className="rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden"
                          >
                            {/* Assignment row */}
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <FileVideo className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white truncate">
                                  {a.autoName || a.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-500">
                                    {a.assignedTo.name}
                                  </span>
                                  {a.format && (
                                    <span className="text-[10px] text-slate-600">{a.format.name}</span>
                                  )}
                                  {a.angle && (
                                    <span className="text-[10px] text-slate-600">{a.angle.name}</span>
                                  )}
                                </div>
                              </div>

                              {/* Deliverable link */}
                              {a.deliverableUrl && (
                                <a
                                  href={a.deliverableUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Video
                                </a>
                              )}

                              {/* Script toggle */}
                              <button
                                onClick={() => setExpandedScript(scriptExpanded ? null : a.id)}
                                className={cn(
                                  "text-[10px] px-2 py-1 rounded-md border transition-all",
                                  scriptExpanded
                                    ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
                                    : "border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10"
                                )}
                              >
                                Script
                              </button>

                              {/* Publish button */}
                              <button
                                onClick={() => setPublishingAssignment(a)}
                                className="flex items-center gap-1 text-[10px] font-medium px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                              >
                                <Rocket className="h-3 w-3" />
                                Publish
                              </button>
                            </div>

                            {/* Script content */}
                            {scriptExpanded && (
                              <div className="px-4 pb-3 pt-1 border-t border-white/[0.03]">
                                {renderScript(a.scriptContent)}
                              </div>
                            )}
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
      </div>

      {/* ─── Manual Upload (existing wizard) ─── */}
      <UploadWizard onAddToQueue={handleAddToQueue} onSaveTemplate={handleSaveTemplate} />
      <UploadQueue
        jobs={jobs}
        onStartAll={startAll}
        onRemove={removeJob}
        onClearCompleted={clearCompleted}
      />

      {/* Publish Dialog */}
      {publishingAssignment && (
        <PublishDialog
          assignment={publishingAssignment}
          open={!!publishingAssignment}
          onOpenChange={(open) => { if (!open) setPublishingAssignment(null); }}
          onPublished={() => {
            setPublishingAssignment(null);
            fetchReadyToPublish();
          }}
        />
      )}
    </div>
  );
}
