"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  PenTool,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Reply,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewComment } from "@/lib/review-types";
import { formatTimeSimple, REACTION_EMOJIS } from "@/lib/review-types";

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

function wasEdited(comment: ReviewComment): boolean {
  const created = new Date(comment.createdAt).getTime();
  const updated = new Date(comment.updatedAt).getTime();
  return updated - created > 60_000; // more than 1 minute difference
}

function renderBody(body: string) {
  // Highlight @mentions -- supports underscores and dots in names
  const parts = body.split(/(@[\w.]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-cyan-400 font-medium">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface CommentItemProps {
  comment: ReviewComment;
  currentUserId?: string;
  isReply?: boolean;
  onSeek?: (seconds: number) => void;
  onShowAnnotation?: (comment: ReviewComment) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  onReact?: (commentId: string, emoji: string) => void;
  onReply?: (parentId: string) => void;
  onDelete?: (commentId: string) => void;
}

function CommentItem({
  comment,
  currentUserId,
  isReply,
  onSeek,
  onShowAnnotation,
  onResolve,
  onReact,
  onReply,
  onDelete,
}: CommentItemProps) {
  const authorName = comment.author?.name || comment.guestName || "Anonymous";
  const initial = authorName.charAt(0).toUpperCase();
  const hasTimecode = comment.timecodeSeconds !== null;

  return (
    <div
      className={cn(
        "group/comment relative",
        isReply && "pl-6"
      )}
    >
      <div
        className={cn(
          "flex gap-2.5 py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors border-l-2",
          hasTimecode ? "border-l-cyan-500/40" : "border-l-slate-700/40"
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0",
            comment.isInternal
              ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
              : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
          )}
        >
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-slate-200 truncate">
              {authorName}
            </span>
            {comment.isInternal && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 bg-purple-500/10 border-purple-500/20 text-purple-400"
              >
                <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                Team
              </Badge>
            )}
            <span className="text-[11px] text-slate-500">
              {relativeTime(comment.createdAt)}
            </span>
            {wasEdited(comment) && (
              <span className="text-[10px] text-slate-600 italic">
                (edited)
              </span>
            )}
          </div>

          {/* Timecode + Annotation badges */}
          <div className="flex items-center gap-1.5 mb-1">
            {comment.timecodeSeconds !== null && (
              <button
                onClick={() => onSeek?.(comment.timecodeSeconds!)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[11px] font-mono hover:bg-cyan-500/20 transition-colors"
              >
                <Clock className="h-2.5 w-2.5" />
                {formatTimeSimple(comment.timecodeSeconds)}
              </button>
            )}
            {comment.annotation && (
              <button
                onClick={() => onShowAnnotation?.(comment)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[11px] hover:bg-orange-500/20 transition-colors"
              >
                <PenTool className="h-2.5 w-2.5" />
                Annotation
              </button>
            )}
          </div>

          {/* Body */}
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {renderBody(comment.body)}
          </p>

          {/* Reactions -- compact inline */}
          {Object.keys(comment.reactions).length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {Object.entries(comment.reactions).map(([emoji, userIds]) => (
                <button
                  key={emoji}
                  onClick={() => onReact?.(comment.id, emoji)}
                  className={cn(
                    "inline-flex items-center gap-0.5 px-1 py-0 rounded-full text-[11px] border transition-colors leading-5",
                    currentUserId && userIds.includes(currentUserId)
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                      : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                  )}
                >
                  <span className="text-[10px]">{emoji}</span>
                  <span className="text-[10px]">{userIds.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions -- hidden by default, revealed on comment hover */}
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReact?.(comment.id, emoji)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 text-sm transition-colors"
              >
                {emoji}
              </button>
            ))}
            {!isReply && (
              <button
                onClick={() => onReply?.(comment.id)}
                className="h-6 px-1.5 flex items-center gap-1 rounded hover:bg-white/10 text-slate-400 text-[11px] transition-colors"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}
            {!isReply && (
              <button
                onClick={() => onResolve?.(comment.id, !comment.isResolved)}
                className={cn(
                  "h-6 px-1.5 flex items-center gap-1 rounded hover:bg-white/10 text-[11px] transition-colors",
                  comment.isResolved ? "text-green-400" : "text-slate-400"
                )}
              >
                {comment.isResolved ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {comment.isResolved ? "Resolved" : "Resolve"}
              </button>
            )}
            {currentUserId &&
              (comment.authorId === currentUserId || comment.guestName) && (
                <button
                  onClick={() => onDelete?.(comment.id)}
                  className="h-6 px-1.5 flex items-center gap-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-[11px] transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CommentListProps {
  comments: ReviewComment[];
  currentUserId?: string;
  onSeek?: (seconds: number) => void;
  onShowAnnotation?: (comment: ReviewComment) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  onReact?: (commentId: string, emoji: string) => void;
  onReply?: (parentId: string) => void;
  onDelete?: (commentId: string) => void;
}

export function CommentList({
  comments,
  currentUserId,
  onSeek,
  onShowAnnotation,
  onResolve,
  onReact,
  onReply,
  onDelete,
}: CommentListProps) {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    new Set()
  );
  const [showResolved, setShowResolved] = useState(false);
  const [resolvedCollapsed, setResolvedCollapsed] = useState(true);

  // Top-level comments only (no parentCommentId)
  const topLevel = comments.filter((c) => !c.parentCommentId);

  // Sort: timecoded first (by timecode), then general (by createdAt)
  const sorted = [...topLevel].sort((a, b) => {
    const aHasTC = a.timecodeSeconds !== null;
    const bHasTC = b.timecodeSeconds !== null;
    if (aHasTC && !bHasTC) return -1;
    if (!aHasTC && bHasTC) return 1;
    if (aHasTC && bHasTC)
      return a.timecodeSeconds! - b.timecodeSeconds!;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const unresolvedComments = sorted.filter((c) => !c.isResolved);
  const resolvedComments = sorted.filter((c) => c.isResolved);
  const resolvedCount = resolvedComments.length;

  const toggleThread = (id: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderComment = (comment: ReviewComment) => {
    const replies = comment.replies || [];
    const hasReplies = replies.length > 0;
    const isExpanded = expandedThreads.has(comment.id);

    return (
      <div key={comment.id}>
        <CommentItem
          comment={comment}
          currentUserId={currentUserId}
          onSeek={onSeek}
          onShowAnnotation={onShowAnnotation}
          onResolve={onResolve}
          onReact={onReact}
          onReply={onReply}
          onDelete={onDelete}
        />
        {hasReplies && (
          <button
            onClick={() => toggleThread(comment.id)}
            className="flex items-center gap-1 ml-12 mb-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {replies.length} repl{replies.length === 1 ? "y" : "ies"}
          </button>
        )}
        {hasReplies && isExpanded && (
          <div className="ml-4 border-l border-white/5">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                isReply
                onSeek={onSeek}
                onShowAnnotation={onShowAnnotation}
                onReact={onReact}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs text-slate-400 font-medium">
          {topLevel.length} comment{topLevel.length !== 1 ? "s" : ""}
        </span>
        {resolvedCount > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showResolved ? "Hide" : "Show"} {resolvedCount} resolved
          </button>
        )}
      </div>

      {/* Comment list */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-white/[0.03]">
          {unresolvedComments.length === 0 && !showResolved && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-slate-500">No comments yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Add a comment to start the conversation
              </p>
            </div>
          )}

          {/* Unresolved comments */}
          {unresolvedComments.map(renderComment)}

          {/* Resolved comments section -- collapsible */}
          {showResolved && resolvedCount > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setResolvedCollapsed(!resolvedCollapsed)}
                className="flex items-center gap-1.5 px-3 py-2 w-full text-left text-[11px] font-medium text-slate-500 hover:text-slate-400 transition-colors"
              >
                {resolvedCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <CheckCircle2 className="h-3 w-3 text-green-500/60" />
                {resolvedCount} resolved comment{resolvedCount !== 1 ? "s" : ""}
              </button>
              {!resolvedCollapsed && (
                <div className="opacity-60">
                  {resolvedComments.map(renderComment)}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
