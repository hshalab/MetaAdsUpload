"use client";

import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded bg-white/5", className)}
    />
  );
}

export function ReviewSkeleton() {
  return (
    <div className="flex h-full bg-[#0a0e1a]">
      {/* Left sidebar skeleton -- desktop only */}
      <div className="hidden lg:flex flex-col w-[260px] border-r border-white/5 bg-[#0c1120] p-4 space-y-4">
        {/* Title with file type icon */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Pulse className="h-4 w-4 rounded flex-shrink-0" />
            <Pulse className="h-4 w-3/4" />
          </div>
          <Pulse className="h-3 w-1/2" />
        </div>
        {/* Badges */}
        <div className="flex gap-2">
          <Pulse className="h-5 w-16 rounded-full" />
          <Pulse className="h-5 w-14 rounded-full" />
        </div>
        {/* Separator */}
        <Pulse className="h-px w-full" />
        {/* Version stack */}
        <Pulse className="h-10 w-full rounded-lg" />
        <Pulse className="h-px w-full" />
        {/* File info */}
        <div className="space-y-2">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-3 w-full" />
          <Pulse className="h-3 w-2/3" />
          <Pulse className="h-3 w-1/2" />
        </div>
        <Pulse className="h-px w-full" />
        {/* Quick Actions */}
        <div className="space-y-2">
          <Pulse className="h-3 w-24" />
          <Pulse className="h-9 w-full rounded-md" />
          <Pulse className="h-9 w-full rounded-md" />
          <Pulse className="h-px w-full" />
          <Pulse className="h-8 w-full rounded-md" />
          <Pulse className="h-8 w-full rounded-md" />
        </div>
      </div>

      {/* Center skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#0c1120]">
          <Pulse className="h-7 w-7 rounded" />
          <Pulse className="h-7 w-7 rounded" />
        </div>
        {/* Video area */}
        <div className="flex-1 flex items-center justify-center p-4">
          <Pulse className="w-full max-w-3xl aspect-video rounded-xl" />
        </div>
        {/* Player controls -- mobile shows volume slider always */}
        <div className="px-4 py-3 border-t border-white/5">
          <Pulse className="h-2 w-full rounded-full mb-2" />
          <div className="flex items-center gap-3">
            <Pulse className="h-8 w-8 rounded" />
            <Pulse className="h-8 w-8 rounded" />
            <Pulse className="h-8 w-8 rounded" />
            <Pulse className="h-3 w-16 rounded" />
            <div className="flex-1" />
            <Pulse className="h-7 w-10 rounded" />
            <Pulse className="h-8 w-8 rounded" />
            <Pulse className="w-16 h-1 rounded-full sm:w-0" />
            <Pulse className="h-8 w-8 rounded" />
          </div>
        </div>
      </div>

      {/* Right panel skeleton -- desktop only */}
      <div className="hidden lg:flex flex-col w-[380px] border-l border-white/5 bg-[#0c1120]">
        {/* Tabs */}
        <div className="flex gap-1 mx-3 mt-3 p-1 bg-white/5 rounded-lg">
          <Pulse className="h-7 flex-1 rounded-md" />
          <Pulse className="h-7 flex-1 rounded-md" />
          <Pulse className="h-7 flex-1 rounded-md" />
        </div>
        {/* Comments header */}
        <div className="flex items-center justify-between px-3 py-2 mt-1">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-3 w-16" />
        </div>
        {/* Comments */}
        <div className="flex-1 p-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2.5 border-l-2 border-white/5 pl-2">
              <Pulse className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Pulse className="h-3 w-20" />
                  <Pulse className="h-3 w-12" />
                </div>
                <Pulse className="h-4 w-14 rounded" />
                <Pulse className="h-3 w-full" />
                <Pulse className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        {/* Comment input */}
        <div className="border-t border-white/5 p-3 space-y-2">
          <Pulse className="h-16 w-full rounded-lg" />
          <div className="flex items-center justify-between">
            <Pulse className="h-6 w-16 rounded" />
            <Pulse className="h-7 w-16 rounded" />
          </div>
        </div>
      </div>

      {/* Mobile bottom bar skeleton -- mobile only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-white/5 bg-[#0c1120] p-3">
        <div className="flex gap-2">
          <Pulse className="h-7 w-7 rounded" />
          <Pulse className="flex-1 h-10 rounded-lg" />
          <Pulse className="h-7 w-7 rounded" />
        </div>
      </div>
    </div>
  );
}
