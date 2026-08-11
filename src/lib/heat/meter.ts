import { HeatLabel } from "@/lib/heat/types";
import {
  ACTIVITY_HOT,
  ACTIVITY_QUIET,
  ACTIVITY_TRENDING,
} from "@/lib/heat/activityColors";

/** How many of the five segments a score fills. */
export const METER_SEGMENTS = 5;

/**
 * Segments lit for a 0–100 heat score.
 *
 * Twenty points per segment, with a floor of one. The floor matters: a venue
 * that is open and quiet should read as "the low end of a scale", not as a row
 * of empty boxes indistinguishable from no data at all.
 *
 * The boundaries are deliberately compatible with scoreLabel's bands, so the
 * meter and the word can never contradict each other:
 *
 *   Quiet    0–29   -> 1–2 segments
 *   Building 30–54  -> 2–3
 *   Busy     55–74  -> 3–4
 *   Hot Now  75–100 -> 4–5
 *
 * The overlap is the point. Two venues both labelled "Busy" can read 3 and 4 —
 * that gradation is information the label throws away, and it is the reason
 * this exists.
 */
export function segmentsForScore(score: number): number {
  if (!Number.isFinite(score)) return 1;
  // The min/max pair clamps the RESULT, which covers an out-of-range score too:
  // -20 floors to 1, 140 ceilings to 5. Clamping the input first as well was
  // dead code — mutation-testing removed it with no test noticing.
  return Math.min(METER_SEGMENTS, Math.max(1, Math.ceil(score / 20)));
}

/**
 * The fill colour for the lit segments, by band.
 *
 * ONE colour across all lit segments, never a gradient or a per-segment ramp:
 * the colour says which band, the count says how much. A rainbow here would
 * imply the segments mean different things individually, which they do not.
 *
 * The three values ARE the map pin rings — same palette, same meaning, shared
 * from one module so the two surfaces cannot drift. An earlier version used
 * green for Quiet, which appears nowhere in the map legend and made the meter
 * and the map disagree about what "quiet" looks like.
 *
 * Building and Busy deliberately share a hue — the segment COUNT is what
 * separates them, which is exactly the information the label was losing.
 */
export function meterFill(label: HeatLabel): string {
  switch (label) {
    case "Hot Now":
      return ACTIVITY_HOT;
    case "Busy":
    case "Building":
      return ACTIVITY_TRENDING;
    default:
      // Quiet, and Closed if it ever reaches here.
      return ACTIVITY_QUIET;
  }
}
