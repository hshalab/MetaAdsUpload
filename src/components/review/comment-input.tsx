"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Clock, PenTool, Eye, EyeOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeSimple } from "@/lib/review-types";
import type { AnnotationData } from "@/lib/review-types";

const MAX_CHARS = 2000;

interface CommentInputProps {
  onSubmit: (data: {
    body: string;
    timecodeSeconds: number | null;
    annotation: AnnotationData | null;
    isInternal: boolean;
    guestName: string | null;
  }) => void;
  currentTimecode?: number | null;
  annotation?: AnnotationData | null;
  isGuest?: boolean;
  guestName?: string;
  onGuestNameChange?: (name: string) => void;
  isReply?: boolean;
  className?: string;
}

export function CommentInput({
  onSubmit,
  currentTimecode,
  annotation,
  isGuest,
  guestName = "",
  onGuestNameChange,
  isReply,
  className,
}: CommentInputProps) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [attachTimecode, setAttachTimecode] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Platform detection using modern API (navigator.platform is deprecated)
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    // Use userAgentData if available (modern browsers), fallback to userAgent
    const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
    if (uaData?.platform) {
      return uaData.platform.toLowerCase().includes("mac");
    }
    return /mac/i.test(navigator.userAgent);
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Use computed lineHeight instead of hardcoded 20px
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5;
    const minHeight = lineHeight * 2;
    const maxHeight = lineHeight * 6;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [body, autoResize]);

  const handleSubmit = () => {
    if (!body.trim()) return;
    if (isGuest && !guestName?.trim()) return;

    onSubmit({
      body: body.trim(),
      timecodeSeconds:
        attachTimecode && currentTimecode != null ? currentTimecode : null,
      annotation: annotation ?? null,
      isInternal,
      guestName: isGuest ? guestName?.trim() || null : null,
    });
    setBody("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasTimecode = currentTimecode != null && currentTimecode > 0;
  const charCount = body.length;
  const isNearLimit = charCount > MAX_CHARS * 0.9;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div className={cn("border-t border-white/5 p-3 space-y-2", className)}>
      {/* Guest name input */}
      {isGuest && (
        <Input
          placeholder="Your name..."
          value={guestName}
          onChange={(e) => onGuestNameChange?.(e.target.value)}
          className="h-8 text-sm bg-white/5 border-white/10"
        />
      )}

      {/* Indicator badges */}
      <div className="flex items-center gap-1.5">
        {hasTimecode && (
          <button
            onClick={() => setAttachTimecode(!attachTimecode)}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors",
              attachTimecode
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "bg-white/5 text-slate-500 border border-white/10"
            )}
          >
            <Clock className="h-2.5 w-2.5" />
            {formatTimeSimple(currentTimecode!)}
          </button>
        )}
        {annotation && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 bg-orange-500/10 border-orange-500/20 text-orange-400"
          >
            <PenTool className="h-2.5 w-2.5 mr-0.5" />
            Drawing attached
          </Badge>
        )}
      </div>

      {/* Textarea with character count */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          data-comment-input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_CHARS + 100))}
          onKeyDown={handleKeyDown}
          placeholder={isReply ? "Reply..." : "Add a comment..."}
          rows={2}
          className="w-full resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
        />
        {/* Character count indicator */}
        {charCount > 0 && (
          <span
            className={cn(
              "absolute bottom-2 right-2 text-[10px] tabular-nums select-none pointer-events-none transition-colors",
              isOverLimit
                ? "text-red-400"
                : isNearLimit
                  ? "text-yellow-500/70"
                  : "text-slate-600"
            )}
          >
            {charCount}/{MAX_CHARS}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isGuest && (
            <button
              onClick={() => setIsInternal(!isInternal)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                isInternal
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:border-white/20"
              )}
            >
              {isInternal ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
              {isInternal ? "Team" : "Client"}
            </button>
          )}
          <span className="text-[10px] text-slate-600">
            {isMac ? "Cmd" : "Ctrl"}+Enter to send
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || isOverLimit || (isGuest && !guestName?.trim())}
          className="h-7 px-3 bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Send className="h-3 w-3 mr-1" />
          Send
        </Button>
      </div>
    </div>
  );
}
