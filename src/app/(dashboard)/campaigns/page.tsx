"use client";

import { CampaignTree } from "@/components/campaigns/campaign-tree";
import { AlertTriangle, Megaphone } from "lucide-react";
import { toast } from "sonner";

export default function CampaignsPage() {
  const handleEmergencyStop = async () => {
    if (!confirm("Are you sure you want to PAUSE ALL active campaigns?")) return;
    try {
      const res = await fetch("/api/meta/campaigns");
      const data = await res.json();
      const active = (data.data || []).filter((c: { status: string }) => c.status === "ACTIVE");

      for (const campaign of active) {
        await fetch("/api/meta/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: campaign.id, status: "PAUSED" }),
        });
      }
      toast.success(`Paused ${active.length} campaigns`);
    } catch {
      toast.error("Emergency stop failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-cyan-400" />
            Campaign Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">View and control your Meta ad campaigns</p>
        </div>
        <button
          onClick={handleEmergencyStop}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-all"
        >
          <AlertTriangle className="h-4 w-4" />
          Emergency Stop
        </button>
      </div>
      <CampaignTree />
    </div>
  );
}
