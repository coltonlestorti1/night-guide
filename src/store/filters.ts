import { create } from "zustand";
import { VenueCategory, CrowdLevel } from "@/data/types";

/**
 * All map filter state lives here — the chip row, the Filters sheet, and the
 * active-count badge read the same object. Before §27 half of it was useState
 * inside MapPage, so the sheet couldn't see it.
 *
 * NO persist middleware, on purpose (Colton, 2026-07-26): filters reset when
 * the app reloads. Nightlife intent changes nightly, and a sticky filter
 * quietly hiding venues is a bad surprise.
 */
export type Filters = {
  types: string[];
  categories: VenueCategory[];
  priceMin?: number;
  priceMax?: number;
  ageMin?: number;
  ageMax?: number;
  hotspots?: boolean;
  crowdLevel?: CrowdLevel;
  musicVibe?: string;
  search?: string;
  /** Client-side toggles, previously MapPage useState. */
  happyHour: boolean;
  saved: boolean;
  rooftop: boolean;
  outdoor: boolean;
  openNow: boolean;
  /** Live check-in activity — the real "Hot Tonight". See HOT_MIN_ACTIVITY. */
  hot: boolean;
};

interface FilterState extends Filters {
  set: (partial: Partial<Filters>) => void;
  reset: () => void;
}

/** "Lively or better" — the same boundary vibeScore uses to call a room lively. */
export const HOT_MIN_ACTIVITY = 3;

const EMPTY: Filters = {
  types: [],
  categories: [],
  priceMin: undefined,
  priceMax: undefined,
  ageMin: undefined,
  ageMax: undefined,
  hotspots: false,
  crowdLevel: undefined,
  musicVibe: undefined,
  search: undefined,
  happyHour: false,
  saved: false,
  rooftop: false,
  outdoor: false,
  openNow: false,
  hot: false,
};

/** Count for the Filters badge. Excludes `search`, which has its own visible
 *  input and its own clear affordance. */
export function activeFilterCount(f: Filters): number {
  return (
    f.categories.length +
    (f.musicVibe ? 1 : 0) +
    (f.happyHour ? 1 : 0) +
    (f.saved ? 1 : 0) +
    (f.rooftop ? 1 : 0) +
    (f.outdoor ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.hot ? 1 : 0) +
    (f.priceMax != null ? 1 : 0)
  );
}

export const useFilterStore = create<FilterState>((set) => ({
  ...EMPTY,
  set: (partial) => set((s) => ({ ...s, ...partial })),
  reset: () => set({ ...EMPTY }),
}));
