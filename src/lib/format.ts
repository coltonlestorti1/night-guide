import { Venue } from "@/data/types";

export function formatAgeRange(venue: Venue): string {
  if (
    typeof venue.age_range_min === "number" &&
    typeof venue.age_range_max === "number"
  )
    return `${venue.age_range_min}\u2013${venue.age_range_max}`;
  return "Not provided";
}

export function formatPriceLevel(n?: number | null): string {
  if (!n) return "Not provided";
  const solid = "$".repeat(n);
  const muted = "$".repeat(Math.max(0, 5 - n));
  return `${solid}${muted}`;
}
