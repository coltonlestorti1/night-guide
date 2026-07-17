/**
 * Pure venue-proximity detection for "I'm out tonight" mode. No React, no I/O.
 * `rankNearby` sorts venues by distance; `pickConfident` decides whether we're
 * confidently AT the nearest one, guarding against dense-block ambiguity and
 * low GPS accuracy. Thresholds are exported for on-device tuning.
 */
import { haversineMeters } from "@/lib/distance";
import type { Venue } from "@/data/types";
import type { Coords } from "@/store/location";

/** How close (m) to a venue before we call it "you're here". ~half a block. */
export const ARRIVAL_RADIUS_M = 60;
/** Reject fixes blurrier than this (m) — can't tell which bar. */
export const ACCURACY_CEILING_M = 40;
/** Nearest must beat the runner-up by this margin (m) or it's ambiguous. */
export const RUNNER_UP_MARGIN_M = 25;

export type NearbyVenue = { venue: Venue; distanceM: number };

/** All venues sorted nearest-first, with meter distances. */
export function rankNearby(coords: Coords, venues: Venue[]): NearbyVenue[] {
  return venues
    .map((venue) => ({
      venue,
      distanceM: haversineMeters(coords, { lat: venue.latitude, lng: venue.longitude }),
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * The venue we're confidently at, or null. Requires: accuracy within ceiling,
 * nearest within arrival radius, and nearest clearly closer than the runner-up.
 */
export function pickConfident(ranked: NearbyVenue[], accuracyM: number): Venue | null {
  if (accuracyM > ACCURACY_CEILING_M) return null;
  const nearest = ranked[0];
  if (!nearest || nearest.distanceM > ARRIVAL_RADIUS_M) return null;
  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.distanceM - nearest.distanceM < RUNNER_UP_MARGIN_M) return null;
  return nearest.venue;
}
