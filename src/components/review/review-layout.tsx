"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PanelLeft, PanelRight, MessageSquare, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const LS_KEY_LEFT = "review-panel-left";
const LS_KEY_RIGHT = "review-panel-right";

function readPanelState(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {}
  return fallback;
}

interface ReviewLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
}

export function ReviewLayout({
  left,
  center,
  right,
  className,
}: ReviewLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  // Restore panel state from localStorage on mount
  useEffect(() => {
    setLeftOpen(readPanelState(LS_KEY_LEFT, true));
    setRightOpen(readPanelState(LS_KEY_RIGHT, true));
  }, []);

  // Persist panel state
  const toggleLeft = () => {
    const next = !leftOpen;
    setLeftOpen(next);
    try { localStorage.setItem(LS_KEY_LEFT, String(next)); } catch {}
  };

  const toggleRight = () => {
    const next = !rightOpen;
    setRightOpen(next);
    try { localStorage.setItem(LS_KEY_RIGHT, String(next)); } catch {}
  };

  return (
    <div className={cn("flex h-full bg-[#0a0e1a] overflow-hidden", className)}>
      {/* Desktop left sidebar with smooth transition */}
      <div
        className={cn(
          "hidden lg:flex flex-col border-r border-white/5 bg-[#0c1120] transition-all duration-300 ease-in-out overflow-hidden",
          leftOpen ? "w-[260px] opacity-100" : "w-0 opacity-0"
        )}
      >
        {leftOpen && left}
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top toolbar with panel toggles */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#0c1120]">
          <div className="flex items-center gap-1">
            {/* Desktop toggle */}
            <Button
              variant="ghost"
              size="sm"
              aria-label={leftOpen ? "Collapse left sidebar" : "Expand left sidebar"}
              onClick={toggleLeft}
              className="hidden lg:flex h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open sidebar"
              onClick={() => setMobileLeftOpen(true)}
              className="lg:hidden h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open comments panel"
              onClick={() => setMobileRightOpen(true)}
              className="lg:hidden h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {/* Desktop toggle */}
            <Button
              variant="ghost"
              size="sm"
              aria-label={rightOpen ? "Collapse comments panel" : "Expand comments panel"}
              onClick={toggleRight}
              className="hidden lg:flex h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-auto">{center}</div>
      </div>

      {/* Desktop right panel with smooth transition */}
      <div
        className={cn(
          "hidden lg:flex flex-col border-l border-white/5 bg-[#0c1120] transition-all duration-300 ease-in-out overflow-hidden",
          rightOpen ? "w-[380px] opacity-100" : "w-0 opacity-0"
        )}
      >
        {rightOpen && right}
      </div>

      {/* Mobile left sheet */}
      <Sheet open={mobileLeftOpen} onOpenChange={setMobileLeftOpen}>
        <SheetContent side="left" className="w-[300px] p-0 bg-[#0c1120] border-white/5">
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
          </SheetHeader>
          {left}
        </SheetContent>
      </Sheet>

      {/* Mobile right sheet */}
      <Sheet open={mobileRightOpen} onOpenChange={setMobileRightOpen}>
        <SheetContent side="right" className="w-[340px] p-0 bg-[#0c1120] border-white/5">
          <SheetHeader className="sr-only">
            <SheetTitle>Comments</SheetTitle>
          </SheetHeader>
          {right}
        </SheetContent>
      </Sheet>
    </div>
  );
}
