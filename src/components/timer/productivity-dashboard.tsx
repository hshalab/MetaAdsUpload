"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Video,
  TrendingUp,
  BarChart3,
  Timer,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "month" | "all";

interface StatsData {
  totalTrackedSeconds: number;
  totalVideosCompleted: number;
  totalOutputSeconds: number;
  avgVideoLengthSeconds: number;
  totalAssigned: number;
  dailyBreakdown: Array<{
    date: string;
    trackedSeconds: number;
    videosCompleted: number;
    outputSeconds: number;
  }>;
  taskTypeBreakdown: Array<{
    taskType: string;
    totalSeconds: number;
  }>;
  period: string;
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

const TASK_TYPE_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  NEW_VIDEO: { bg: "bg-blue-500/20", bar: "bg-blue-500", text: "text-blue-400" },
  VIDEO_SOURCING: { bg: "bg-purple-500/20", bar: "bg-purple-500", text: "text-purple-400" },
  IMAGE_WORK: { bg: "bg-pink-500/20", bar: "bg-pink-500", text: "text-pink-400" },
  STATIC_AD: { bg: "bg-orange-500/20", bar: "bg-orange-500", text: "text-orange-400" },
  REVISION_WORK: { bg: "bg-yellow-500/20", bar: "bg-yellow-500", text: "text-yellow-400" },
  OTHER: { bg: "bg-slate-500/20", bar: "bg-slate-500", text: "text-slate-400" },
};

const TASK_TYPE_LABELS: Record<string, string> = {
  NEW_VIDEO: "New Video",
  VIDEO_SOURCING: "Video Sourcing",
  IMAGE_WORK: "Image Work",
  STATIC_AD: "Static Ad",
  REVISION_WORK: "Revision",
  OTHER: "Other",
  new_video: "New Video",
  revision: "Revision",
  sourcing: "Sourcing",
  static_ad: "Static Ad",
  other: "Other",
};

function formatHours(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatVideoLength(seconds: number): string {
  if (seconds >= 3600) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function getWorkdaysInPeriod(period: Period): number {
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "all":
      return 260; // ~1 year of workdays as fallback
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  let count = 0;
  const current = new Date(startDate);
  while (current <= now) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return Math.max(count, 1);
}

export function ProductivityDashboard() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/time-entries/stats?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#111827] p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const workdays = getWorkdaysInPeriod(period);
  const availableSeconds = workdays * 8 * 3600; // 8h/day
  const utilizationRate = availableSeconds > 0 ? Math.round((data.totalTrackedSeconds / availableSeconds) * 100) : 0;
  const completionRate = data.totalAssigned > 0 ? Math.round((data.totalVideosCompleted / data.totalAssigned) * 100) : 0;
  const efficiencyRatio = data.totalOutputSeconds > 0
    ? (data.totalTrackedSeconds / 60) / (data.totalOutputSeconds / 60)
    : 0;

  // Weekly chart data - last 7 entries from dailyBreakdown
  const chartData = data.dailyBreakdown.slice(-7);
  const maxDailySeconds = Math.max(...chartData.map((d) => d.trackedSeconds), 1);
  const chartMaxHours = Math.ceil(maxDailySeconds / 3600);

  // Task type total for percentage calculation
  const taskTypeTotal = data.taskTypeBreakdown.reduce((sum, t) => sum + t.totalSeconds, 0);

  const stats = [
    {
      label: "Production Efficiency",
      value: efficiencyRatio > 0 ? `${efficiencyRatio.toFixed(1)}x` : "-",
      subtitle: "min editing / min output",
      icon: TrendingUp,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Videos Completed",
      value: data.totalVideosCompleted.toString(),
      subtitle: "in period",
      icon: Video,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Total Output",
      value: data.totalOutputSeconds > 0 ? formatVideoLength(data.totalOutputSeconds) : "-",
      subtitle: "video produced",
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Avg Video Length",
      value: data.avgVideoLengthSeconds > 0 ? formatVideoLength(data.avgVideoLengthSeconds) : "-",
      subtitle: "per video",
      icon: Timer,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Utilization Rate",
      value: `${utilizationRate}%`,
      subtitle: `of ${workdays * 8}h available`,
      icon: BarChart3,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      subtitle: `${data.totalVideosCompleted}/${data.totalAssigned} assigned`,
      icon: CheckCircle,
      color: "text-pink-400",
      bg: "bg-pink-500/10",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            Productivity Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total tracked: {formatHours(data.totalTrackedSeconds)}
          </p>
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                period === opt.value
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/5 bg-[#111827] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Activity</h3>
          <div className="flex items-end gap-2 h-40">
            {chartData.map((day) => {
              const heightPercent = (day.trackedSeconds / (chartMaxHours * 3600)) * 100;
              const dayName = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
              const dayNum = new Date(day.date + "T12:00:00").getDate();
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end h-32 relative group">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-300 min-h-[2px]"
                      style={{ height: `${Math.max(heightPercent, 1)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a2235] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                      {formatHours(day.trackedSeconds)}
                      {day.videosCompleted > 0 && ` | ${day.videosCompleted} video${day.videosCompleted > 1 ? "s" : ""}`}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">{dayName}</span>
                  <span className="text-[10px] text-slate-600">{dayNum}</span>
                </div>
              );
            })}
          </div>
          {/* Y-axis labels */}
          <div className="flex justify-between mt-2 text-[10px] text-slate-600">
            <span>0h</span>
            <span>{chartMaxHours}h</span>
          </div>
        </div>
      )}

      {/* Time Distribution */}
      {data.taskTypeBreakdown.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#111827] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Time Distribution</h3>

          {/* Stacked bar */}
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-white/5">
            {data.taskTypeBreakdown.map((tt) => {
              const percent = taskTypeTotal > 0 ? (tt.totalSeconds / taskTypeTotal) * 100 : 0;
              const colors = TASK_TYPE_COLORS[tt.taskType] || TASK_TYPE_COLORS.OTHER;
              return (
                <div
                  key={tt.taskType}
                  className={cn("h-full transition-all", colors.bar)}
                  style={{ width: `${percent}%` }}
                  title={`${TASK_TYPE_LABELS[tt.taskType] || tt.taskType}: ${formatHours(tt.totalSeconds)}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {data.taskTypeBreakdown.map((tt) => {
              const percent = taskTypeTotal > 0 ? Math.round((tt.totalSeconds / taskTypeTotal) * 100) : 0;
              const colors = TASK_TYPE_COLORS[tt.taskType] || TASK_TYPE_COLORS.OTHER;
              return (
                <div key={tt.taskType} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-3 w-3 rounded-sm", colors.bar)} />
                    <span className="text-slate-300">
                      {TASK_TYPE_LABELS[tt.taskType] || tt.taskType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs">{formatHours(tt.totalSeconds)}</span>
                    <span className={cn("text-xs font-medium w-10 text-right", colors.text)}>
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
