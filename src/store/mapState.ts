import { create } from "zustand";

/** Persists map viewport so it survives navigation to /venue/:id and back */
interface MapViewState {
  center: [number, number];
  zoom: number;
  setView: (center: [number, number], zoom: number) => void;
}

export const useMapViewStore = create<MapViewState>((set) => ({
  center: [-73.9833, 40.7270],
  zoom: 15,
  setView: (center, zoom) => set({ center, zoom }),
}));
