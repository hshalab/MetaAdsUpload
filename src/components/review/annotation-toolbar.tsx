"use client";

import {
  MoveUpRight,
  Square,
  Pencil,
  Circle,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ANNOTATION_COLORS, type AnnotationTool } from "@/lib/review-types";

const TOOLS: { tool: AnnotationTool; icon: React.ElementType; label: string }[] = [
  { tool: "arrow", icon: MoveUpRight, label: "Arrow" },
  { tool: "rectangle", icon: Square, label: "Rectangle" },
  { tool: "freehand", icon: Pencil, label: "Freehand" },
  { tool: "ellipse", icon: Circle, label: "Ellipse" },
];

const STROKE_WIDTHS = [
  { value: 1, label: "Thin", canvasPx: 2 },
  { value: 2, label: "Medium", canvasPx: 4 },
  { value: 4, label: "Thick", canvasPx: 8 },
];

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  activeColor: string;
  activeStrokeWidth: number;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onClear: () => void;
  onCancel: () => void;
  isActive: boolean;
}

export function AnnotationToolbar({
  activeTool,
  activeColor,
  activeStrokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onClear,
  onCancel,
  isActive,
}: AnnotationToolbarProps) {
  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-20 flex flex-col gap-2 bg-black/80 backdrop-blur-sm rounded-lg p-2 border border-white/10 transition-all duration-200 origin-top-right",
        isActive
          ? "opacity-100 scale-100 translate-y-0"
          : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
      )}
    >
      {/* Drawing tools */}
      <div className="flex gap-1">
        {TOOLS.map(({ tool, icon: Icon, label }) => (
          <button
            key={tool}
            type="button"
            title={label}
            aria-label={`${label} tool`}
            aria-pressed={activeTool === tool}
            onClick={() => onToolChange(tool)}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-md transition-all duration-150",
              activeTool === tool
                ? "bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Color swatches */}
      <div className="flex gap-1 justify-center">
        {ANNOTATION_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Color ${color}`}
            aria-pressed={activeColor === color}
            onClick={() => onColorChange(color)}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-all duration-150",
              activeColor === color
                ? "border-white scale-110"
                : "border-transparent hover:border-white/40"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Stroke width -- visual indicator matches canvas stroke */}
      <div className="flex gap-1 justify-center">
        {STROKE_WIDTHS.map(({ value, label, canvasPx }) => (
          <button
            key={value}
            type="button"
            title={label}
            aria-label={`${label} stroke width`}
            aria-pressed={activeStrokeWidth === value}
            onClick={() => onStrokeWidthChange(value)}
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-md transition-all duration-150",
              activeStrokeWidth === value
                ? "bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-400"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            )}
          >
            <div
              className="rounded-full bg-current"
              style={{ width: canvasPx, height: canvasPx }}
            />
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-1 border-t border-white/10 pt-2">
        <button
          type="button"
          aria-label="Clear annotations"
          onClick={onClear}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
        <button
          type="button"
          aria-label="Done annotating"
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
        >
          <X className="h-3 w-3" />
          Done
        </button>
      </div>
    </div>
  );
}
