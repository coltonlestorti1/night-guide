/**
 * Directions helpers — build NAMED walking deep links for Apple or Google Maps.
 *
 * A bare coordinate makes the maps app drop an unnamed pin. Instead we send the
 * venue name + full street address as the destination (plus a verified place ID
 * when we have one for that provider), so the maps app opens the real venue.
 *
 * Address + place-ID data lives in src/data/places, keyed by venue title.
 * Fallback chain, per provider, safest first:
 *   1. name + address + provider place ID   (most precise)
 *   2. name + address                        (address on file, no verified ID)
 *   3. raw lat/lng                           (no address on file — unnamed pin,
 *                                             but never a wrong-business match)
 *
 * Apple uses the unified maps.apple.com/directions URL (iOS 18.4+ / macOS 15.4+);
 * older devices open it in web Apple Maps. See the runbook in
 * docs/plans/2026-07-15-named-directions-build.md for the Apple place-ID work
 * that upgrades step 2 → step 1 for Apple.
 */
import { getVenuePlace } from "@/data/places";

export type MapsProvider = "apple" | "google";

export type DirectionsTarget = {
  /** Venue display name — must match the key in src/data/places. */
  title: string;
  latitude: number;
  longitude: number;
};

export function directionsUrl(provider: MapsProvider, target: DirectionsTarget): string {
  const place = getVenuePlace(target.title);
  const coords = `${target.latitude},${target.longitude}`;

  // Step 3: no address on file → coordinate fallback. Unnamed pin, but avoids
  // handing the geocoder a bare name that could match a nearby wrong business.
  if (!place?.address) {
    return provider === "apple"
      ? `https://maps.apple.com/directions?destination=${encodeURIComponent(coords)}&mode=walking`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords)}&travelmode=walking`;
  }

  const destination = encodeURIComponent(`${target.title}, ${place.address}`);

  if (provider === "apple") {
    // Only trust the Apple ID once it has been manually verified.
    const idParam =
      place.appleMatchStatus === "verified" && place.applePlaceId
        ? `&destination-place-id=${encodeURIComponent(place.applePlaceId)}`
        : "";
    return `https://maps.apple.com/directions?destination=${destination}${idParam}&mode=walking`;
  }

  // Google place IDs are already verified for all 43 venues that have an address.
  const idParam = place.googlePlaceId
    ? `&destination_place_id=${encodeURIComponent(place.googlePlaceId)}`
    : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}${idParam}&travelmode=walking`;
}

export function openDirections(provider: MapsProvider, target: DirectionsTarget): void {
  window.open(directionsUrl(provider, target), "_blank", "noopener,noreferrer");
}
