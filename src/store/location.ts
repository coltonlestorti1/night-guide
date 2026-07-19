/**
 * User location — opt-in, client-only. Nothing here is ever sent to the server;
 * coords live in memory for the session so the map, cards, and "Find the move"
 * can show distance and rank nearby. Honors ENDZ's consensual-location rule.
 */
import { create } from "zustand";

export type Coords = { lat: number; lng: number };
type Status = "idle" | "prompting" | "granted" | "denied" | "unsupported";
type LocationFailure = "denied" | "unavailable" | "timeout";

type LocationState = {
  coords: Coords | null;
  status: Status;
  /** Accuracy radius (m) of the latest fix, or null. */
  accuracy: number | null;
  /** Why the last geolocation attempt failed, or null. */
  failure: LocationFailure | null;
  /** Ask the browser for location once; resolves to coords or null if unavailable. */
  request: () => Promise<Coords | null>;
  /** Start continuous foreground tracking (watchPosition). Idempotent. */
  watch: () => void;
  /** Stop continuous tracking. */
  stopWatch: () => void;
};

let watchId: number | null = null;
let watcherCount = 0;

const failureFromError = (err: GeolocationPositionError): LocationFailure =>
  err.code === err.PERMISSION_DENIED
    ? "denied"
    : err.code === err.TIMEOUT
      ? "timeout"
      : "unavailable";

export const useLocationStore = create<LocationState>((set, get) => ({
  coords: null,
  status: "idle",
  accuracy: null,
  failure: null,
  request: () => {
    const existing = get().coords;
    if (existing) {
      set({ failure: null }); // cached coords = success; don't leave a stale reason
      return Promise.resolve(existing);
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      set({ status: "unsupported" });
      return Promise.resolve(null);
    }
    set({ status: "prompting" });
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          set({ coords: c, accuracy: pos.coords.accuracy, status: "granted", failure: null });
          resolve(c);
        },
        (err) => {
          set({ status: "denied", failure: failureFromError(err) });
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
    watcherCount += 1;
    if (watchId !== null) return; // already watching for an earlier caller
    set({ status: "prompting" });
    watchId = navigator.geolocation.watchPosition(
      (pos) => set({
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracy: pos.coords.accuracy,
        status: "granted",
        failure: null,
      }),
      (err) => set({ status: "denied", failure: failureFromError(err) }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  },
  stopWatch: () => {
    if (watcherCount > 0) watcherCount -= 1;
    if (watcherCount > 0) return; // another caller still needs the stream
    if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  },
}));

/** Whether the Permissions API is available (old iOS Safari lacks it). */
export const hasPermissionsApi = (): boolean =>
  typeof navigator !== "undefined" &&
  "permissions" in navigator &&
  typeof navigator.permissions?.query === "function";

/**
 * Read geolocation permission WITHOUT prompting. Returns "granted" | "prompt" |
 * "denied". Browsers lacking the Permissions API (older Safari) report "prompt"
 * so we simply don't auto-anything — the manual "Locate me" button still works.
 */
export async function geolocationPermission(): Promise<"granted" | "prompt" | "denied"> {
  if (!hasPermissionsApi()) {
    return "prompt";
  }
  try {
    const res = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return res.state as "granted" | "prompt" | "denied";
  } catch {
    return "prompt";
  }
}
