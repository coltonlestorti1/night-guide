/**
 * User location — opt-in, client-only. Nothing here is ever sent to the server;
 * coords live in memory for the session so the map, cards, and "Find the move"
 * can show distance and rank nearby. Honors ENDZ's consensual-location rule.
 */
import { create } from "zustand";

export type Coords = { lat: number; lng: number };
type Status = "idle" | "prompting" | "granted" | "denied" | "unsupported";

type LocationState = {
  coords: Coords | null;
  status: Status;
  /** Accuracy radius (m) of the latest fix, or null. */
  accuracy: number | null;
  /** Ask the browser for location once; resolves to coords or null if unavailable. */
  request: () => Promise<Coords | null>;
  /** Start continuous foreground tracking (watchPosition). Idempotent. */
  watch: () => void;
  /** Stop continuous tracking. */
  stopWatch: () => void;
};

let watchId: number | null = null;

export const useLocationStore = create<LocationState>((set, get) => ({
  coords: null,
  status: "idle",
  accuracy: null,
  request: () => {
    const existing = get().coords;
    if (existing) return Promise.resolve(existing);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      set({ status: "unsupported" });
      return Promise.resolve(null);
    }
    set({ status: "prompting" });
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          set({ coords: c, status: "granted" });
          resolve(c);
        },
        () => {
          set({ status: "denied" });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  },
  watch: () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      set({ status: "unsupported" });
      return;
    }
    if (watchId !== null) return; // already watching
    set({ status: "prompting" });
    watchId = navigator.geolocation.watchPosition(
      (pos) => set({
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracy: pos.coords.accuracy,
        status: "granted",
      }),
      () => set({ status: "denied" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  },
  stopWatch: () => {
    if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  },
}));
