"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

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
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Assignments Yet</h2>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have any assignments right now. When an admin assigns you a task, it
              will appear here.
            </p>
            <Button variant="outline" onClick={fetchAssignments}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Combine and deduplicate
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
    const pA = priorityOrder[a.priority] ?? 2;
    const pB = priorityOrder[b.priority] ?? 2;
    if (pA !== pB) return pA - pB;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const activeCount = allAssignments.filter(
    (a) => !["POSTED", "READY_FOR_POSTING"].includes(a.status)
  ).length;
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
          <p className="text-sm text-slate-500 mt-0.5">
            Your assigned video and graphic tasks
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssignments}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Timer className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{revisionCount}</p>
                <p className="text-sm text-muted-foreground">Need Revision</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(
          [
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "all", label: "All" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Assignments list */}
      <div className="space-y-3">
        {sortedAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No assignments</h3>
              <p className="text-muted-foreground mt-1">
                {filter === "active"
                  ? "You don't have any active assignments right now"
                  : filter === "completed"
                    ? "You haven't completed any assignments yet"
                    : "No assignments found"}
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedAssignments.map((assignment) => {
            const isExpanded = expandedId === assignment.id;
            const formatName = assignment.format?.name?.toUpperCase() || "";
            const FormatIcon = FORMAT_ICONS[formatName] || FileText;
            const statusConfig = STATUS_CONFIG[assignment.status];
            const priorityConfig = PRIORITY_CONFIG[assignment.priority];
            const canStart =
              assignment.status === "READY_FOR_EDITING" || assignment.status === "REVISION";
            const canComplete = assignment.status === "EDITING_NOW";

            return (
              <Card key={assignment.id}>
                {/* Main row */}
                <div
                  className="p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <FormatIcon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">
                          {assignment.autoName || assignment.title}
                        </h3>
                        {assignment.priority === "URGENT" && (
                          <Flag className="h-4 w-4 text-red-400 flex-shrink-0" />
                        )}
                        {assignment.priority === "HIGH" && (
                          <Flag className="h-4 w-4 text-orange-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {assignment.format && <span>{assignment.format.name}</span>}
                        {assignment.angle && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span>{assignment.angle.name}</span>
                          </>
                        )}
                        {assignment.dueDate && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(assignment.dueDate).toLocaleDateString("sv-SE")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(statusConfig.bgClass, statusConfig.color, "flex-shrink-0")}
                    >
                      {statusConfig.label}
                    </Badge>

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border p-4 bg-muted/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left column - Details */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Details</h4>
                          <Card>
                            <CardContent className="p-3 space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Batch</span>
                                <span className="font-medium">{assignment.batchNumber}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Version</span>
                                <span className="font-medium">V{assignment.version}</span>
                              </div>
                              {assignment.country && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Country</span>
                                  <span className="font-medium">{assignment.country.name}</span>
                                </div>
                              )}
                              {assignment.product && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Product</span>
                                  <span className="font-medium">{assignment.product.name}</span>
                                </div>
                              )}
                              {assignment.offerType && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Offer Type</span>
                                  <span className="font-medium">{assignment.offerType.name}</span>
                                </div>
                              )}
                              {assignment.estimatedMinutes && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Estimated Time</span>
                                  <span className="font-medium">
                                    {assignment.estimatedMinutes} min
                                  </span>
                                </div>
                              )}
                              {assignment.totalTrackedSeconds > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Tracked</span>
                                  <span className="font-medium">
                                    {formatDuration(assignment.totalTrackedSeconds)}
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Revision feedback */}
                        {assignment.status === "REVISION" && assignment.revisionFeedback && (
                          <div>
                            <h4 className="text-sm font-medium text-orange-400 mb-2">
                              Revision Feedback
                            </h4>
                            <Card className="border-orange-500/30 bg-orange-500/5">
                              <CardContent className="p-3">
                                <p className="text-sm whitespace-pre-wrap">
                                  {assignment.revisionFeedback}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {assignment.description && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Description</h4>
                            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                              {assignment.description}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right column - Script */}
                      <div>
                        {assignment.scriptContent && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Script</h4>
                            <Card>
                              <CardContent className="p-0">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Section</TableHead>
                                      <TableHead className="text-xs">English</TableHead>
                                      <TableHead className="text-xs">Swedish</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(assignment.scriptContent as ScriptContent).hooks?.map(
                                      (hook, index) => (
                                        <TableRow key={index}>
                                          <TableCell className="font-medium text-xs">
                                            H{index + 1}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {hook.eng || "-"}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {hook.se || "-"}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    )}
                                    {(assignment.scriptContent as ScriptContent).body && (
                                      <TableRow>
                                        <TableCell className="font-medium text-xs">
                                          Body
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {(assignment.scriptContent as ScriptContent).body.eng ||
                                            "-"}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {(assignment.scriptContent as ScriptContent).body.se ||
                                            "-"}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-border flex gap-3">
                      {canStart && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartWorking(assignment);
                          }}
                          disabled={startingId === assignment.id}
                          size="sm"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {assignment.status === "REVISION" ? "Start Revision" : "Start Working"}
                        </Button>
                      )}
                      {canComplete && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkComplete(assignment);
                          }}
                          disabled={completingId === assignment.id}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Ready for Review
                        </Button>
                      )}
                      {assignment.status === "EDITING_NOW" && (
                        <div className="flex items-center gap-2 text-yellow-400">
                          <Clock className="h-4 w-4 animate-pulse" />
                          <span className="text-sm font-medium">Currently working on this</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
