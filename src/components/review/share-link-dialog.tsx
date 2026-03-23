"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Link,
  Copy,
  Check,
  Trash2,
  Calendar as CalendarIcon,
  Lock,
  MessageSquare,
  Eye,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShareLink } from "@/lib/review-types";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  shareLinks: ShareLink[];
  onCreateLink: (data: {
    password: string | null;
    expiresAt: string | null;
    allowComments: boolean;
  }) => void;
  onRevokeLink: (linkId: string) => void;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  assignmentId,
  shareLinks,
  onCreateLink,
  onRevokeLink,
}: ShareLinkDialogProps) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [allowComments, setAllowComments] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleCreate = () => {
    onCreateLink({
      password: usePassword && password.trim() ? password.trim() : null,
      expiresAt: useExpiry && expiryDate ? expiryDate.toISOString() : null,
      allowComments,
    });
    // Reset form
    setUsePassword(false);
    setPassword("");
    setUseExpiry(false);
    setExpiryDate(undefined);
    setAllowComments(true);
  };

  const copyLink = (link: ShareLink) => {
    const url = `${window.location.origin}/r/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeLinks = shareLinks.filter((l) => l.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#111827] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-200">
            <Link className="h-4 w-4 text-cyan-400" />
            Share Link
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Create a shareable link for external reviewers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create form */}
          <div className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            {/* Password toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Require password
              </div>
              <Switch
                checked={usePassword}
                onCheckedChange={setUsePassword}
                size="sm"
              />
            </div>
            {usePassword && (
              <Input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 text-sm bg-white/5 border-white/10"
              />
            )}

            {/* Expiry toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                Set expiry date
              </div>
              <Switch
                checked={useExpiry}
                onCheckedChange={setUseExpiry}
                size="sm"
              />
            </div>
            {useExpiry && (
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger
                  className="w-full h-8 px-3 text-sm text-left bg-white/5 border border-white/10 rounded-md text-slate-300 hover:border-white/20 transition-colors"
                >
                  {expiryDate
                    ? expiryDate.toLocaleDateString("sv-SE")
                    : "Select date..."}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#111827] border-white/10">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={(date) => {
                      setExpiryDate(date ?? undefined);
                      setShowDatePicker(false);
                    }}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Allow comments toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                Allow comments
              </div>
              <Switch
                checked={allowComments}
                onCheckedChange={setAllowComments}
                size="sm"
              />
            </div>

            <Button
              size="sm"
              onClick={handleCreate}
              className="w-full h-8 bg-cyan-600 hover:bg-cyan-700 text-white text-xs"
            >
              <Globe className="h-3 w-3 mr-1.5" />
              Create Link
            </Button>
          </div>

          {/* Existing links */}
          {activeLinks.length > 0 && (
            <>
              <Separator className="bg-white/5" />
              <div>
                <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">
                  Active Links ({activeLinks.length})
                </h4>
                <div className="space-y-2">
                  {activeLinks.map((link) => {
                    const fullUrl = typeof window !== "undefined"
                      ? `${window.location.origin}/r/${link.token}`
                      : `/r/${link.token}`;

                    return (
                      <div
                        key={link.id}
                        className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-xs text-slate-300 font-mono truncate block max-w-[200px]"
                              title={fullUrl}
                            >
                              {fullUrl}
                            </span>
                            {link.password && (
                              <Lock className="h-3 w-3 text-slate-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5">
                              <Eye className="h-2.5 w-2.5" />
                              {link.accessCount}
                            </span>
                            {link.expiresAt && (
                              <span>
                                Expires{" "}
                                {new Date(link.expiresAt).toLocaleDateString(
                                  "sv-SE"
                                )}
                              </span>
                            )}
                            <span>
                              Created{" "}
                              {new Date(link.createdAt).toLocaleDateString(
                                "sv-SE"
                              )}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Copy link"
                          onClick={() => copyLink(link)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-cyan-400"
                        >
                          {copiedId === link.id ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Revoke link"
                          onClick={() => onRevokeLink(link.id)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-white/10"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
