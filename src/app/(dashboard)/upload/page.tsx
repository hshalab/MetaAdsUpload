"use client";

import { UploadWizard } from "@/components/upload/upload-wizard";
import { UploadQueue } from "@/components/upload/upload-queue";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export default function UploadPage() {
  const { jobs, addJob, startAll, removeJob, clearCompleted } = useUploadQueue();

  const handleAddToQueue = (config: Record<string, unknown>) => {
    addJob(config);
    toast.success("Added to upload queue");
  };

  const handleSaveTemplate = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save template");
      toast.success("Template saved");
    } catch {
      toast.error("Failed to save template");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Upload className="h-6 w-6 text-cyan-400" />
          Upload Ads
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure and upload ads to Meta</p>
      </div>
      <UploadWizard onAddToQueue={handleAddToQueue} onSaveTemplate={handleSaveTemplate} />
      <UploadQueue
        jobs={jobs}
        onStartAll={startAll}
        onRemove={removeJob}
        onClearCompleted={clearCompleted}
      />
    </div>
  );
}
