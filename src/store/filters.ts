import { create } from "zustand";

export type Filters = {
  types: string[];
  priceMin?: number;
  priceMax?: number;
  ageMin?: number;
  ageMax?: number;
  hotspots?: boolean;
};

interface FilterState extends Filters {
  set: (partial: Partial<Filters>) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  types: [],
  priceMin: undefined,
  priceMax: undefined,
  ageMin: undefined,
  ageMax: undefined,
  hotspots: false,
  set: (partial) => set((s) => ({ ...s, ...partial })),
  reset: () =>
    set({ types: [], priceMin: undefined, priceMax: undefined, ageMin: undefined, ageMax: undefined, hotspots: false }),
}));
