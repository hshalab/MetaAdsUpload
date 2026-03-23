"use client";

import {
  useReducer,
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  playerReducer,
  initialPlayerState,
  type PlayerState,
} from "@/lib/review-types";

export interface VideoPlayerProps {
  src: string;
  contentType: string;
  posterUrl?: string;
  className?: string;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onBufferUpdate?: (buffered: number) => void;
  onReady?: (state: PlayerState) => void;
  children?: ReactNode;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  function VideoPlayer(
    {
      src,
      contentType,
      posterUrl,
      className,
      onTimeUpdate,
      onDurationChange,
      onPlay,
      onPause: onPauseProp,
      onBufferUpdate,
      onReady,
      children,
    },
    ref
  ) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Expose the video element via forwarded ref
  useImperativeHandle(ref, () => videoRef.current!, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Image zoom/pan state
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const isVideo = contentType.startsWith("video/");

  // Track container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    dispatch({ type: "SET_TIME", time: video.currentTime });
    onTimeUpdate?.(video.currentTime);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    dispatch({ type: "SET_DURATION", duration: video.duration });
    onDurationChange?.(video.duration);
    const newState = { ...initialPlayerState, duration: video.duration };
    onReady?.(newState);
  }, [onReady, onDurationChange]);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    const buffered = video.buffered.end(video.buffered.length - 1);
    dispatch({ type: "SET_BUFFERED", buffered });
    onBufferUpdate?.(buffered);
  }, [onBufferUpdate]);

  const handleEnded = useCallback(() => {
    dispatch({ type: "SET_PLAYING", playing: false });
  }, []);

  // Imperative controls via ref-like functions exposed through state + callbacks
  const play = useCallback(() => {
    videoRef.current?.play();
    dispatch({ type: "SET_PLAYING", playing: true });
    onPlay?.();
  }, [onPlay]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    dispatch({ type: "SET_PLAYING", playing: false });
    onPauseProp?.();
  }, [onPauseProp]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    dispatch({ type: "SET_TIME", time });
  }, []);

  const setRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    dispatch({ type: "SET_RATE", rate });
  }, []);

  const setVolume = useCallback((volume: number) => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = volume === 0;
    }
    dispatch({ type: "SET_VOLUME", volume });
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !state.muted;
    video.muted = newMuted;
    dispatch({ type: "SET_MUTED", muted: newMuted });
  }, [state.muted]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      dispatch({ type: "SET_FULLSCREEN", fullscreen: true });
    } else {
      document.exitFullscreen();
      dispatch({ type: "SET_FULLSCREEN", fullscreen: false });
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      dispatch({
        type: "SET_FULLSCREEN",
        fullscreen: !!document.fullscreenElement,
      });
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if our container or its children are focused
      if (
        !containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      ) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          state.playing ? pause() : play();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(Math.max(0, state.currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(Math.min(state.duration, state.currentTime + 5));
          break;
        case "j":
          e.preventDefault();
          seek(Math.max(0, state.currentTime - 10));
          break;
        case "l":
          e.preventDefault();
          seek(Math.min(state.duration, state.currentTime + 10));
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.playing, state.currentTime, state.duration, play, pause, seek, toggleMute, toggleFullscreen]);

  // Image wheel zoom
  const handleImageWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isVideo) return;
      e.preventDefault();
      setImageZoom((prev) => Math.max(0.5, Math.min(5, prev - e.deltaY * 0.002)));
    },
    [isVideo]
  );

  // Image pan handlers
  const handleImagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isVideo || imageZoom <= 1) return;
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - imagePan.x, y: e.clientY - imagePan.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isVideo, imageZoom, imagePan]
  );

  const handleImagePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanningRef.current) return;
      setImagePan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    },
    []
  );

  const handleImagePointerUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Toggle play on click for video
  const handleVideoClick = useCallback(() => {
    if (!isVideo) return;
    state.playing ? pause() : play();
  }, [isVideo, state.playing, play, pause]);

  // Pass controls to children via context-like approach: render props
  const controlProps = {
    playerState: state,
    onPlay: play,
    onPause: pause,
    onSeek: seek,
    onSetRate: setRate,
    onSetVolume: setVolume,
    onToggleMute: toggleMute,
    onToggleFullscreen: toggleFullscreen,
    videoWidth: dimensions.width,
    videoHeight: dimensions.height,
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden select-none group/player",
        className
      )}
      tabIndex={0}
      data-player-controls={JSON.stringify(controlProps)}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={src}
          poster={posterUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onEnded={handleEnded}
          onClick={handleVideoClick}
          playsInline
          preload="metadata"
        />
      ) : (
        <div
          className="w-full h-full overflow-hidden flex items-center justify-center"
          onWheel={handleImageWheel}
          onPointerDown={handleImagePointerDown}
          onPointerMove={handleImagePointerMove}
          onPointerUp={handleImagePointerUp}
          style={{ cursor: imageZoom > 1 ? "grab" : "default", touchAction: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${imageZoom}) translate(${imagePan.x / imageZoom}px, ${imagePan.y / imageZoom}px)`,
              transition: isPanningRef.current ? "none" : "transform 0.1s ease-out",
            }}
            draggable={false}
            onLoad={() => onReady?.(initialPlayerState)}
          />
        </div>
      )}

      {/* Children slot for annotation canvas and controls overlay */}
      {typeof children === "function"
        ? (children as (props: typeof controlProps) => ReactNode)(controlProps)
        : children}
    </div>
  );
});

// Re-export control props type for consumers
export type VideoPlayerControlProps = {
  playerState: PlayerState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSetRate: (rate: number) => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  videoWidth: number;
  videoHeight: number;
};
