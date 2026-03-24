"use client";

import { cn } from "@/lib/utils";
import type { Density } from "./use-library-store";

const DENSITY_COLS: Record<Density, string> = {
  sm: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  md: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  lg: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

interface LibraryGridProps {
  density: Density;
  children: React.ReactNode;
}

export function LibraryGrid({ density, children }: LibraryGridProps) {
  return (
    <div className={cn("grid gap-3", DENSITY_COLS[density])}>
      {children}
    </div>
  );
}
