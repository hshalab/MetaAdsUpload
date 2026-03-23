"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Clock,
  User,
  Video,
  Image,
  RefreshCw,
  FileText,
  Calendar,
  MessageSquare,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  type EditorAssignment,
} from "@/components/assignments/assignment-card";

type SortOption = "newest" | "due_date" | "priority";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  due_date: "Due Date",
  priority: "Priority",
};

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export default function ReviewQueuePage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<EditorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"review" | "all">("review");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === "review"
          ? "/api/assignments?status=ready_for_review"
          : "/api/assignments";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : data.assignments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const reviewAssignments = useMemo(() => {
    const filtered = assignments.filter(
      (a) =>
        filter === "all" ||
        a.status === "READY_FOR_REVIEW" ||
        a.status === "REVISION"
    );

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "due_date": {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        case "priority": {
          const ap = PRIORITY_ORDER[a.priority] ?? 99;
          const bp = PRIORITY_ORDER[b.priority] ?? 99;
          return ap - bp;
        }
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [assignments, filter, sortBy]);

  const handleCardKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/review/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Eye className="h-6 w-6 text-cyan-400" />
            Review Queue
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review deliverables with timecoded comments and annotations
          </p>
        </div>
        <button
          onClick={fetchAssignments}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filter + Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-white/10 overflow-hidden w-fit">
          {(
            [
              { value: "review", label: "Ready for Review" },
              { value: "all", label: "All Assignments" },
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

        {/* Sort dropdown */}
        <div className="flex items-center gap-1.5 ml-auto">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs text-slate-500">Sort:</span>
          {(["newest", "due_date", "priority"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={cn(
                "px-2 py-1 text-xs rounded transition-all",
                sortBy === opt
                  ? "bg-white/10 text-slate-200 font-medium"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {SORT_LABELS[opt]}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : reviewAssignments.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-[#111827] py-16 text-center">
          <Eye className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">No items to review</h3>
          <p className="text-slate-500 mt-1">
            Assignments marked as &ldquo;Ready for Review&rdquo; will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviewAssignments.map((assignment) => {
            const statusConfig = STATUS_CONFIG[assignment.status];
            const priorityConfig = PRIORITY_CONFIG[assignment.priority];
            const isVideo = assignment.format?.name
              ?.toUpperCase()
              .includes("VIDEO") || assignment.format?.name?.toUpperCase().includes("UGC") || assignment.format?.name?.toUpperCase().includes("VSL");
            const isOverdue =
              assignment.dueDate &&
              new Date(assignment.dueDate) < new Date() &&
              !["POSTED", "READY_FOR_POSTING"].includes(assignment.status);

            return (
              <div
                key={assignment.id}
                role="button"
                tabIndex={0}
                aria-label={`Review ${assignment.autoName || assignment.title}`}
                onClick={() => router.push(`/review/${assignment.id}`)}
                onKeyDown={(e) => handleCardKeyDown(e, assignment.id)}
                className={cn(
                  "rounded-xl border bg-[#111827] overflow-hidden cursor-pointer hover:border-cyan-500/30 hover:bg-[#131b30] transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50",
                  isOverdue ? "border-red-500/20" : "border-white/5"
                )}
              >
                {/* Thumbnail placeholder */}
                <div className="aspect-video bg-[#0a0e1a] flex items-center justify-center relative">
                  {assignment.deliverableUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent to-black/40">
                      {isVideo ? (
                        <Video className="h-12 w-12 text-white/30" />
                      ) : (
                        <Image className="h-12 w-12 text-white/30" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="h-12 w-12 rounded-full bg-cyan-500/20 backdrop-blur-sm flex items-center justify-center border border-cyan-500/30">
                          <Eye className="h-5 w-5 text-cyan-400" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <FileText className="h-12 w-12 text-slate-700" />
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-white text-sm truncate">
                      {assignment.autoName || assignment.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Batch {assignment.batchNumber}
                      {assignment.format && ` · ${assignment.format.name}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {statusConfig && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          statusConfig.bgClass,
                          statusConfig.color
                        )}
                      >
                        {statusConfig.label}
                      </Badge>
                    )}
                    {priorityConfig && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          priorityConfig.bgClass,
                          priorityConfig.color
                        )}
                      >
                        {priorityConfig.label}
                      </Badge>
                    )}
                    {/* Version count badge */}
                    {assignment.version > 1 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-white/5 border-white/10 text-slate-400"
                      >
                        <Layers className="h-2.5 w-2.5 mr-0.5" />
                        V{assignment.version}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      {assignment.assignedTo.name}
                    </div>
                    {assignment.dueDate && (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          isOverdue && "text-red-400 font-medium"
                        )}
                      >
                        <Calendar className="h-3 w-3" />
                        {new Date(assignment.dueDate).toLocaleDateString(
                          "sv-SE"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
