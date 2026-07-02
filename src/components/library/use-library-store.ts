"use client";

import { useReducer, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreativeMetricsClient {
  adCount: number;
  activeAdCount: number;
  spend: number;
  revenue: number;
  purchases: number;
  roas: number;
  cpa: number | null;
  ctr: number;
  hookRate: number;
  holdRate: number;
  classification: string | null;
}

export interface Creative {
  id: number;
  name: string;
  type: string;
  source: string;
  thumbnailUrl: string | null;
  r2Url: string | null;
  r2Key: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  tags: string[];
  editorName: string | null;
  batchNumber: string | null;
  status: string;
  assignmentId: string | null;
  createdAt: string;
  metrics?: CreativeMetricsClient | null;
}

export type ViewMode = "grid" | "list";
export type Density = "sm" | "md" | "lg";
export type SortOption =
  | "date_desc" | "date_asc" | "name_asc" | "name_desc" | "size_desc" | "size_asc"
  | "spend_desc" | "roas_desc" | "hook_desc" | "hold_desc" | "ctr_desc";
export type StatusFilter = "all" | "uploaded" | "in_review" | "approved" | "archived";
export type TypeFilter = "all" | "video" | "image";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export interface LibraryState {
  // Data
  creatives: Creative[];
  loading: boolean;
  pagination: { page: number; total: number; totalPages: number };

  // Filters
  search: string;
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  editorFilter: string;
  batchFilter: string;
  sort: SortOption;
  metricDays: number; // performance window: 7 | 14 | 30 | 90 | 0 (lifetime)
  winnersOnly: boolean;
  angleFilter: string;

  // UI
  viewMode: ViewMode;
  density: Density;
  selectedIds: Set<number>;
  focusIndex: number;
  detailAssetId: number | null;
  previewAssetId: number | null;
  showFilters: boolean;
  renamingId: number | null;

  // Uploads
  uploads: UploadItem[];
}

// ─── Actions ────────────────────────────────────────────────────────────────

export type LibraryAction =
  | { type: "SET_CREATIVES"; creatives: Creative[]; pagination: LibraryState["pagination"] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_TYPE_FILTER"; filter: TypeFilter }
  | { type: "SET_STATUS_FILTER"; filter: StatusFilter }
  | { type: "SET_EDITOR_FILTER"; filter: string }
  | { type: "SET_BATCH_FILTER"; filter: string }
  | { type: "SET_SORT"; sort: SortOption }
  | { type: "SET_METRIC_DAYS"; days: number }
  | { type: "SET_WINNERS_ONLY"; on: boolean }
  | { type: "SET_ANGLE_FILTER"; angleId: string }
  | { type: "SET_VIEW_MODE"; mode: ViewMode }
  | { type: "SET_DENSITY"; density: Density }
  | { type: "TOGGLE_SELECT"; id: number }
  | { type: "SELECT_ALL" }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_FOCUS_INDEX"; index: number }
  | { type: "SET_DETAIL"; id: number | null }
  | { type: "SET_PREVIEW"; id: number | null }
  | { type: "SET_SHOW_FILTERS"; show: boolean }
  | { type: "SET_RENAMING"; id: number | null }
  | { type: "ADD_UPLOADS"; items: UploadItem[] }
  | { type: "UPDATE_UPLOAD"; id: string; progress?: number; status?: UploadItem["status"]; error?: string }
  | { type: "CLEAR_DONE_UPLOADS" };

// ─── Reducer ────────────────────────────────────────────────────────────────

export const initialState: LibraryState = {
  creatives: [],
  loading: true,
  pagination: { page: 1, total: 0, totalPages: 0 },
  search: "",
  typeFilter: "all",
  statusFilter: "all",
  editorFilter: "",
  batchFilter: "",
  sort: "date_desc",
  metricDays: 30,
  winnersOnly: false,
  angleFilter: "",
  viewMode: "grid",
  density: "md",
  selectedIds: new Set(),
  focusIndex: -1,
  detailAssetId: null,
  previewAssetId: null,
  showFilters: false,
  renamingId: null,
  uploads: [],
};

export function libraryReducer(state: LibraryState, action: LibraryAction): LibraryState {
  switch (action.type) {
    case "SET_CREATIVES":
      return { ...state, creatives: action.creatives, pagination: action.pagination, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_SEARCH":
      return { ...state, search: action.search };
    case "SET_TYPE_FILTER":
      return { ...state, typeFilter: action.filter };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.filter };
    case "SET_EDITOR_FILTER":
      return { ...state, editorFilter: action.filter };
    case "SET_BATCH_FILTER":
      return { ...state, batchFilter: action.filter };
    case "SET_SORT":
      return { ...state, sort: action.sort };
    case "SET_METRIC_DAYS":
      return { ...state, metricDays: action.days };
    case "SET_WINNERS_ONLY":
      return { ...state, winnersOnly: action.on };
    case "SET_ANGLE_FILTER":
      return { ...state, angleFilter: action.angleId };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SET_DENSITY":
      return { ...state, density: action.density };
    case "TOGGLE_SELECT": {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedIds: next };
    }
    case "SELECT_ALL": {
      if (state.selectedIds.size === state.creatives.length) return { ...state, selectedIds: new Set() };
      return { ...state, selectedIds: new Set(state.creatives.map((c) => c.id)) };
    }
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: new Set() };
    case "SET_FOCUS_INDEX":
      return { ...state, focusIndex: action.index };
    case "SET_DETAIL":
      return { ...state, detailAssetId: action.id };
    case "SET_PREVIEW":
      return { ...state, previewAssetId: action.id };
    case "SET_SHOW_FILTERS":
      return { ...state, showFilters: action.show };
    case "SET_RENAMING":
      return { ...state, renamingId: action.id };
    case "ADD_UPLOADS":
      return { ...state, uploads: [...state.uploads, ...action.items] };
    case "UPDATE_UPLOAD":
      return {
        ...state,
        uploads: state.uploads.map((u) =>
          u.id === action.id
            ? { ...u, ...(action.progress !== undefined && { progress: action.progress }), ...(action.status && { status: action.status }), ...(action.error && { error: action.error }) }
            : u
        ),
      };
    case "CLEAR_DONE_UPLOADS":
      return { ...state, uploads: state.uploads.filter((u) => u.status !== "done") };
    default:
      return state;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLibraryStore() {
  const [state, dispatch] = useReducer(libraryReducer, initialState);

  const getCreativeById = useCallback(
    (id: number | null) => (id != null ? state.creatives.find((c) => c.id === id) ?? null : null),
    [state.creatives]
  );

  const focusedCreative = state.focusIndex >= 0 && state.focusIndex < state.creatives.length
    ? state.creatives[state.focusIndex]
    : null;

  return { state, dispatch, getCreativeById, focusedCreative };
}
