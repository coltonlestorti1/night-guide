import { Venue } from "@/data/types";

export function formatAgeRange(venue: Venue): string {
  if (
    typeof venue.age_range_min === "number" &&
    typeof venue.age_range_max === "number"
  )
    return `${venue.age_range_min}\u2013${venue.age_range_max}`;
  return "Not provided";
}

/** "just now" / "12m ago" / "2h ago" — coarse on purpose, it's nightlife not logistics. */
export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function formatPriceLevel(n?: number | null): string {
  if (!n) return "Not provided";
  const solid = "$".repeat(n);
  const muted = "$".repeat(Math.max(0, 5 - n));
  return `${solid}${muted}`;
}
