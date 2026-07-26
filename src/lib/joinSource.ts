/**
 * Resolves the `?source=` param on /join to the venue whose QR code was
 * scanned, so the waitlist page can greet someone by the bar they're standing
 * in ("You're at The Grafton") instead of generic launch copy.
 *
 * Reads the static East Village dataset, NOT Supabase — this runs on the first
 * paint of a signed-out page on bar wifi, and a network round trip is the last
 * thing that moment needs. An unrecognised source (or none) resolves to null
 * and the page falls back to its generic copy.
 *
 * Everything surfaced here is a fact already in the dataset — venue name,
 * neighborhood, how many other venues are within walking distance. No live
 * crowd or activity claims: we have no activity data at scan time and won't
 * fabricate it.
 */
import { EAST_VILLAGE_VENUES } from "@/data/venues";
import { Venue } from "@/data/types";
import { haversineMiles } from "@/lib/distance";
import { normalize } from "@/lib/normalize";

/** Roughly a five-minute walk. */
export const WALKABLE_MILES = 0.25;

/** Collapses "niagara-bar", "Niagara Bar" and "NIAGARA_BAR" to one key. */
const key = (s: string) => normalize(s).replace(/ /g, "");

export type JoinSourceContext = {
  venue: Venue;
  /** Other venues in the dataset within WALKABLE_MILES of it. */
  nearbyCount: number;
};

/**
 * Non-venue sources we mint for flyers, socials and bare links. Listed so a
 * stray "qr" never gets fuzzy-matched into some unrelated bar.
 */
const GENERIC_SOURCES = new Set(["link", "qr", "flyer", "instagram", "ig", "tiktok", "sms"]);

/** The venue whose QR was scanned, or null for generic/unknown sources. */
export function resolveSourceVenue(source: string | null | undefined): Venue | null {
  if (!source) return null;
  const k = key(source);
  if (!k || GENERIC_SOURCES.has(k)) return null;

  return (
    EAST_VILLAGE_VENUES.find((v) => key(v.id) === k) ??
    EAST_VILLAGE_VENUES.find((v) => key(v.title) === k) ??
    null
  );
}

/** How many other venues sit within a short walk of `venue`. */
export function countNearby(venue: Venue, radiusMiles = WALKABLE_MILES): number {
  const from = { lat: venue.latitude, lng: venue.longitude };
  return EAST_VILLAGE_VENUES.filter(
    (v) =>
      v.id !== venue.id &&
      haversineMiles(from, { lat: v.latitude, lng: v.longitude }) <= radiusMiles,
  ).length;
}

/** Full personalisation context for /join, or null to use the generic copy. */
export function resolveJoinSource(source: string | null | undefined): JoinSourceContext | null {
  const venue = resolveSourceVenue(source);
  if (!venue) return null;
  return { venue, nearbyCount: countNearby(venue) };
}
