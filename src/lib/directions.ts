/**
 * Directions helpers — build walking/driving deep links for the maps app the
 * user picks. Apple Maps on request, Google Maps as the other option; both
 * route to the venue's exact coordinates.
 */
export type MapsProvider = "apple" | "google";

export function directionsUrl(provider: MapsProvider, lat: number, lng: number): string {
  const dest = `${lat},${lng}`;
  return provider === "apple"
    ? `https://maps.apple.com/?daddr=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function openDirections(provider: MapsProvider, lat: number, lng: number): void {
  window.open(directionsUrl(provider, lat, lng), "_blank", "noopener,noreferrer");
}
