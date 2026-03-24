"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Film } from "lucide-react";
import { VideoPlayer } from "@/components/review/video-player";
import type { Creative } from "./use-library-store";

interface LibraryPreviewModalProps {
  creative: Creative;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function LibraryPreviewModal({
  creative: c,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: LibraryPreviewModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
        case " ":
          e.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (hasPrev) onPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (hasNext) onNext();
          break;
      }
    },
    [onClose, onPrev, onNext, hasPrev, hasNext]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-in fade-in duration-150">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all z-10"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Filename */}
      <div className="absolute top-4 left-4 text-sm text-white/60 font-medium truncate max-w-[50%]">
        {c.name}
      </div>

      {/* Prev arrow */}
      {hasPrev && (
        <button
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next arrow */}
      {hasNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Content */}
      <div className="w-full h-full max-w-[85vw] max-h-[85vh] flex items-center justify-center p-12">
        {c.r2Url && c.type === "video" ? (
          <VideoPlayer
            src={c.r2Url}
            contentType="video/mp4"
            posterUrl={c.thumbnailUrl || undefined}
            className="w-full h-full max-h-[80vh]"
          />
        ) : c.r2Url && c.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.r2Url} alt={c.name} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        ) : c.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnailUrl} alt={c.name} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        ) : (
          <Film className="h-20 w-20 text-slate-700" />
        )}
      </div>
    </div>
  );
}
