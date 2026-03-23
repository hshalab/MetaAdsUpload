"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  AlertTriangle,
  Upload,
  Share2,
  FileVideo,
  FileImage,
  HardDrive,
  Clock,
  User,
  Layers,
  Columns,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VersionStack } from "@/components/review/version-stack";
import type {
  ReviewAssignment,
  DeliverableVersion,
  ReviewStatus,
} from "@/lib/review-types";
import { formatTimeSimple } from "@/lib/review-types";

const ASSIGNMENT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgClass: string }
> = {
  READY_FOR_EDITING: {
    label: "Ready for Editing",
    color: "text-blue-400",
    bgClass: "bg-blue-500/10 border-blue-500/20",
  },
  EDITING_NOW: {
    label: "Editing Now",
    color: "text-yellow-400",
    bgClass: "bg-yellow-500/10 border-yellow-500/20",
  },
  READY_FOR_REVIEW: {
    label: "Review",
    color: "text-purple-400",
    bgClass: "bg-purple-500/10 border-purple-500/20",
  },
  REVISION: {
    label: "Revision",
    color: "text-red-400",
    bgClass: "bg-red-500/10 border-red-500/20",
  },
  READY_FOR_POSTING: {
    label: "Ready",
    color: "text-emerald-400",
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
  },
  POSTED: {
    label: "Posted",
    color: "text-slate-400",
    bgClass: "bg-slate-500/10 border-slate-500/20",
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; bgClass: string }
> = {
  URGENT: {
    label: "Urgent",
    color: "text-red-400",
    bgClass: "bg-red-500/10 border-red-500/20",
  },
  HIGH: {
    label: "High",
    color: "text-orange-400",
    bgClass: "bg-orange-500/10 border-orange-500/20",
  },
  MEDIUM: {
    label: "Medium",
    color: "text-blue-400",
    bgClass: "bg-blue-500/10 border-blue-500/20",
  },
  LOW: {
    label: "Low",
    color: "text-slate-400",
    bgClass: "bg-slate-500/10 border-slate-500/20",
  },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

interface ReviewSidebarProps {
  assignment: ReviewAssignment;
  versions: DeliverableVersion[];
  currentVersion: DeliverableVersion | null;
  onVersionSelect: (versionId: string) => void;
  onStatusChange: (status: ReviewStatus) => void;
  onUploadNew?: () => void;
  onShareLink?: () => void;
  onCompare?: () => void;
}

export function ReviewSidebar({
  assignment,
  versions,
  currentVersion,
  onVersionSelect,
  onStatusChange,
  onUploadNew,
  onShareLink,
  onCompare,
}: ReviewSidebarProps) {
  const statusConfig = ASSIGNMENT_STATUS_CONFIG[assignment.status] || {
    label: assignment.status,
    color: "text-slate-400",
    bgClass: "bg-slate-500/10 border-slate-500/20",
  };
  const priorityConfig = PRIORITY_CONFIG[assignment.priority] || {
    label: assignment.priority,
    color: "text-slate-400",
    bgClass: "bg-slate-500/10 border-slate-500/20",
  };

  const isVideo = currentVersion?.contentType?.startsWith("video/");
  const FileIcon = isVideo ? FileVideo : FileImage;
  const overdue = isOverdue(assignment.dueDate) && !["POSTED", "READY_FOR_POSTING"].includes(assignment.status);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Assignment header */}
        <div>
          <div className="flex items-center gap-2">
            {/* File type icon */}
            <FileIcon className="h-4 w-4 text-slate-500 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-slate-200 leading-tight truncate">
              {assignment.autoName || assignment.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
            <Layers className="h-3 w-3" />
            Batch {assignment.batchNumber}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                statusConfig.bgClass,
                statusConfig.color
              )}
            >
              {statusConfig.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                priorityConfig.bgClass,
                priorityConfig.color
              )}
            >
              {priorityConfig.label}
            </Badge>
          </div>
        </div>

        <Separator className="bg-white/5" />

        {/* Version Stack */}
        <div>
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">
            Versions
          </h3>
          {currentVersion && (
            <VersionStack
              versions={versions}
              currentVersionId={currentVersion.id}
              onVersionSelect={onVersionSelect}
              onUploadNew={onUploadNew}
            />
          )}
        </div>

        <Separator className="bg-white/5" />

        {/* File info */}
        {currentVersion && (
          <div>
            <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">
              File Info
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-slate-300 truncate text-xs">
                  {currentVersion.filename}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <HardDrive className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-slate-300 text-xs">
                  {formatFileSize(currentVersion.fileSize)}
                </span>
              </div>
              {currentVersion.width && currentVersion.height && (
                <div className="flex items-center gap-2 text-slate-400">
                  <FileImage className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-slate-300 text-xs">
                    {currentVersion.width} x {currentVersion.height}
                  </span>
                </div>
              )}
              {currentVersion.duration != null && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-slate-300 text-xs">
                    {formatTimeSimple(currentVersion.duration)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <Separator className="bg-white/5" />

        {/* Quick Actions -- more prominent styling */}
        <div>
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Button
              size="sm"
              onClick={() => onStatusChange("approved")}
              className="w-full h-9 bg-green-600 hover:bg-green-700 text-white text-xs justify-start font-medium shadow-sm shadow-green-900/20"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange("needs_review")}
              className="w-full h-9 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10 justify-start font-medium"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Request Changes
            </Button>

            <div className="border-t border-white/5 pt-2 space-y-1.5">
              {onUploadNew && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onUploadNew}
                  className="w-full h-8 text-xs text-slate-300 hover:bg-white/5 justify-start"
                >
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  Upload New Version
                </Button>
              )}
              {onCompare && versions.length >= 2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCompare}
                  className="w-full h-8 text-xs text-slate-300 hover:bg-white/5 justify-start"
                >
                  <Columns className="h-3.5 w-3.5 mr-2" />
                  Compare Versions
                </Button>
              )}
              {onShareLink && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onShareLink}
                  className="w-full h-8 text-xs text-slate-300 hover:bg-white/5 justify-start"
                >
                  <Share2 className="h-3.5 w-3.5 mr-2" />
                  Share Link
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Assignment details */}
        <Separator className="bg-white/5" />
        <div>
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">
            Details
          </h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-slate-300">
                {assignment.assignedTo.name}
              </span>
            </div>
            {assignment.format && (
              <div className="flex items-center gap-2 text-slate-400">
                <FileVideo className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-slate-300">{assignment.format.name}</span>
              </div>
            )}
            {assignment.product && (
              <div className="flex items-center gap-2 text-slate-400">
                <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-slate-300">
                  {assignment.product.name}
                </span>
              </div>
            )}
            {assignment.dueDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                <span
                  className={cn(
                    overdue ? "text-red-400 font-medium" : "text-slate-300"
                  )}
                >
                  Due {new Date(assignment.dueDate).toLocaleDateString("sv-SE")}
                  {overdue && " (overdue)"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
