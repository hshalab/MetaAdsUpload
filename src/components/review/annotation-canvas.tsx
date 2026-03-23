"use client";

import { useRef, useEffect, useCallback } from "react";
import type { AnnotationTool, AnnotationData } from "@/lib/review-types";

interface Point {
  x: number;
  y: number;
}

export interface AnnotationCanvasProps {
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  isDrawing: boolean;
  onAnnotationComplete: (annotation: AnnotationData) => void;
  savedAnnotations: AnnotationData[];
  videoWidth?: number;
  videoHeight?: number;
  onStartDrawing: () => void;
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: AnnotationData,
  canvasWidth: number,
  canvasHeight: number
) {
  const pts = annotation.points.map((p) => ({
    x: p.x * canvasWidth,
    y: p.y * canvasHeight,
  }));

  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = annotation.strokeWidth * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (annotation.type) {
    case "arrow": {
      if (pts.length < 2) return;
      const start = pts[0];
      const end = pts[pts.length - 1];
      // Line
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = 14;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle - Math.PI / 6),
        end.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle + Math.PI / 6),
        end.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
      break;
    }
    case "rectangle": {
      if (pts.length < 2) return;
      const [p0, p1] = [pts[0], pts[pts.length - 1]];
      ctx.beginPath();
      ctx.rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      ctx.stroke();
      break;
    }
    case "ellipse": {
      if (pts.length < 2) return;
      const [e0, e1] = [pts[0], pts[pts.length - 1]];
      const cx = (e0.x + e1.x) / 2;
      const cy = (e0.y + e1.y) / 2;
      const rx = Math.abs(e1.x - e0.x) / 2;
      const ry = Math.abs(e1.y - e0.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "freehand": {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      break;
    }
  }
}

export function AnnotationCanvas({
  tool,
  color,
  strokeWidth,
  isDrawing,
  onAnnotationComplete,
  savedAnnotations,
  videoWidth = 1920,
  videoHeight = 1080,
  onStartDrawing,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  // Render saved annotations and current drawing
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved annotations
    for (const ann of savedAnnotations) {
      drawAnnotation(ctx, ann, canvas.width, canvas.height);
    }

    // Draw current stroke in progress
    if (drawingRef.current && pointsRef.current.length >= 2) {
      drawAnnotation(
        ctx,
        {
          type: tool,
          color,
          strokeWidth,
          points: pointsRef.current,
          frameWidth: videoWidth,
          frameHeight: videoHeight,
        },
        canvas.width,
        canvas.height
      );
    }
  }, [savedAnnotations, tool, color, strokeWidth, videoWidth, videoHeight]);

  // Re-render when saved annotations change
  useEffect(() => {
    render();
  }, [render]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        render();
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      pointsRef.current = [getCanvasPoint(e)];
      onStartDrawing();
    },
    [isDrawing, getCanvasPoint, onStartDrawing]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const pt = getCanvasPoint(e);
      if (tool === "freehand") {
        pointsRef.current.push(pt);
      } else {
        // For shapes, keep only start and current point
        pointsRef.current = [pointsRef.current[0], pt];
      }
      render();
    },
    [getCanvasPoint, tool, render]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      drawingRef.current = false;

      if (pointsRef.current.length >= 2) {
        onAnnotationComplete({
          type: tool,
          color,
          strokeWidth,
          points: [...pointsRef.current],
          frameWidth: videoWidth,
          frameHeight: videoHeight,
        });
      }

      pointsRef.current = [];
      render();
    },
    [tool, color, strokeWidth, videoWidth, videoHeight, onAnnotationComplete, render]
  );

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{
        cursor: isDrawing ? "crosshair" : "default",
        pointerEvents: isDrawing ? "auto" : "none",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
