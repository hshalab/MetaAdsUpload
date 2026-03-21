"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  from: Date;
  to: Date;
  onChange: (range: { from: Date; to: Date }) => void;
}

const presets = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeDays, setActiveDays] = useState(7);

  return (
    <div className="flex items-center gap-1.5">
      {/* Preset buttons */}
      <div className="flex rounded-lg border border-white/10 overflow-hidden">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              setActiveDays(preset.days);
              onChange({ from: subDays(new Date(), preset.days), to: new Date() });
            }}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-all",
              activeDays === preset.days
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Date display */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-all" />
          }
        >
          <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
          {format(from, "MMM d")} - {format(to, "MMM d, yyyy")}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#111827] border-white/10" align="end">
          <Calendar
            mode="range"
            selected={{ from, to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onChange({ from: range.from, to: range.to });
                setActiveDays(0);
                setOpen(false);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
