"use client";

import { useEffect, useCallback } from "react";
import type { Dispatch } from "react";
import type { LibraryAction, LibraryState, Density } from "./use-library-store";

const DENSITY_KEYS: Record<string, Density> = { "1": "sm", "2": "md", "3": "lg" };

export function useLibraryKeyboard(
  state: LibraryState,
  dispatch: Dispatch<LibraryAction>
) {
  const { creatives, focusIndex, detailAssetId, previewAssetId } = state;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // / focuses search even from anywhere
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>("[data-library-search]");
        searchInput?.focus();
        return;
      }

      // Don't handle other keys if input is focused
      if (isInput) return;

      // If modal/panel is open, let those handle keys
      if (previewAssetId != null) return;
      if (detailAssetId != null) {
        if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "SET_DETAIL", id: null });
        }
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown": {
          e.preventDefault();
          const next = Math.min(focusIndex + 1, creatives.length - 1);
          dispatch({ type: "SET_FOCUS_INDEX", index: next });
          document.querySelector(`[data-creative-id="${creatives[next]?.id}"]`)?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "ArrowLeft":
        case "ArrowUp": {
          e.preventDefault();
          const prev = Math.max(focusIndex - 1, 0);
          dispatch({ type: "SET_FOCUS_INDEX", index: prev });
          document.querySelector(`[data-creative-id="${creatives[prev]?.id}"]`)?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < creatives.length) {
            dispatch({ type: "SET_DETAIL", id: creatives[focusIndex].id });
          }
          break;
        }
        case " ": {
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < creatives.length) {
            dispatch({ type: "SET_PREVIEW", id: creatives[focusIndex].id });
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          dispatch({ type: "CLEAR_SELECTION" });
          dispatch({ type: "SET_FOCUS_INDEX", index: -1 });
          break;
        }
        case "Delete":
        case "Backspace": {
          if (focusIndex >= 0 && focusIndex < creatives.length) {
            e.preventDefault();
            // Toggle selection for archive — actual archive happens via bulk action
            dispatch({ type: "TOGGLE_SELECT", id: creatives[focusIndex].id });
          }
          break;
        }
        case "a": {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            dispatch({ type: "SELECT_ALL" });
          }
          break;
        }
        default: {
          // Density shortcuts: 1, 2, 3
          if (DENSITY_KEYS[e.key]) {
            e.preventDefault();
            dispatch({ type: "SET_DENSITY", density: DENSITY_KEYS[e.key] });
          }
          break;
        }
      }
    },
    [creatives, focusIndex, detailAssetId, previewAssetId, dispatch]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
