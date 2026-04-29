import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SavedState {
  ids: string[];
  toggle: (id: string) => void;
  isSaved: (id: string) => boolean;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
      isSaved: (id) => get().ids.includes(id),
    }),
    { name: "endz-saved" }
  )
);
