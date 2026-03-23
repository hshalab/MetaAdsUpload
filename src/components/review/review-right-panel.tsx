"use client";

import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Settings2,
  Activity,
  User,
  Calendar,
  FileVideo,
  Layers,
  Target,
  CheckCircle2,
  PenTool,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentList } from "@/components/review/comment-list";
import { CommentInput } from "@/components/review/comment-input";
import type {
  ReviewAssignment,
  ReviewComment,
  AnnotationData,
} from "@/lib/review-types";
import { formatTimeSimple } from "@/lib/review-types";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ReviewRightPanelProps {
  assignment: ReviewAssignment;
  comments: ReviewComment[];
  currentTimecode?: number | null;
  annotation?: AnnotationData | null;
  currentUserId?: string;
  isGuest?: boolean;
  guestName?: string;
  onGuestNameChange?: (name: string) => void;
  onSubmitComment?: (data: {
    body: string;
    timecodeSeconds: number | null;
    annotation: AnnotationData | null;
    isInternal: boolean;
    guestName: string | null;
  }) => void;
  onSeek?: (seconds: number) => void;
  onShowAnnotation?: (comment: ReviewComment) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  onReact?: (commentId: string, emoji: string) => void;
  onReply?: (parentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

export function ReviewRightPanel({
  assignment,
  comments,
  currentTimecode,
  annotation,
  currentUserId,
  isGuest,
  guestName,
  onGuestNameChange,
  onSubmitComment,
  onSeek,
  onShowAnnotation,
  onResolve,
  onReact,
  onReply,
  onDeleteComment,
  onDelete,
}: ReviewRightPanelProps) {
  // Count unresolved top-level comments
  const unresolvedCount = useMemo(
    () => comments.filter((c) => !c.parentCommentId && !c.isResolved).length,
    [comments]
  );

  // Build activity feed from comments sorted by date descending
  const activityItems = useMemo(() => {
    const allComments = comments.flatMap((c) => [c, ...(c.replies || [])]);
    return [...allComments]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 20);
  }, [comments]);

  return (
    <Tabs defaultValue="comments" className="flex flex-col h-full">
      <TabsList className="mx-3 mt-3 bg-white/5 border border-white/5 rounded-lg">
        <TabsTrigger value="comments" className="text-xs gap-1.5 flex-1">
          <MessageSquare className="h-3.5 w-3.5" />
          Comments
          {unresolvedCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-cyan-500/20 text-[10px] font-medium text-cyan-400">
              {unresolvedCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="properties" className="text-xs gap-1.5 flex-1">
          <Settings2 className="h-3.5 w-3.5" />
          Properties
        </TabsTrigger>
        <TabsTrigger value="activity" className="text-xs gap-1.5 flex-1">
          <Activity className="h-3.5 w-3.5" />
          Activity
        </TabsTrigger>
      </TabsList>

      {/* Comments Tab */}
      <TabsContent value="comments" className="flex-1 flex flex-col min-h-0 mt-0">
        <div className="flex-1 min-h-0">
          <CommentList
            comments={comments}
            currentUserId={currentUserId}
            onSeek={onSeek}
            onShowAnnotation={onShowAnnotation}
            onResolve={onResolve}
            onReact={onReact}
            onReply={onReply}
            onDelete={onDeleteComment || onDelete}
          />
        </div>
        {onSubmitComment && (
          <CommentInput
            onSubmit={onSubmitComment}
            currentTimecode={currentTimecode}
            annotation={annotation}
            isGuest={isGuest}
            guestName={guestName}
            onGuestNameChange={onGuestNameChange}
          />
        )}
      </TabsContent>

      {/* Properties Tab -- better grid layout */}
      <TabsContent value="properties" className="flex-1 min-h-0 mt-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
              Assignment Properties
            </h3>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
              <PropertyRow
                icon={User}
                label="Assigned To"
                value={assignment.assignedTo.name}
              />
              {assignment.format && (
                <PropertyRow
                  icon={FileVideo}
                  label="Format"
                  value={assignment.format.name}
                />
              )}
              {assignment.product && (
                <PropertyRow
                  icon={Layers}
                  label="Product"
                  value={assignment.product.name}
                />
              )}
              {assignment.angle && (
                <PropertyRow
                  icon={Target}
                  label="Angle"
                  value={assignment.angle.name}
                />
              )}
              <PropertyRow
                icon={Layers}
                label="Batch"
                value={`#${assignment.batchNumber}`}
              />
              {assignment.dueDate && (
                <PropertyRow
                  icon={Calendar}
                  label="Due Date"
                  value={new Date(assignment.dueDate).toLocaleDateString(
                    "sv-SE"
                  )}
                  isOverdue={new Date(assignment.dueDate) < new Date() && !["POSTED", "READY_FOR_POSTING"].includes(assignment.status)}
                />
              )}
              <PropertyRow
                icon={Calendar}
                label="Created"
                value={new Date(assignment.createdAt).toLocaleDateString(
                  "sv-SE"
                )}
              />
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      {/* Activity Tab -- actual recent activity from comments */}
      <TabsContent value="activity" className="flex-1 min-h-0 mt-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
              Recent Activity
            </h3>
            {activityItems.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No activity yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activityItems.map((item) => {
                  const authorName =
                    item.author?.name || item.guestName || "Anonymous";
                  const isResolve = item.isResolved;
                  const hasAnnotation = !!item.annotation;
                  const hasTimecode = item.timecodeSeconds !== null;

                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-2.5 py-2 px-2 rounded-md hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Activity type icon */}
                      <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {isResolve ? (
                          <CheckCircle2 className="h-3 w-3 text-green-400" />
                        ) : hasAnnotation ? (
                          <PenTool className="h-3 w-3 text-orange-400" />
                        ) : (
                          <MessageSquare className="h-3 w-3 text-cyan-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300">
                          <span className="font-medium text-slate-200">
                            {authorName}
                          </span>{" "}
                          {item.parentCommentId
                            ? "replied"
                            : hasAnnotation
                              ? "annotated"
                              : "commented"}
                          {hasTimecode && (
                            <button
                              onClick={() => onSeek?.(item.timecodeSeconds!)}
                              className="ml-1 text-cyan-400 hover:text-cyan-300 font-mono"
                            >
                              at {formatTimeSimple(item.timecodeSeconds!)}
                            </button>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.body}
                        </p>
                        <span className="text-[10px] text-slate-600">
                          {relativeTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function PropertyRow({
  icon: Icon,
  label,
  value,
  isOverdue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  isOverdue?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </div>
      <span
        className={cn(
          "text-sm font-medium truncate",
          isOverdue ? "text-red-400" : "text-slate-200"
        )}
      >
        {value}
        {isOverdue && (
          <span className="ml-1 text-[10px] font-normal text-red-400/80">
            (overdue)
          </span>
        )}
      </span>
    </>
  );
}
