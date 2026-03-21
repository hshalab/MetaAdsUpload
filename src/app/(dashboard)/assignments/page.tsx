"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutGrid,
  Plus,
  Search,
  X,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  AssignmentCard,
  STATUS_CONFIG,
  type EditorAssignment,
  type AssignmentStatus,
  type AssignmentPriority,
} from "@/components/assignments/assignment-card";
import { AssignmentModal } from "@/components/assignments/assignment-modal";
import { AssignmentDetail } from "@/components/assignments/assignment-detail";

interface AssignmentBoard {
  READY_FOR_EDITING: EditorAssignment[];
  EDITING_NOW: EditorAssignment[];
  READY_FOR_REVIEW: EditorAssignment[];
  REVISION: EditorAssignment[];
  READY_FOR_POSTING: EditorAssignment[];
  POSTED: EditorAssignment[];
}

interface AssignmentStats {
  total: number;
  byStatus: Record<string, number>;
  overdue: number;
  avgTimeSeconds: number;
}

interface OptionItem {
  id: string;
  name: string;
  code?: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role?: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Kanban Column
function KanbanColumn({
  status,
  assignments,
  onCardClick,
  onStatusChange,
}: {
  status: AssignmentStatus;
  assignments: EditorAssignment[];
  onCardClick: (a: EditorAssignment) => void;
  onStatusChange: (id: string, status: AssignmentStatus) => void;
}) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div className={`rounded-t-lg px-4 py-3 border ${config.bgClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${config.color}`} />
            <h3 className={`text-sm font-semibold ${config.color}`}>{config.label}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {assignments.length}
          </Badge>
        </div>
      </div>
      <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2">
        {assignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onClick={() => onCardClick(assignment)}
            onStatusChange={(newStatus) => onStatusChange(assignment.id, newStatus)}
          />
        ))}
        {assignments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No assignments
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const [board, setBoard] = useState<AssignmentBoard | null>(null);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Users and options for filters
  const [users, setUsers] = useState<UserItem[]>([]);
  const [formats, setFormats] = useState<OptionItem[]>([]);
  const [products, setProducts] = useState<OptionItem[]>([]);

  // Filters
  const [filters, setFilters] = useState<{
    assignedToId?: string;
    formatId?: string;
    productId?: string;
    priority?: AssignmentPriority;
  }>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EditorAssignment | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<EditorAssignment | null>(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.assignedToId) params.set("assignedToId", filters.assignedToId);
      if (filters.formatId) params.set("formatId", filters.formatId);
      if (filters.productId) params.set("productId", filters.productId);
      if (filters.priority) params.set("priority", filters.priority);

      const [boardRes, statsRes] = await Promise.all([
        fetch(`/api/assignments/board?${params}`),
        fetch("/api/assignments/stats"),
      ]);

      if (!boardRes.ok) throw new Error("Failed to fetch board");
      const boardData = await boardRes.json();
      setBoard(boardData);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch filter options
  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((r) => r.json()).catch(() => ({ users: [] })),
      fetch("/api/options").then((r) => r.json()).catch(() => ({ formats: [], products: [] })),
    ]).then(([usersData, optionsData]) => {
      setUsers(usersData.users || []);
      setFormats(optionsData.formats || []);
      setProducts(optionsData.products || []);
    });
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const editors = users.filter((u) => u.role === "EMPLOYEE" || u.role === "EDITOR");

  const handleStatusChange = async (assignmentId: string, newStatus: AssignmentStatus) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      fetchBoard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCardClick = (assignment: EditorAssignment) => {
    setViewingAssignment(assignment);
  };

  // Client-side search filter
  const filterBySearch = (assignments: EditorAssignment[]) => {
    if (!searchQuery) return assignments;
    const q = searchQuery.toLowerCase();
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.autoName?.toLowerCase().includes(q) ||
        a.assignedTo.name.toLowerCase().includes(q) ||
        a.angle?.name.toLowerCase().includes(q) ||
        a.batchNumber.toString().includes(q)
    );
  };

  const hasFilters = filters.assignedToId || filters.formatId || filters.productId || filters.priority || searchQuery;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <LayoutGrid className="h-7 w-7" />
            Editor Assignments
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage video and graphic production tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBoard} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingAssignment(null);
              setShowCreateModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Assignment
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Progress</span>
                <span className="text-2xl font-bold text-yellow-400">
                  {(stats.byStatus?.EDITING_NOW || 0) + (stats.byStatus?.REVISION || 0)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">For Review</span>
                <span className="text-2xl font-bold text-purple-400">
                  {stats.byStatus?.READY_FOR_REVIEW || 0}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overdue</span>
                <span className="text-2xl font-bold text-red-400">{stats.overdue}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Time</span>
                <span className="text-2xl font-bold">
                  {stats.avgTimeSeconds > 0 ? formatDuration(stats.avgTimeSeconds) : "-"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search batch, name, editor..."
                className="pl-9"
              />
            </div>

            <Select
              value={filters.assignedToId || "all"}
              onValueChange={(v) =>
                setFilters({ ...filters, assignedToId: v === "all" ? undefined : v })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Editors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Editors</SelectItem>
                {editors.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.formatId || "all"}
              onValueChange={(v) =>
                setFilters({ ...filters, formatId: v === "all" ? undefined : v })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Formats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                {formats.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.priority || "all"}
              onValueChange={(v) =>
                setFilters({
                  ...filters,
                  priority: v === "all" ? undefined : (v as AssignmentPriority),
                })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({});
                  setSearchQuery("");
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Could not load assignments</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchBoard}>Retry</Button>
          </CardContent>
        </Card>
      ) : board ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(Object.keys(STATUS_CONFIG) as AssignmentStatus[]).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              assignments={filterBySearch(board[status] || [])}
              onCardClick={handleCardClick}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No assignments yet. Create your first one!</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <AssignmentModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        assignment={editingAssignment}
        onSaved={fetchBoard}
      />

      {/* Detail Modal */}
      {viewingAssignment && (
        <AssignmentDetail
          open={!!viewingAssignment}
          onOpenChange={(open) => {
            if (!open) setViewingAssignment(null);
          }}
          assignment={viewingAssignment}
          onEdit={() => {
            setEditingAssignment(viewingAssignment);
            setViewingAssignment(null);
            setShowCreateModal(true);
          }}
          onStatusChange={(status, feedback) => {
            fetch(`/api/assignments/${viewingAssignment.id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status, revisionFeedback: feedback }),
            }).then(() => {
              setViewingAssignment(null);
              fetchBoard();
            });
          }}
        />
      )}
    </div>
  );
}
