// Known Meta pixels per brand. Surfaced as one-click presets in the uploader
// and Settings so you don't have to remember/paste the IDs.
export interface KnownPixel {
  label: string;
  id: string;
}

export const KNOWN_PIXELS: KnownPixel[] = [
  { label: "ApotekHunden", id: "1485774658810931" },
  { label: "DogDivaCO", id: "3401593933335351" },
];

/** Brand label for a pixel id, if it's one of the known pixels. */
export function pixelLabel(id?: string | null): string | undefined {
  if (!id) return undefined;
  return KNOWN_PIXELS.find((p) => p.id === id)?.label;
}
