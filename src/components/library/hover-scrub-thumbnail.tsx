"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface HoverScrubThumbnailProps {
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  alt: string;
  className?: string;
}

/**
 * Frame.io-style hover scrub thumbnail.
 * Shows a static thumbnail by default. On hover, loads a hidden <video>,
 * seeks on mousemove, and paints frames to a <canvas>.
 */
export function HoverScrubThumbnail({
  videoUrl,
  thumbnailUrl,
  duration,
  alt,
  className,
}: HoverScrubThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [hovering, setHovering] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const seekingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.load();
        videoRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    setHovering(true);
    setCanvasReady(false);

    // Lazy-create video element
    if (!videoRef.current) {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.src = videoUrl;
      videoRef.current = video;

      video.onseeked = () => {
        seekingRef.current = false;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCanvasReady(true);
      };
    }
  }, [videoUrl]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      const video = videoRef.current;
      if (!container || !video || !duration) return;

      const rect = container.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setScrubProgress(pct);

      if (seekingRef.current) return;

      // Throttle seeks to animation frames
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!video || video.readyState < 1) return;
        seekingRef.current = true;
        video.currentTime = pct * (duration || video.duration || 0);
      });
    },
    [duration]
  );

  const handleMouseLeave = useCallback(() => {
    setHovering(false);
    setCanvasReady(false);
    setScrubProgress(0);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Static thumbnail (visible when not scrubbing). Without a stored
          thumbnail, a metadata-only <video> paints the first frame — an <img>
          pointed at a video file renders nothing. #t=0.1 forces the seek. */}
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={alt}
          className="h-full w-full object-cover"
          style={{
            opacity: hovering && canvasReady ? 0 : 1,
            transition: "opacity 0.15s ease",
          }}
        />
      ) : (
        <video
          src={`${videoUrl}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{
            opacity: hovering && canvasReady ? 0 : 1,
            transition: "opacity 0.15s ease",
          }}
        />
      )}

      {/* Canvas (visible when scrubbing) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: hovering && canvasReady ? 1 : 0,
          transition: "opacity 0.15s ease",
        }}
      />

      {/* Scrub progress bar */}
      {hovering && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-cyan-400 transition-none"
            style={{ width: `${scrubProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
