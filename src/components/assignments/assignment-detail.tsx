"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Edit2,
  Calendar,
  Clock,
  User,
  Video,
  Target,
  Globe,
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  formatDuration,
  type EditorAssignment,
  type AssignmentStatus,
  type ScriptContent,
} from "@/components/assignments/assignment-card";

const COUNTRY_FLAGS: Record<string, string> = {
  SE: "\u{1F1F8}\u{1F1EA}",
  NO: "\u{1F1F3}\u{1F1F4}",
  DK: "\u{1F1E9}\u{1F1F0}",
  FI: "\u{1F1EB}\u{1F1EE}",
  DE: "\u{1F1E9}\u{1F1EA}",
  UK: "\u{1F1EC}\u{1F1E7}",
  US: "\u{1F1FA}\u{1F1F8}",
};

interface AssignmentDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: EditorAssignment;
  onEdit: () => void;
  onStatusChange: (status: AssignmentStatus, feedback?: string) => void;
}

export function AssignmentDetail({
  open,
  onOpenChange,
  assignment,
  onEdit,
  onStatusChange,
}: AssignmentDetailProps) {
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const status = STATUS_CONFIG[assignment.status];
  const StatusIcon = status.icon;
  const priority = PRIORITY_CONFIG[assignment.priority];
  const script = assignment.scriptContent as ScriptContent | null;
  const countryFlag = assignment.country?.code
    ? COUNTRY_FLAGS[assignment.country.code] || ""
    : "";

  const handleSendToRevision = () => {
    if (revisionFeedback.trim()) {
      onStatusChange("REVISION", revisionFeedback);
      setShowRevisionModal(false);
      setRevisionFeedback("");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  {countryFlag} {assignment.title}
                </DialogTitle>
                {assignment.autoName && (
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    {assignment.autoName}
                  </p>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 pb-6 space-y-5">
              {/* Status & Priority */}
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={cn("flex items-center gap-1.5", status.bgClass, status.color)}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(priority.bgClass, priority.color)}
                >
                  {priority.label} Priority
                </Badge>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {assignment.status === "READY_FOR_REVIEW" && (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => onStatusChange("READY_FOR_POSTING")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowRevisionModal(true)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Send to Revision
                      </Button>
                    </>
                  )}
                  {assignment.status === "READY_FOR_POSTING" && (
                    <Button
                      size="sm"
                      onClick={() => onStatusChange("POSTED")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark as Posted
                    </Button>
                  )}
                  <Select
                    value={assignment.status}
                    onValueChange={(v) => onStatusChange(v as AssignmentStatus)}
                  >
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Change status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_CONFIG) as AssignmentStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_CONFIG[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Revision Feedback */}
              {assignment.status === "REVISION" && assignment.revisionFeedback && (
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Revision Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{assignment.revisionFeedback}</p>
                  </CardContent>
                </Card>
              )}

              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Details
                  </h4>
                  {assignment.format && (
                    <div className="flex items-center gap-3 text-sm">
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Format:</span>
                      <span className="font-medium">{assignment.format.name}</span>
                    </div>
                  )}
                  {assignment.product && (
                    <div className="flex items-center gap-3 text-sm">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Product:</span>
                      <span className="font-medium">{assignment.product.name}</span>
                    </div>
                  )}
                  {assignment.angle && (
                    <div className="flex items-center gap-3 text-sm">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Angle:</span>
                      <span className="font-medium">{assignment.angle.name}</span>
                    </div>
                  )}
                  {assignment.offerType && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Offer Type:</span>
                      <span className="font-medium">{assignment.offerType.name}</span>
                    </div>
                  )}
                  {assignment.landingPage && (
                    <div className="flex items-center gap-3 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Landing Page:</span>
                      <span className="font-medium">{assignment.landingPage}</span>
                    </div>
                  )}
                  {assignment.customerAvatars.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Avatars:</span>
                      <span className="font-medium">{assignment.customerAvatars.join(", ")}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Assignment
                  </h4>
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Editor:</span>
                    <span className="font-medium">{assignment.assignedTo.name}</span>
                  </div>
                  {assignment.creativeStrategist && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Strategist:</span>
                      <span className="font-medium">{assignment.creativeStrategist.name}</span>
                    </div>
                  )}
                  {assignment.dueDate && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Due:</span>
                      <span className="font-medium">
                        {new Date(assignment.dueDate).toLocaleDateString("sv-SE")}
                      </span>
                    </div>
                  )}
                  {assignment.estimatedMinutes && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Estimated:</span>
                      <span className="font-medium">{assignment.estimatedMinutes} min</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Tracked:</span>
                    <span className="font-medium">
                      {assignment.totalTrackedSeconds > 0
                        ? formatDuration(assignment.totalTrackedSeconds)
                        : "Not started"}
                    </span>
                  </div>
                  {assignment.videoLengthSeconds && (
                    <div className="flex items-center gap-3 text-sm">
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Video Length:</span>
                      <span className="font-medium">{assignment.videoLengthSeconds}s</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Google Drive Link */}
              {assignment.googleDriveLink && (
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Deliverable
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={assignment.googleDriveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline flex items-center gap-2 text-sm break-all"
                    >
                      {assignment.googleDriveLink}
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Description */}
              {assignment.description && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Description
                  </h4>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{assignment.description}</p>
                </div>
              )}

              {/* Script Content */}
              {script &&
                (script.hooks.some((h) => h.eng || h.se) ||
                  script.body.eng ||
                  script.body.se) && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Script
                    </h4>
                    <Card>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16"></TableHead>
                              <TableHead>English</TableHead>
                              <TableHead>Swedish</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {script.hooks.map(
                              (hook) =>
                                (hook.eng || hook.se) && (
                                  <TableRow key={hook.id}>
                                    <TableCell className="font-semibold text-muted-foreground">
                                      {hook.label}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {hook.eng || "-"}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {hook.se || "-"}
                                    </TableCell>
                                  </TableRow>
                                )
                            )}
                            {(script.body.eng || script.body.se) && (
                              <TableRow>
                                <TableCell className="font-semibold text-muted-foreground">
                                  Body
                                </TableCell>
                                <TableCell className="text-sm whitespace-pre-wrap">
                                  {script.body.eng || "-"}
                                </TableCell>
                                <TableCell className="text-sm whitespace-pre-wrap">
                                  {script.body.se || "-"}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}

              {/* Time Entries */}
              {assignment.timeEntries && assignment.timeEntries.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Work Sessions
                  </h4>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignment.timeEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-sm">
                                {new Date(entry.startTime).toLocaleDateString("sv-SE")}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {entry.taskType}
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                {entry.duration
                                  ? formatDuration(entry.duration)
                                  : "In progress"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
                <div>
                  Created: {new Date(assignment.createdAt).toLocaleString("sv-SE")}
                </div>
                {assignment.startedAt && (
                  <div>
                    Started: {new Date(assignment.startedAt).toLocaleString("sv-SE")}
                  </div>
                )}
                {assignment.completedAt && (
                  <div>
                    Completed: {new Date(assignment.completedAt).toLocaleString("sv-SE")}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 pb-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Feedback Modal */}
      <Dialog open={showRevisionModal} onOpenChange={setShowRevisionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Send to Revision
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Provide feedback for the editor about what needs to be fixed.
          </p>
          <Textarea
            value={revisionFeedback}
            onChange={(e) => setRevisionFeedback(e.target.value)}
            rows={4}
            placeholder="Describe what needs to be revised..."
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevisionModal(false);
                setRevisionFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSendToRevision}
              disabled={!revisionFeedback.trim()}
            >
              Send to Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
