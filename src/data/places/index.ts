/**
 * Venue place identity — street address + map provider place IDs, keyed by
 * venue title (the same key used by src/data/enrichment).
 *
 * Source of truth is scripts/place-ids.json (Google Places match output).
 * places.json is generated from it: address + Google place ID for 43/47
 * venues; 4 venues that failed the Google match have null address/IDs and
 * fall back to coordinates when navigating.
 *
 * Apple place IDs cannot be fetched programmatically — they are added by
 * manual verification with Apple's Place ID Lookup tool. Until a venue is
 * verified, `applePlaceId` stays null and `appleMatchStatus` is "unverified",
 * so directions.ts routes Apple by name + address only. See the runbook in
 * docs/plans/2026-07-15-named-directions-build.md.
 */
import placesJson from "./places.json";

/** Where a venue's Apple listing stands in manual verification. */
export type AppleMatchStatus =
  | "unverified" // not yet checked in the Place ID Lookup tool
  | "verified" // matched to the correct Apple listing, ID recorded
  | "needs_review" // ambiguous / low-confidence match — do NOT link the ID
  | "no_listing"; // venue has no Apple Maps listing (or permanently closed)

export type VenuePlace = {
  /** Name Google matched to, kept for cross-checking the Apple match. */
  matchedName: string | null;
  /** Full street address, e.g. "126 1st Ave, New York, NY 10009, USA". */
  address: string | null;
  /** Verified Google Places ID (used for Google named navigation). */
  googlePlaceId: string | null;
  /** Apple Maps place ID — only trusted when appleMatchStatus === "verified". */
  applePlaceId: string | null;
  appleMatchStatus: AppleMatchStatus;
  /** ISO date the Apple match was verified, or null. */
  appleVerifiedAt: string | null;
};

const places = placesJson as Record<string, VenuePlace>;

/** Address + place-ID record for a venue title, or undefined if none on file. */
export function getVenuePlace(title: string): VenuePlace | undefined {
  return places[title];
}
