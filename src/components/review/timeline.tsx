"use client";

import { useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { formatTimeSimple } from "@/lib/review-types";
import type { ReviewComment } from "@/lib/review-types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface TimelineProps {
  currentTime: number;
  duration: number;
  buffered: number;
  comments: ReviewComment[];
  currentUserId?: string;
  onSeek: (time: number) => void;
  onCommentClick?: (comment: ReviewComment) => void;
}

export function Timeline({
  currentTime,
  duration,
  buffered,
  comments,
  currentUserId,
  onSeek,
  onCommentClick,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current || duration === 0) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      onSeek(getTimeFromEvent(e.clientX));
    },
    [getTimeFromEvent, onSeek]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      setHoverX(e.clientX - rect.left);
      setHoverTime(getTimeFromEvent(e.clientX));

      if (isDragging) {
        onSeek(getTimeFromEvent(e.clientX));
      }
    },
    [isDragging, getTimeFromEvent, onSeek]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoverTime(null);
    setIsDragging(false);
  }, []);

  // Keyboard accessibility: Left/Right arrows when timeline is focused
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (duration === 0) return;
      const step = duration * 0.01; // 1% of total duration per keypress
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - step));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onSeek(Math.min(duration, currentTime + step));
      }
    },
    [currentTime, duration, onSeek]
  );

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // Filter comments with timecodes
  const timecodedComments = comments.filter(
    (c) => c.timecodeSeconds !== null && c.timecodeSeconds !== undefined
  );

  // Compute clamped tooltip position so it doesn't overflow the viewport
  const getTooltipLeft = (): number => {
    if (!trackRef.current) return hoverX;
    const rect = trackRef.current.getBoundingClientRect();
    const tooltipHalfWidth = 28; // approximate half-width of the tooltip
    const minX = tooltipHalfWidth;
    const maxX = rect.width - tooltipHalfWidth;
    return Math.max(minX, Math.min(maxX, hoverX));
  };

  return (
    <div className="w-full px-1 group/timeline">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        className="relative h-2 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 rounded-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        style={{ touchAction: "none" }}
      >
        {/* Track background */}
        <div className="absolute inset-0 rounded-full bg-white/10" />

        {/* Buffered */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/15"
          style={{ width: `${bufferedPct}%` }}
        />

        {/* Played */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cyan-500 transition-[width] duration-75"
          style={{ width: `${playedPct}%` }}
        />

        {/* Hover time indicator with boundary detection */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 px-1.5 py-0.5 rounded bg-black/90 text-[10px] text-white font-mono pointer-events-none -translate-x-1/2"
            style={{ left: getTooltipLeft() }}
          >
            {formatTimeSimple(hoverTime)}
          </div>
        )}

        {/* Scrub handle */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-cyan-400 border-2 border-white shadow-lg transition-transform",
            isDragging ? "h-4 w-4 scale-100" : "h-3 w-3 scale-0 group-hover/timeline:scale-100"
          )}
          style={{ left: `${playedPct}%` }}
        />

        {/* Comment markers -- larger (h-3 w-3) with glow ring on hover */}
        <TooltipProvider>
          {timecodedComments.map((comment) => {
            const pct =
              duration > 0 ? ((comment.timecodeSeconds! / duration) * 100) : 0;
            const isOwn = comment.authorId === currentUserId;
            const isUnresolved = !comment.isResolved;

            return (
              <Tooltip key={comment.id}>
                <TooltipTrigger
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full border border-black/30 cursor-pointer transition-all hover:scale-150 hover:ring-2 hover:ring-current/30 z-10",
                    isUnresolved
                      ? "bg-orange-400"
                      : isOwn
                        ? "bg-cyan-400"
                        : "bg-slate-400"
                  )}
                  style={{ left: `${pct}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(comment.timecodeSeconds!);
                    onCommentClick?.(comment);
                  }}
                />
                <TooltipContent
                  side="top"
                  className="max-w-[200px] text-xs bg-[#111827] text-slate-200 border-white/10"
                >
                  <p className="line-clamp-2">{comment.body}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {formatTimeSimple(comment.timecodeSeconds!)}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
