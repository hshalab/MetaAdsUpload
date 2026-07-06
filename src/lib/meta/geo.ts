// ─── Geo targeting groups ────────────────────────────────────────────────────
// A "group" selection (e.g. BIG5) expands to several country codes; a plain
// selection (e.g. "SE") targets that single country. Shared by the uploader
// and the native-ad uploader so the option list + expansion stay in sync.

export const BIG5_COUNTRIES = ["US", "CA", "GB", "AU", "NZ"]; // USA, Canada, UK, Australia, New Zealand

export const COUNTRY_GROUPS: Record<string, string[]> = {
  BIG5: BIG5_COUNTRIES,
};

// Expand a dropdown selection into the list of country codes for geo_locations.
export function countriesForSelection(selection: string): string[] {
  return COUNTRY_GROUPS[selection] ? [...COUNTRY_GROUPS[selection]] : [selection];
}

// Reverse: map a set of country codes back to a dropdown value (group id or single code).
export function selectionForCountries(countries?: string[]): string {
  if (!countries || countries.length === 0) return "SE";
  if (countries.length > 1) {
    const sorted = [...countries].sort().join(",");
    for (const [groupId, codes] of Object.entries(COUNTRY_GROUPS)) {
      if ([...codes].sort().join(",") === sorted) return groupId;
    }
  }
  return countries[0];
}

// Option groups for a country <select>. Rendered identically in both uploaders.
export const COUNTRY_SELECT_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "Groups",
    options: [{ value: "BIG5", label: "🌍 BIG 5 (US · CA · UK · AU · NZ)" }],
  },
  {
    label: "Nordics",
    options: [
      { value: "SE", label: "Sweden" },
      { value: "NO", label: "Norway" },
      { value: "DK", label: "Denmark" },
      { value: "FI", label: "Finland" },
    ],
  },
  {
    label: "English-speaking",
    options: [
      { value: "US", label: "United States" },
      { value: "CA", label: "Canada" },
      { value: "GB", label: "United Kingdom" },
      { value: "AU", label: "Australia" },
      { value: "NZ", label: "New Zealand" },
    ],
  },
];
