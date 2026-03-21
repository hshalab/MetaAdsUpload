"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Play, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Rule {
  id: number;
  name: string;
  enabled: boolean;
  level: string;
  conditions: Array<{ metric: string; operator: string; value: number; timeRange: string }>;
  action: { type: string; value?: number };
  cooldownHours: number;
}

interface Execution {
  id: number;
  ruleId: number;
  entityId: string;
  actionTaken: string;
  executedAt: string;
}

const presetRules = [
  { name: "Scale Winner", level: "adset", conditions: [{ metric: "roas", operator: ">", value: 2.0, timeRange: "7d" }, { metric: "spend", operator: ">", value: 500, timeRange: "7d" }], action: { type: "adjust_budget", value: 20 }, cooldownHours: 24 },
  { name: "Pause Loser", level: "adset", conditions: [{ metric: "roas", operator: "<", value: 0.5, timeRange: "3d" }, { metric: "spend", operator: ">", value: 300, timeRange: "3d" }], action: { type: "pause" }, cooldownHours: 24 },
  { name: "High CPA Alert", level: "adset", conditions: [{ metric: "cpa", operator: ">", value: 200, timeRange: "7d" }, { metric: "purchases", operator: ">=", value: 3, timeRange: "7d" }], action: { type: "alert" }, cooldownHours: 48 },
  { name: "Reduce Underperformer", level: "adset", conditions: [{ metric: "roas", operator: "<", value: 1.0, timeRange: "7d" }, { metric: "spend", operator: ">", value: 200, timeRange: "7d" }], action: { type: "adjust_budget", value: -30 }, cooldownHours: 48 },
];

const actionColors: Record<string, string> = {
  pause: "bg-red-500/10 text-red-400 border-red-500/20",
  activate: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  adjust_budget: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  alert: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    level: "adset",
    conditions: [{ metric: "roas", operator: ">", value: 2.0, timeRange: "7d" }],
    action: { type: "pause", value: undefined as number | undefined },
    cooldownHours: 24,
  });

  const fetchRules = async () => {
    const res = await fetch("/api/rules");
    const data = await res.json();
    setRules(data.rules || []);
    setExecutions(data.executions || []);
  };

  useEffect(() => { fetchRules(); }, []);

  const createRule = async (ruleData?: typeof presetRules[0]) => {
    const payload = ruleData || form;
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Rule created");
      setDialogOpen(false);
      fetchRules();
    } catch {
      toast.error("Failed to create rule");
    }
  };

  const toggleRule = async (id: number, enabled: boolean) => {
    await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    fetchRules();
  };

  const deleteRule = async (id: number) => {
    await fetch("/api/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Rule deleted");
    fetchRules();
  };

  const runRules = async () => {
    try {
      const res = await fetch("/api/cron/run-rules", { method: "POST" });
      const data = await res.json();
      toast.success(`Rules executed: ${data.results?.length || 0} actions taken`);
      fetchRules();
    } catch {
      toast.error("Failed to run rules");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-6 w-6 text-cyan-400" />
            Automation Rules
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Auto-manage campaigns based on performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runRules}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
          >
            <Play className="h-4 w-4" />
            Run Now
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Rule
          </button>
        </div>
      </div>

      {/* Quick Add Presets */}
      <div className="rounded-xl border border-white/5 bg-[#111827] p-4">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Quick Add Presets</h3>
        <div className="flex flex-wrap gap-2">
          {presetRules.map((p) => (
            <button
              key={p.name}
              onClick={() => createRule(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Active Rules */}
      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden hover:border-white/10 transition-all">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                <div className="flex items-center gap-2">
                  <Switch checked={r.enabled} onCheckedChange={(v) => toggleRule(r.id, v)} />
                  <button
                    onClick={() => deleteRule(r.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                  {r.level}
                </span>
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  r.enabled
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-white/5 text-slate-500 border-white/10"
                )}>
                  {r.enabled ? "Active" : "Disabled"}
                </span>
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  actionColors[r.action.type] || "bg-white/5 text-slate-400 border-white/10"
                )}>
                  {r.action.type.replace("_", " ")}{r.action.value ? ` ${r.action.value}%` : ""}
                </span>
              </div>
              <div className="mt-3 rounded-lg bg-white/[0.02] border border-white/5 p-2.5 text-xs text-slate-400 space-y-1">
                <p><span className="text-slate-500">If:</span> {r.conditions.map((c) => `${c.metric} ${c.operator} ${c.value} (${c.timeRange})`).join(" AND ")}</p>
                <p><span className="text-slate-500">Cooldown:</span> {r.cooldownHours}h</p>
              </div>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No rules yet. Use a preset or create a custom rule.
          </div>
        )}
      </div>

      {/* Execution Log */}
      {executions.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Recent Executions</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-2.5">Time</th>
                <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-2.5">Entity</th>
                <th className="text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {executions.slice(-20).reverse().map((e) => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5 text-slate-400">{new Date(e.executedAt).toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{e.entityId}</td>
                  <td className="px-4 py-2.5 text-slate-300">{e.actionTaken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-[#111827] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              Create Rule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rule Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white/5 border-white/10 placeholder:text-slate-600"
                placeholder="e.g. Scale Winners"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Level</label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111827] border-white/10">
                  <SelectItem value="campaign">Campaign</SelectItem>
                  <SelectItem value="adset">Ad Set</SelectItem>
                  <SelectItem value="ad">Ad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Action</label>
              <Select value={form.action.type} onValueChange={(v) => setForm({ ...form, action: { ...form.action, type: v } })}>
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111827] border-white/10">
                  <SelectItem value="pause">Pause</SelectItem>
                  <SelectItem value="activate">Activate</SelectItem>
                  <SelectItem value="adjust_budget">Adjust Budget</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.action.type === "adjust_budget" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Budget Change (%)</label>
                <Input
                  type="number"
                  value={form.action.value || 0}
                  onChange={(e) => setForm({ ...form, action: { ...form.action, value: Number(e.target.value) } })}
                  className="bg-white/5 border-white/10"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => createRule()}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 transition-all"
            >
              Create Rule
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
