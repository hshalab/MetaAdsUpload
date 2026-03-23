"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getModKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform) {
    return uaData.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl";
  }
  return /mac/i.test(navigator.userAgent) ? "Cmd" : "Ctrl";
}

function buildShortcutGroups(modKey: string) {
  return [
    {
      title: "Playback",
      shortcuts: [
        { keys: ["Space"], description: "Play / Pause" },
        { keys: ["J"], description: "Rewind 5 seconds" },
        { keys: ["L"], description: "Forward 5 seconds" },
        { keys: ["K"], description: "Play / Pause (alt)" },
        { keys: [","], description: "Previous frame" },
        { keys: ["."], description: "Next frame" },
        { keys: ["["], description: "Decrease speed" },
        { keys: ["]"], description: "Increase speed" },
        { keys: ["0-9"], description: "Seek to 0%-90%" },
        { keys: ["M"], description: "Toggle mute" },
      ],
    },
    {
      title: "Annotations",
      shortcuts: [
        { keys: ["A"], description: "Arrow tool" },
        { keys: ["R"], description: "Rectangle tool" },
        { keys: ["D"], description: "Freehand draw" },
        { keys: ["E"], description: "Ellipse tool" },
        { keys: ["Escape"], description: "Cancel annotation" },
      ],
    },
    {
      title: "Comments",
      shortcuts: [
        { keys: ["C"], description: "Focus comment input" },
        { keys: [modKey, "Enter"], description: "Submit comment" },
        { keys: ["I"], description: "Toggle internal/external" },
      ],
    },
    {
      title: "Navigation",
      shortcuts: [
        { keys: ["F"], description: "Toggle fullscreen" },
        { keys: ["?"], description: "Show keyboard shortcuts" },
        { keys: ["Escape"], description: "Close dialog / Exit fullscreen" },
        { keys: ["1"], description: "Toggle left panel" },
        { keys: ["2"], description: "Toggle right panel" },
      ],
    },
  ];
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center h-5 min-w-[22px] px-1.5 rounded bg-white/10 border border-white/10 text-[11px] font-mono text-slate-300">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const modKey = useMemo(() => getModKey(), []);
  const shortcutGroups = useMemo(() => buildShortcutGroups(modKey), [modKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[#111827] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-200">
            <Keyboard className="h-4 w-4 text-cyan-400" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Quick keys for the review interface.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {shortcutGroups.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <Separator className="bg-white/5 mb-4" />}
              <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">
                {group.title}
              </h4>
              <div className="grid gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-slate-300">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          {ki > 0 && (
                            <span className="text-[10px] text-slate-500">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
