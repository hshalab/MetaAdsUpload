"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Play,
  CheckCircle,
  AlertCircle,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Timer,
  Video,
  Image,
  Film,
  Flag,
  Target,
  MessageSquare,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  formatDuration,
  type EditorAssignment,
  type AssignmentStatus,
  type ScriptContent,
} from "@/components/assignments/assignment-card";

interface MyAssignmentsResponse {
  needsAttention: EditorAssignment[];
  active: EditorAssignment[];
  pending: EditorAssignment[];
  inReview: EditorAssignment[];
  total: number;
}

const FORMAT_ICONS: Record<string, React.ElementType> = {
  STATIC: Image,
  UGC: Video,
  VSL: Film,
  VIDEO: Video,
};

export default function MyWorkPage() {
  const router = useRouter();
  const [data, setData] = useState<MyAssignmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assignments/my");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="rounded-xl border border-white/5 bg-[#111827] p-8 text-center">
          <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Assignments Yet</h2>
          <p className="text-slate-500 mb-4">
            You don&apos;t have any assignments right now. When an admin assigns you a task, it will appear here.
          </p>
          <button
            onClick={fetchAssignments}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>
    );
  }

  const allAssignments = [
    ...(data.needsAttention || []),
    ...(data.active || []),
    ...(data.pending || []),
    ...(data.inReview || []),
  ].filter((a, i, self) => i === self.findIndex((t) => t.id === a.id));

  const filteredAssignments = allAssignments.filter((a) => {
    if (filter === "active") return !["POSTED", "READY_FOR_POSTING"].includes(a.status);
    if (filter === "completed") return ["POSTED", "READY_FOR_POSTING"].includes(a.status);
    return true;
  });

  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    if (pA !== pB) return pA - pB;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const activeCount = allAssignments.filter((a) => !["POSTED", "READY_FOR_POSTING"].includes(a.status)).length;
  const inProgressCount = allAssignments.filter((a) => a.status === "EDITING_NOW").length;
  const revisionCount = allAssignments.filter((a) => a.status === "REVISION").length;

  const handleStartWorking = async (assignment: EditorAssignment) => {
    setStartingId(assignment.id);
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start");
      router.push(`/timer?assignmentId=${assignment.id}`);
    } catch (err) {
      console.error(err);
      setStartingId(null);
    }
  };

  const handleMarkComplete = async (assignment: EditorAssignment) => {
    setCompletingId(assignment.id);
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to complete");
      fetchAssignments();
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-cyan-400" />
            My Assignments
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Your assigned video and graphic tasks</p>
        </div>
        <button
          onClick={fetchAssignments}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Active Tasks", value: activeCount, icon: FileText, glow: "glow-cyan", iconBg: "bg-cyan-500/10", iconColor: "text-cyan-400" },
          { label: "In Progress", value: inProgressCount, icon: Timer, glow: "glow-amber", iconBg: "bg-amber-500/10", iconColor: "text-amber-400" },
          { label: "Need Revision", value: revisionCount, icon: AlertCircle, glow: "glow-purple", iconBg: "bg-orange-500/10", iconColor: "text-orange-400" },
        ].map((stat) => (
          <div key={stat.label} className={cn("rounded-xl border bg-[#111827] p-4", stat.glow)}>
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", stat.iconBg)}>
                <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex rounded-lg border border-white/10 overflow-hidden w-fit">
        {(
          [
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "all", label: "All" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium transition-all",
              filter === tab.value
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assignments list */}
      <div className="space-y-3">
        {sortedAssignments.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-[#111827] py-12 text-center">
            <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white">No assignments</h3>
            <p className="text-slate-500 mt-1">
              {filter === "active"
                ? "You don't have any active assignments right now"
                : filter === "completed"
                  ? "You haven't completed any assignments yet"
                  : "No assignments found"}
            </p>
          </div>
        ) : (
          sortedAssignments.map((assignment) => {
            const isExpanded = expandedId === assignment.id;
            const formatName = assignment.format?.name?.toUpperCase() || "";
            const FormatIcon = FORMAT_ICONS[formatName] || FileText;
            const statusConfig = STATUS_CONFIG[assignment.status as AssignmentStatus];
            const canStart = assignment.status === "READY_FOR_EDITING" || assignment.status === "REVISION";
            const canComplete = assignment.status === "EDITING_NOW";

            return (
              <div key={assignment.id} className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
                {/* Main row */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FormatIcon className="h-5 w-5 text-slate-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white truncate">
                          {assignment.autoName || assignment.title}
                        </h3>
                        {assignment.priority === "URGENT" && <Flag className="h-4 w-4 text-red-400 flex-shrink-0" />}
                        {assignment.priority === "HIGH" && <Flag className="h-4 w-4 text-orange-400 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        {assignment.format && <span>{assignment.format.name}</span>}
                        {assignment.angle && (
                          <>
                            <span className="text-slate-700">|</span>
                            <span>{assignment.angle.name}</span>
                          </>
                        )}
                        {assignment.dueDate && (
                          <>
                            <span className="text-slate-700">|</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(assignment.dueDate).toLocaleDateString("sv-SE")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {statusConfig && (
                      <Badge variant="outline" className={cn(statusConfig.bgClass, statusConfig.color, "flex-shrink-0")}>
                        {statusConfig.label}
                      </Badge>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-500 flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 bg-white/[0.01]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left — Details */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Details</h4>
                          <div className="rounded-lg border border-white/5 bg-[#0d1220] p-3 space-y-2 text-sm">
                            {[
                              { label: "Batch", value: assignment.batchNumber },
                              { label: "Version", value: `V${assignment.version}` },
                              ...(assignment.country ? [{ label: "Country", value: assignment.country.name }] : []),
                              ...(assignment.product ? [{ label: "Product", value: assignment.product.name }] : []),
                              ...(assignment.offerType ? [{ label: "Offer Type", value: assignment.offerType.name }] : []),
                              ...(assignment.estimatedMinutes ? [{ label: "Estimated Time", value: `${assignment.estimatedMinutes} min` }] : []),
                              ...(assignment.totalTrackedSeconds > 0 ? [{ label: "Tracked", value: formatDuration(assignment.totalTrackedSeconds) }] : []),
                            ].map((row) => (
                              <div key={row.label} className="flex justify-between">
                                <span className="text-slate-500">{row.label}</span>
                                <span className="font-medium text-slate-300">{row.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {assignment.status === "REVISION" && assignment.revisionFeedback && (
                          <div>
                            <h4 className="text-xs font-medium text-orange-400 uppercase tracking-wider mb-2">Revision Feedback</h4>
                            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                              <p className="text-sm text-slate-300 whitespace-pre-wrap">{assignment.revisionFeedback}</p>
                            </div>
                          </div>
                        )}

                        {assignment.description && (
                          <div>
                            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                            <p className="text-sm text-slate-400 bg-white/[0.02] rounded-lg p-3">{assignment.description}</p>
                          </div>
                        )}
                      </div>

                      {/* Right — Script */}
                      <div>
                        {assignment.scriptContent && (
                          <div>
                            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Script</h4>
                            <div className="rounded-lg border border-white/5 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-white/5">
                                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Section</th>
                                    <th className="px-3 py-2 text-left text-slate-500 font-medium">English</th>
                                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Swedish</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(assignment.scriptContent as ScriptContent).hooks?.map((hook, index) => (
                                    <tr key={index} className="border-b border-white/5">
                                      <td className="px-3 py-2 font-medium text-slate-300">H{index + 1}</td>
                                      <td className="px-3 py-2 text-slate-400">{hook.eng || "-"}</td>
                                      <td className="px-3 py-2 text-slate-400">{hook.se || "-"}</td>
                                    </tr>
                                  ))}
                                  {(assignment.scriptContent as ScriptContent).body && (
                                    <tr>
                                      <td className="px-3 py-2 font-medium text-slate-300">Body</td>
                                      <td className="px-3 py-2 text-slate-400">{(assignment.scriptContent as ScriptContent).body.eng || "-"}</td>
                                      <td className="px-3 py-2 text-slate-400">{(assignment.scriptContent as ScriptContent).body.se || "-"}</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-3">
                      {canStart && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartWorking(assignment); }}
                          disabled={startingId === assignment.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
                        >
                          <Play className="h-4 w-4" />
                          {assignment.status === "REVISION" ? "Start Revision" : "Start Working"}
                        </button>
                      )}
                      {canComplete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkComplete(assignment); }}
                          disabled={completingId === assignment.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Mark Ready for Review
                        </button>
                      )}
                      {assignment.status === "EDITING_NOW" && (
                        <div className="flex items-center gap-2 text-amber-400">
                          <Clock className="h-4 w-4 animate-pulse" />
                          <span className="text-sm font-medium">Currently working on this</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
