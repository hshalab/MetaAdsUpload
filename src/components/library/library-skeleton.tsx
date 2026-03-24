"use client";

import { cn } from "@/lib/utils";
import type { Density } from "./use-library-store";

const DENSITY_COLS: Record<Density, string> = {
  sm: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  md: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  lg: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function LibrarySkeleton({ density = "md", count = 12 }: { density?: Density; count?: number }) {
  return (
    <div className={cn("grid gap-3", DENSITY_COLS[density])}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden animate-pulse">
          <div className="aspect-video bg-white/[0.04]" />
          <div className="p-2.5 space-y-2">
            <div className="h-3 w-3/4 bg-white/[0.06] rounded" />
            <div className="h-2.5 w-1/2 bg-white/[0.04] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
