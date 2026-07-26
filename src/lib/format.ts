import { Venue } from "@/data/types";

/**
 * formatAgeRange was removed 2026-07-25. It had no callers and formatted any
 * band verbatim, so calling it would have printed a sub-21 range and bypassed
 * the rule below. Use formatAgeDisplay \u2014 it is the only supported path.
 */

/** Legal drinking age \u2014 no band starting below this ever renders. */
const MIN_DISPLAYABLE_AGE = 21;

/**
 * The only place the who-goes string is composed. Numeric band for everyone
 * except the youngest cohort, which shows as "College scene" with no number;
 * mixed venues show both.
 *
 *   College scene + 21-25  ->  "College scene \u00b7 21\u201325"
 *   College scene, no band ->  "College scene"
 *   21-30                  ->  "21\u201330"
 *   nothing                ->  null (caller omits the tile)
 *
 * A band whose lower bound is under 21 has its numeric half suppressed. That
 * guard is what makes "the string 18\u201321 never renders" true structurally
 * rather than by convention, even if bad data reaches the column later.
 */
export function formatAgeDisplay(venue: Venue): string | null {
  const { age_range_min: min, age_range_max: max, is_college_scene } = venue;
  const hasBand = typeof min === "number" && typeof max === "number";
  const bandIsShowable = hasBand && min >= MIN_DISPLAYABLE_AGE;
  const band = bandIsShowable ? `${min}\u2013${max}` : null;

  if (is_college_scene) return band ? `College scene \u00b7 ${band}` : "College scene";
  return band;
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
