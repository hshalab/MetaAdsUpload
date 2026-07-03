"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 5-star performance rating with half-star precision.
 * Renders a gray star row with an amber overlay clipped to the score width.
 */
export function StarRating({
  value,
  size = 12,
  showValue = false,
  className,
}: {
  value: number | null;
  size?: number;
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, (value ?? 0) / 5)) * 100;
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      title={value != null ? `${value.toFixed(1)} / 5 performance score` : "Not enough spend to rate yet"}
    >
      <div className="relative inline-flex shrink-0">
        <div className="flex gap-px text-slate-700 whitespace-nowrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} style={{ width: size, height: size }} className="fill-current" />
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
          <div className="flex gap-px text-amber-400 whitespace-nowrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} style={{ width: size, height: size }} className="fill-current" />
            ))}
          </div>
        </div>
      </div>
      {showValue && value != null && (
        <span className="text-[10px] font-bold text-amber-300 leading-none">{value.toFixed(1)}</span>
      )}
    </div>
  );
}
