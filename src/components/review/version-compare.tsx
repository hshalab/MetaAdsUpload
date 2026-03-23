"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliverableVersion } from "@/lib/review-types";
import { formatTimeSimple } from "@/lib/review-types";

interface VersionCompareProps {
  versions: DeliverableVersion[];
  onClose: () => void;
}

export function VersionCompare({ versions, onClose }: VersionCompareProps) {
  const sortedVersions = [...versions].sort(
    (a, b) => a.versionNumber - b.versionNumber
  );

  const [leftId, setLeftId] = useState(
    sortedVersions.length >= 2 ? sortedVersions[sortedVersions.length - 2].id : sortedVersions[0]?.id || ""
  );
  const [rightId, setRightId] = useState(
    sortedVersions[sortedVersions.length - 1]?.id || ""
  );
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const leftVideoRef = useRef<HTMLVideoElement>(null);
  const rightVideoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const leftVersion = sortedVersions.find((v) => v.id === leftId);
  const rightVersion = sortedVersions.find((v) => v.id === rightId);

  const togglePlay = useCallback(() => {
    if (playing) {
      leftVideoRef.current?.pause();
      rightVideoRef.current?.pause();
    } else {
      leftVideoRef.current?.play();
      rightVideoRef.current?.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!seekBarRef.current || !duration) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pct * duration;
      if (leftVideoRef.current) leftVideoRef.current.currentTime = time;
      if (rightVideoRef.current) rightVideoRef.current.currentTime = time;
      setCurrentTime(time);
    },
    [duration]
  );

  const handleReset = useCallback(() => {
    setPlaying(false);
    leftVideoRef.current?.pause();
    rightVideoRef.current?.pause();
    if (leftVideoRef.current) leftVideoRef.current.currentTime = 0;
    if (rightVideoRef.current) rightVideoRef.current.currentTime = 0;
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    const leftEl = leftVideoRef.current;
    if (!leftEl) return;

    const onTimeUpdate = () => setCurrentTime(leftEl.currentTime);
    const onDurationChange = () => setDuration(leftEl.duration || 0);
    const onEnded = () => setPlaying(false);

    leftEl.addEventListener("timeupdate", onTimeUpdate);
    leftEl.addEventListener("loadedmetadata", onDurationChange);
    leftEl.addEventListener("ended", onEnded);

    return () => {
      leftEl.removeEventListener("timeupdate", onTimeUpdate);
      leftEl.removeEventListener("loadedmetadata", onDurationChange);
      leftEl.removeEventListener("ended", onEnded);
    };
  }, [leftId]);

  return (
    <div className="flex flex-col h-full bg-[#0a0e1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-slate-200">
          Version Compare
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 px-2 text-slate-400 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Version selectors */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[11px] text-slate-500 font-medium uppercase">
            Left
          </span>
          <Select value={leftId} onValueChange={setLeftId}>
            <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortedVersions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  V{v.versionNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[11px] text-slate-500 font-medium uppercase">
            Right
          </span>
          <Select value={rightId} onValueChange={setRightId}>
            <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortedVersions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  V{v.versionNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Videos side by side */}
      <div className="flex-1 flex gap-1 p-2 min-h-0">
        <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2 py-0.5 rounded bg-black/60 text-[11px] text-slate-300 font-mono">
              V{leftVersion?.versionNumber}
            </span>
          </div>
          {leftVersion && (
            <video
              ref={leftVideoRef}
              src={leftVersion.r2Url}
              className="w-full h-full object-contain"
              muted
              playsInline
            />
          )}
        </div>
        <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2 py-0.5 rounded bg-black/60 text-[11px] text-slate-300 font-mono">
              V{rightVersion?.versionNumber}
            </span>
          </div>
          {rightVersion && (
            <video
              ref={rightVideoRef}
              src={rightVersion.r2Url}
              className="w-full h-full object-contain"
              muted
              playsInline
            />
          )}
        </div>
      </div>

      {/* Shared controls */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlay}
            className="h-8 w-8 p-0 text-slate-300 hover:text-white"
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <span className="text-[11px] text-slate-400 font-mono w-16 text-right">
            {formatTimeSimple(currentTime)}
          </span>

          {/* Seek bar */}
          <div
            ref={seekBarRef}
            onClick={handleSeek}
            className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer group relative"
          >
            <div
              className="h-full bg-cyan-500 rounded-full transition-all"
              style={{
                width: duration ? `${(currentTime / duration) * 100}%` : "0%",
              }}
            />
          </div>

          <span className="text-[11px] text-slate-400 font-mono w-16">
            {formatTimeSimple(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
