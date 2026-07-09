/**
 * Great-circle distance helpers (miles). Used to show "how far" and to rank
 * nearby venues. Purely client-side.
 */
import { Coords } from "@/store/location";

const EARTH_MILES = 3958.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMiles(a: Coords, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatMiles(mi: number): string {
  if (mi < 0.1) return "< 0.1 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}
