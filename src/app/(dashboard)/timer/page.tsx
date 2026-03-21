"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  Pause,
  Square,
  Timer as TimerIcon,
  Video,
  Search,
  Image,
  MoreHorizontal,
  Repeat,
  FileImage,
  History,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  FileText,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorAssignment, ScriptContent } from "@/components/assignments/assignment-card";

// --- Types ---
interface TimerState {
  status: "idle" | "running" | "paused";
  taskType: string;
  taskName: string;
  startedAt: number | null; // timestamp
  pausedAt: number | null;
  accumulatedMs: number; // ms accumulated before last pause
  assignmentId: string | null;
}

interface TimeEntry {
  id: string;
  taskType: string;
  taskName: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  status: string;
}

const TASK_TYPES = [
  { value: "NEW_VIDEO", label: "New Video", icon: Video, color: "text-blue-400" },
  { value: "VIDEO_SOURCING", label: "Video Sourcing", icon: Search, color: "text-purple-400" },
  { value: "IMAGE_WORK", label: "Image Work", icon: Image, color: "text-pink-400" },
  { value: "STATIC_AD", label: "Static Ad", icon: FileImage, color: "text-orange-400" },
  { value: "REVISION_WORK", label: "Revision", icon: Repeat, color: "text-yellow-400" },
  { value: "OTHER", label: "Other", icon: MoreHorizontal, color: "text-gray-400" },
];

const VIDEO_TASK_TYPES = ["NEW_VIDEO", "REVISION_WORK", "VIDEO_EDITING"];

const TIMER_STORAGE_KEY = "meta-ads-timer-state";

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function loadTimerState(): TimerState {
  if (typeof window === "undefined") {
    return { status: "idle", taskType: "NEW_VIDEO", taskName: "", startedAt: null, pausedAt: null, accumulatedMs: 0, assignmentId: null };
  }
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { status: "idle", taskType: "NEW_VIDEO", taskName: "", startedAt: null, pausedAt: null, accumulatedMs: 0, assignmentId: null };
}

function saveTimerState(state: TimerState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
}

export default function TimerPage() {
  const searchParams = useSearchParams();
  const assignmentIdParam = searchParams.get("assignmentId");

  const [timerState, setTimerState] = useState<TimerState>(loadTimerState);
  const [displayMs, setDisplayMs] = useState(0);
  const [assignment, setAssignment] = useState<EditorAssignment | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Completion modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState("");
  const [completionComment, setCompletionComment] = useState("");
  const [googleDriveLink, setGoogleDriveLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load assignment details if assignmentId is given
  useEffect(() => {
    const aId = assignmentIdParam || timerState.assignmentId;
    if (aId) {
      fetch(`/api/assignments/${aId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setAssignment(data);
        })
        .catch(console.error);
    }
  }, [assignmentIdParam, timerState.assignmentId]);

  // Persist state changes
  useEffect(() => {
    saveTimerState(timerState);
  }, [timerState]);

  // Timer tick
  useEffect(() => {
    if (timerState.status === "running" && timerState.startedAt) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = now - timerState.startedAt! + timerState.accumulatedMs;
        setDisplayMs(elapsed);
      }, 100);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else if (timerState.status === "paused") {
      setDisplayMs(timerState.accumulatedMs);
    } else {
      setDisplayMs(0);
    }
  }, [timerState.status, timerState.startedAt, timerState.accumulatedMs]);

  // Fetch history
  useEffect(() => {
    if (showHistory) {
      setHistoryLoading(true);
      fetch("/api/time?days=7")
        .then((r) => (r.ok ? r.json() : { entries: [] }))
        .then((data) => setHistory(data.entries || []))
        .catch(console.error)
        .finally(() => setHistoryLoading(false));
    }
  }, [showHistory]);

  const handleStart = () => {
    const aId = assignmentIdParam || null;
    setTimerState({
      status: "running",
      taskType: timerState.taskType,
      taskName: timerState.taskName || (assignment ? assignment.title : ""),
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedMs: 0,
      assignmentId: aId,
    });
  };

  const handlePause = () => {
    if (timerState.status !== "running" || !timerState.startedAt) return;
    const now = Date.now();
    const accumulated = now - timerState.startedAt + timerState.accumulatedMs;
    setTimerState({
      ...timerState,
      status: "paused",
      pausedAt: now,
      accumulatedMs: accumulated,
      startedAt: null,
    });
  };

  const handleResume = () => {
    setTimerState({
      ...timerState,
      status: "running",
      startedAt: Date.now(),
      pausedAt: null,
    });
  };

  const handleStop = () => {
    setShowCompletionModal(true);
  };

  const handleComplete = async () => {
    setSubmitting(true);
    const durationSeconds = Math.floor(displayMs / 1000);

    try {
      if (timerState.assignmentId) {
        // Complete assignment work
        await fetch(`/api/assignments/${timerState.assignmentId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoLengthSeconds: videoSeconds ? parseInt(videoSeconds) : undefined,
            googleDriveLink: googleDriveLink || undefined,
            durationSeconds,
          }),
        });
      } else {
        // Standalone time entry
        await fetch("/api/time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskType: timerState.taskType,
            taskName: timerState.taskName,
            durationSeconds,
            videoOutputSeconds: videoSeconds ? parseInt(videoSeconds) : undefined,
            description: completionComment || undefined,
          }),
        });
      }

      // Reset
      setTimerState({
        status: "idle",
        taskType: "NEW_VIDEO",
        taskName: "",
        startedAt: null,
        pausedAt: null,
        accumulatedMs: 0,
        assignmentId: null,
      });
      setShowCompletionModal(false);
      setVideoSeconds("");
      setCompletionComment("");
      setGoogleDriveLink("");
      setAssignment(null);
      setDisplayMs(0);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTimerState({
      status: "idle",
      taskType: "NEW_VIDEO",
      taskName: "",
      startedAt: null,
      pausedAt: null,
      accumulatedMs: 0,
      assignmentId: null,
    });
    setAssignment(null);
    setDisplayMs(0);
  };

  const isIdle = timerState.status === "idle";
  const isRunning = timerState.status === "running";
  const isPaused = timerState.status === "paused";
  const showVideoField =
    VIDEO_TASK_TYPES.includes(timerState.taskType) || timerState.assignmentId;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-3">
          <TimerIcon className="h-7 w-7" />
          Timer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your work sessions
        </p>
      </div>

      {/* Timer Display */}
      <Card>
        <CardContent className="py-12 text-center">
          <div
            className={cn(
              "text-7xl font-mono font-bold tracking-wider mb-8",
              isRunning && "text-green-400",
              isPaused && "text-yellow-400",
              isIdle && "text-muted-foreground"
            )}
          >
            {formatTimer(displayMs)}
          </div>

          {/* Task Type Selector (only when idle and no assignment) */}
          {isIdle && !assignmentIdParam && (
            <div className="mb-6">
              <Label className="text-sm text-muted-foreground mb-3 block">Select Task Type</Label>
              <div className="flex flex-wrap justify-center gap-2">
                {TASK_TYPES.map((tt) => {
                  const Icon = tt.icon;
                  return (
                    <Button
                      key={tt.value}
                      variant={timerState.taskType === tt.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimerState({ ...timerState, taskType: tt.value })}
                      className="gap-2"
                    >
                      <Icon className={cn("h-4 w-4", timerState.taskType !== tt.value && tt.color)} />
                      {tt.label}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-3 max-w-sm mx-auto">
                <Input
                  value={timerState.taskName}
                  onChange={(e) => setTimerState({ ...timerState, taskName: e.target.value })}
                  placeholder="Task description (optional)"
                />
              </div>
            </div>
          )}

          {/* Assignment info when in assignment context */}
          {assignmentIdParam && isIdle && assignment && (
            <div className="mb-6">
              <Badge variant="outline" className="mb-2">
                Assignment Mode
              </Badge>
              <p className="text-lg font-semibold">
                {assignment.autoName || assignment.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {assignment.format?.name}
                {assignment.angle ? ` | ${assignment.angle.name}` : ""}
              </p>
            </div>
          )}

          {/* Active session info */}
          {!isIdle && (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                {timerState.assignmentId && assignment
                  ? `Working on: ${assignment.autoName || assignment.title}`
                  : `Task: ${TASK_TYPES.find((t) => t.value === timerState.taskType)?.label || timerState.taskType}`}
              </p>
              {timerState.taskName && !timerState.assignmentId && (
                <p className="text-xs text-muted-foreground mt-1">{timerState.taskName}</p>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-3">
            {isIdle && (
              <Button size="lg" onClick={handleStart} className="gap-2 px-8">
                <Play className="h-5 w-5" />
                Start
              </Button>
            )}
            {isRunning && (
              <>
                <Button size="lg" variant="outline" onClick={handlePause} className="gap-2 px-8">
                  <Pause className="h-5 w-5" />
                  Pause
                </Button>
                <Button size="lg" variant="destructive" onClick={handleStop} className="gap-2 px-8">
                  <Square className="h-5 w-5" />
                  Stop
                </Button>
              </>
            )}
            {isPaused && (
              <>
                <Button size="lg" onClick={handleResume} className="gap-2 px-8">
                  <Play className="h-5 w-5" />
                  Resume
                </Button>
                <Button size="lg" variant="destructive" onClick={handleStop} className="gap-2 px-8">
                  <Square className="h-5 w-5" />
                  Stop
                </Button>
              </>
            )}
            {!isIdle && (
              <Button size="lg" variant="ghost" onClick={handleCancel} className="gap-2">
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assignment Script (when in assignment context) */}
      {assignment?.scriptContent && !isIdle && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Script
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-xs"></TableHead>
                  <TableHead className="text-xs">English</TableHead>
                  <TableHead className="text-xs">Swedish</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(assignment.scriptContent as ScriptContent).hooks?.map((hook, i) =>
                  hook.eng || hook.se ? (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs text-muted-foreground">
                        H{i + 1}
                      </TableCell>
                      <TableCell className="text-xs">{hook.eng || "-"}</TableCell>
                      <TableCell className="text-xs">{hook.se || "-"}</TableCell>
                    </TableRow>
                  ) : null
                )}
                {((assignment.scriptContent as ScriptContent).body.eng ||
                  (assignment.scriptContent as ScriptContent).body.se) && (
                  <TableRow>
                    <TableCell className="font-medium text-xs text-muted-foreground">
                      Body
                    </TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap">
                      {(assignment.scriptContent as ScriptContent).body.eng || "-"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap">
                      {(assignment.scriptContent as ScriptContent).body.se || "-"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Assignment Details card */}
      {assignment && !isIdle && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assignment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium">{assignment.format?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium">{assignment.product?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Angle</span>
              <span className="font-medium">{assignment.angle?.name || "-"}</span>
            </div>
            {assignment.dueDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">
                  {new Date(assignment.dueDate).toLocaleDateString("sv-SE")}
                </span>
              </div>
            )}
            {assignment.estimatedMinutes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated</span>
                <span className="font-medium">{assignment.estimatedMinutes} min</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Section */}
      <div>
        <Button
          variant="ghost"
          onClick={() => setShowHistory(!showHistory)}
          className="gap-2 w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Recent History
          </span>
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {showHistory && (
          <Card className="mt-2">
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No recent entries
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.slice(0, 20).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs">
                          {new Date(entry.startTime).toLocaleDateString("sv-SE")}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[200px]">
                          {entry.taskName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.taskType}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {entry.duration ? formatDuration(entry.duration) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Work Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-3xl font-mono font-bold">{formatTimer(displayMs)}</p>
              <p className="text-sm text-muted-foreground mt-1">Total time tracked</p>
            </div>

            {showVideoField && (
              <div className="space-y-2">
                <Label>Video Length (seconds)</Label>
                <Input
                  type="number"
                  value={videoSeconds}
                  onChange={(e) => setVideoSeconds(e.target.value)}
                  placeholder="e.g. 45"
                  min="1"
                />
              </div>
            )}

            {timerState.assignmentId && (
              <div className="space-y-2">
                <Label>Google Drive Link (optional)</Label>
                <Input
                  value={googleDriveLink}
                  onChange={(e) => setGoogleDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={completionComment}
                onChange={(e) => setCompletionComment(e.target.value)}
                rows={2}
                placeholder="Any notes about this session..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCompletionModal(false)}
            >
              Continue Working
            </Button>
            <Button onClick={handleComplete} disabled={submitting}>
              {submitting ? "Saving..." : "Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
