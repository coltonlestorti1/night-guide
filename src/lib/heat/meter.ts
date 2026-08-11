import { HeatLabel } from "@/lib/heat/types";

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
 * Every band gets its own HUE, including Quiet. That is not decoration — it is
 * what makes the meter readable. A grey "Quiet" fill sits in the same family as
 * the grey empty track, so lit and unlit could only be told apart by lightness,
 * and on a near-white panel there is not enough room between them: measured in
 * the browser, the empty track came out at 1.17:1 against the card and the
 * whole scale read as one floating block instead of "1 of 5".
 *
 * The progression matches the crowd dots BarCard already uses (emerald, amber,
 * rose), so the two surfaces speak one colour language.
 *
 * Building and Busy deliberately share a hue — the segment COUNT is what
 * separates them, which is exactly the information the label was losing.
 */
export function meterFill(label: HeatLabel): string {
  switch (label) {
    case "Hot Now":
      return "bg-[hsl(var(--hot))]";
    case "Busy":
    case "Building":
      return "bg-[hsl(var(--trending))]";
    default:
      // Quiet, and Closed if it ever reaches here. Green reads as "easy door"
      // rather than "broken", and keeps a lit segment distinct from the track.
      return "bg-[hsl(var(--friends))]";
  }
}

/**
 * The unlit track.
 *
 * Deliberately darker than the card it sits on. `bg-border` measured 1.17:1
 * against the Activity panel — invisible, which destroys the "of five" that
 * makes this a scale rather than a count.
 */
export const METER_EMPTY = "bg-muted-foreground/35";
