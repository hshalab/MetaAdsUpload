"use client";

import { formatTimecode, formatTimeSimple } from "@/lib/review-types";
import { cn } from "@/lib/utils";

interface TimecodeDisplayProps {
  currentTime: number;
  duration: number;
  fps?: number;
  onClick?: () => void;
}

export function TimecodeDisplay({
  currentTime,
  duration,
  fps = 30,
  onClick,
}: TimecodeDisplayProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-mono text-xs text-slate-300 tabular-nums tracking-wide select-none",
        onClick && "hover:text-cyan-400 transition-colors cursor-pointer"
      )}
    >
      <span className="text-white">{formatTimecode(currentTime, fps)}</span>
      <span className="text-slate-500 mx-1">/</span>
      <span>{formatTimeSimple(duration)}</span>
    </button>
  );
}
