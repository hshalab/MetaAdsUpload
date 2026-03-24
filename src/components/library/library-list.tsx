"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import type { Dispatch } from "react";
import type { LibraryAction, SortOption } from "./use-library-store";

interface LibraryListProps {
  sort: SortOption;
  dispatch: Dispatch<LibraryAction>;
  children: React.ReactNode;
}

const COLUMNS: { key: string; label: string; sortAsc?: SortOption; sortDesc?: SortOption; className?: string }[] = [
  { key: "thumb", label: "", className: "w-16" },
  { key: "name", label: "Name", sortAsc: "name_asc", sortDesc: "name_desc" },
  { key: "type", label: "Type", className: "w-20" },
  { key: "duration", label: "Duration", className: "w-24" },
  { key: "resolution", label: "Resolution", className: "w-28" },
  { key: "size", label: "Size", sortAsc: "size_asc", sortDesc: "size_desc", className: "w-24" },
  { key: "status", label: "Status", className: "w-24" },
  { key: "batch", label: "Batch", className: "w-24" },
  { key: "editor", label: "Editor", className: "w-28" },
  { key: "date", label: "Date", sortAsc: "date_asc", sortDesc: "date_desc", className: "w-28" },
];

export function LibraryList({ sort, dispatch, children }: LibraryListProps) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow className="border-white/[0.06] hover:bg-transparent">
          {COLUMNS.map((col) => {
            const isActive = col.sortAsc === sort || col.sortDesc === sort;
            const isAsc = col.sortAsc === sort;
            const canSort = col.sortAsc && col.sortDesc;

            return (
              <TableHead
                key={col.key}
                className={cn(
                  "text-[10px] uppercase tracking-wider text-slate-500 font-medium",
                  col.className,
                  canSort && "cursor-pointer hover:text-slate-300 select-none"
                )}
                onClick={() => {
                  if (!canSort) return;
                  dispatch({
                    type: "SET_SORT",
                    sort: isActive && isAsc ? col.sortDesc! : col.sortAsc!,
                  });
                }}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {isActive && (isAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}
