/**
 * "I'm out tonight" mode. Client-only, session-scoped (no DB, no persistence).
 * Consumes location fixes, logs confidently-detected venue presence to our
 * metrics (events table, option 4), and raises a check-in prompt (option 1).
 * Hysteresis (CONFIRM_FIXES consecutive confident fixes) stops flip-flop
 * between two close bars. Raw coords never leave the device — only a venue_id
 * + coarse buckets are logged.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { pickConfident, rankNearby } from "@/lib/venueProximity";
import { logEvent } from "@/lib/analytics";
import { useLocationStore, type Coords } from "@/store/location";
import type { Venue } from "@/data/types";

const CONFIRM_FIXES = 2;

const distanceBucket = (m: number) => (m < 20 ? "0-20" : m < 40 ? "20-40" : "40-60");
const accuracyBucket = (m: number) => (m < 15 ? "0-15" : m < 30 ? "15-30" : "30-40");

type OutTonightState = {
  active: boolean;
  promptVenue: Venue | null;
  detectedVenueId: string | null;
  candidateVenueId: string | null;
  candidateStreak: number;
  loggedVenueIds: string[];
  setActive: (on: boolean) => void;
  processFix: (coords: Coords, accuracy: number | null, venues: Venue[]) => void;
  dismissPrompt: () => void;
};

export const useOutTonightStore = create<OutTonightState>((set, get) => ({
  active: false,
  promptVenue: null,
  detectedVenueId: null,
  candidateVenueId: null,
  candidateStreak: 0,
  loggedVenueIds: [],

  setActive: (on) => {
    if (on === get().active) return;
    if (on) {
      logEvent("out_tonight_start");
      set({ active: true });
    } else {
      set({
        active: false,
        promptVenue: null,
        detectedVenueId: null,
        candidateVenueId: null,
        candidateStreak: 0,
        loggedVenueIds: [],
      });
    }
  },

  processFix: (coords, accuracy, venues) => {
    const s = get();
    if (!s.active || accuracy === null) return;
    const ranked = rankNearby(coords, venues);
    const confident = pickConfident(ranked, accuracy);

    if (!confident) {
      set({ candidateVenueId: null, candidateStreak: 0 });
      return;
    }

    // Hysteresis: same candidate N fixes in a row before we commit.
    const streak = confident.id === s.candidateVenueId ? s.candidateStreak + 1 : 1;
    set({ candidateVenueId: confident.id, candidateStreak: streak });
    if (streak < CONFIRM_FIXES || confident.id === s.detectedVenueId) return;

    // Newly-committed presence.
    const nearestDist = ranked[0].distanceM;
    if (!s.loggedVenueIds.includes(confident.id)) {
      logEvent("venue_presence", {
        venue_id: confident.id,
        distance_bucket: distanceBucket(nearestDist),
        accuracy_bucket: accuracyBucket(accuracy),
        source: "out_tonight",
      });
    }
    set({
      detectedVenueId: confident.id,
      promptVenue: confident,
      loggedVenueIds: s.loggedVenueIds.includes(confident.id)
        ? s.loggedVenueIds
        : [...s.loggedVenueIds, confident.id],
    });
  },

  dismissPrompt: () => set({ promptVenue: null }),
}));

/**
 * Wires location fixes into the orchestrator while the mode is active.
 * Mount once where the venue list is available (MapPage).
 */
export function useOutTonightWatcher(venues: Venue[]): void {
  const active = useOutTonightStore((s) => s.active);
  const processFix = useOutTonightStore((s) => s.processFix);
  useEffect(() => {
    if (!active) return;
    useLocationStore.getState().watch();
    const unsub = useLocationStore.subscribe((s) => {
      if (s.coords) processFix(s.coords, s.accuracy, venues);
    });
    return () => {
      unsub();
      useLocationStore.getState().stopWatch();
    };
  }, [active, venues, processFix]);
}
