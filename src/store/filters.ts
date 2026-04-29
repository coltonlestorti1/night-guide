import { create } from "zustand";
import { VenueCategory, CrowdLevel } from "@/data/types";

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
};

interface FilterState extends Filters {
  set: (partial: Partial<Filters>) => void;
  reset: () => void;
}

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
};

export const useFilterStore = create<FilterState>((set) => ({
  ...EMPTY,
  set: (partial) => set((s) => ({ ...s, ...partial })),
  reset: () => set({ ...EMPTY }),
}));
