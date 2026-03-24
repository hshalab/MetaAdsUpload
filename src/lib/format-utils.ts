/** Format seconds into m:ss or h:mm:ss */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format bytes into human-readable size */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Format width x height into resolution string */
export function formatResolution(
  width: number | null | undefined,
  height: number | null | undefined
): string {
  if (!width || !height) return "—";
  // Common aspect ratio labels
  const ratio = width / height;
  let label = "";
  if (Math.abs(ratio - 16 / 9) < 0.05) label = "16:9";
  else if (Math.abs(ratio - 9 / 16) < 0.05) label = "9:16";
  else if (Math.abs(ratio - 1) < 0.05) label = "1:1";
  else if (Math.abs(ratio - 4 / 5) < 0.05) label = "4:5";
  else if (Math.abs(ratio - 4 / 3) < 0.05) label = "4:3";

  const res = `${width}×${height}`;
  return label ? `${res} (${label})` : res;
}

/** Short resolution badge like "1080p" or "4K" */
export function formatResolutionShort(
  width: number | null | undefined,
  height: number | null | undefined
): string | null {
  if (!width || !height) return null;
  const maxDim = Math.max(width, height);
  if (maxDim >= 3840) return "4K";
  if (maxDim >= 2560) return "1440p";
  if (maxDim >= 1920) return "1080p";
  if (maxDim >= 1280) return "720p";
  if (maxDim >= 854) return "480p";
  return `${maxDim}p`;
}
