/**
 * Baseline heat: the archetype curve, reshaped by any researched windows, then
 * lifted by posted events. Pure — `now` is always an argument.
 */
import { curveValue, dayShape, nightlifeDay, DAY_SHAPE_FACTOR } from "@/lib/heat/curves";
import { VenueBaseline, WeeklyEvent } from "@/lib/heat/types";

/** Best nights get most of the way to a weekend shape. */
const BEST_NIGHT_FACTOR = 0.92;

/** Big enough to invert a day-shape — see the spec's Nowhere/Macho Monday case. */
const EVENT_BUMP = 30;
const EVENT_LEAD_MIN = 30;
const EVENT_TAIL_MIN = 180;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Minutes from midnight of the venue's night: 1 AM reads as 1500, not 60. */
export function nightMinutes(now: Date): number {
  const m = now.getHours() * 60 + now.getMinutes();
  return now.getHours() < 5 ? m + 1440 : m;
}

function inWindow(min: number, start?: number, end?: number): boolean {
  return start != null && end != null && min >= start && min < end;
}

export function baselineScore(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  now: Date,
): number {
  const day = nightlifeDay(now);
  const min = nightMinutes(now);

  const shape = dayShape(day);
  const isBestNight = baseline.best_nights?.includes(day) ?? false;
  const factor = isBestNight
    ? Math.max(DAY_SHAPE_FACTOR[shape], BEST_NIGHT_FACTOR)
    : DAY_SHAPE_FACTOR[shape];

  let score = curveValue(baseline.archetype, now.getHours()) * factor;

  // Researched windows override the curve where we actually know the answer.
  if (inWindow(min, baseline.peak_start, baseline.peak_end)) {
    score = Math.max(score, 85 * factor + 15);
  } else if (inWindow(min, baseline.busy_start, baseline.busy_end)) {
    score = Math.max(score, 60 * factor + 10);
  } else if (baseline.busy_start != null && baseline.busy_end != null) {
    // Outside a known busy window, the venue is genuinely quiet.
    score = Math.min(score, 25);
  }

  for (const e of events) {
    if (e.day !== day || e.start_min == null) continue;
    if (min >= e.start_min - EVENT_LEAD_MIN && min < e.start_min + EVENT_TAIL_MIN) {
      score += EVENT_BUMP;
    }
  }

  return clamp(Math.round(score));
}
