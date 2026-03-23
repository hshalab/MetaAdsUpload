"use client";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerState } from "@/lib/review-types";
import { TimecodeDisplay } from "./timecode-display";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

interface VideoControlsProps {
  playerState: PlayerState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSetRate: (rate: number) => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onTimecodeClick?: () => void;
}

export function VideoControls({
  playerState,
  onPlay,
  onPause,
  onSeek,
  onSetRate,
  onSetVolume,
  onToggleMute,
  onToggleFullscreen,
  onTimecodeClick,
}: VideoControlsProps) {
  const { playing, currentTime, duration, volume, muted, playbackRate, isFullscreen } =
    playerState;

  const isMuted = muted || volume === 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-sm">
      {/* Play/Pause */}
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={playing ? onPause : onPlay}
        className="h-8 w-8 flex items-center justify-center rounded-md text-white hover:bg-white/10 transition-all duration-150"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      {/* Skip -10s */}
      <button
        type="button"
        aria-label="Rewind 10 seconds"
        onClick={() => onSeek(Math.max(0, currentTime - 10))}
        className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>

      {/* Skip +10s */}
      <button
        type="button"
        aria-label="Forward 10 seconds"
        onClick={() => onSeek(Math.min(duration, currentTime + 10))}
        className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>

      {/* Timecode */}
      <div className="ml-1">
        <TimecodeDisplay
          currentTime={currentTime}
          duration={duration}
          onClick={onTimecodeClick}
        />
      </div>

      <div className="flex-1" />

      {/* Speed selector */}
      <Popover>
        <PopoverTrigger>
          <button
            type="button"
            aria-label={`Playback speed ${playbackRate}x`}
            className={cn(
              "h-7 px-2 rounded-md text-xs font-medium transition-all duration-150",
              playbackRate !== 1
                ? "text-cyan-400 bg-cyan-500/10"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            {playbackRate}x
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          className="w-24 p-1 bg-[#111827] border-white/10"
        >
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              aria-label={`Set speed to ${rate}x`}
              onClick={() => onSetRate(rate)}
              className={cn(
                "w-full text-left px-2 py-1 rounded text-xs transition-all duration-150",
                rate === playbackRate
                  ? "text-cyan-400 bg-cyan-500/10"
                  : "text-slate-300 hover:bg-white/5"
              )}
            >
              {rate}x
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Volume */}
      <div className="flex items-center gap-1 group/volume">
        <button
          type="button"
          aria-label={isMuted ? "Unmute" : "Mute"}
          onClick={onToggleMute}
          className={cn(
            "h-8 w-8 flex items-center justify-center rounded-md transition-all duration-150 relative",
            isMuted
              ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
              : "text-slate-400 hover:text-white hover:bg-white/10"
          )}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
        {/* Always visible on mobile, expand on hover for desktop */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          aria-label="Volume"
          value={muted ? 0 : volume}
          onChange={(e) => onSetVolume(parseFloat(e.target.value))}
          className="w-16 sm:w-0 sm:group-hover/volume:w-16 transition-all duration-200 accent-cyan-500 h-1 cursor-pointer overflow-hidden"
        />
        {isMuted && (
          <span className="hidden sm:inline text-[10px] text-red-400/70 font-medium tracking-tight select-none">
            Muted
          </span>
        )}
      </div>

      {/* Fullscreen */}
      <button
        type="button"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        onClick={onToggleFullscreen}
        className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
      >
        {isFullscreen ? (
          <Minimize className="h-4 w-4" />
        ) : (
          <Maximize className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
