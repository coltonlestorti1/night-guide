/**
 * Baseline heat: the archetype curve, reshaped by any researched windows, then
 * lifted by posted events. Pure — `now` is always an argument.
 */
import { curveValue, dayShape, nightlifeDay, DAY_SHAPE_FACTOR } from "@/lib/heat/curves";
import { VenueBaseline, WeeklyEvent } from "@/lib/heat/types";

/** Best nights get most of the way to a weekend shape. */
const BEST_NIGHT_FACTOR = 0.92;

/**
 * Researched-window floors. Peak reaches "Hot Now" (75+) on a weekend without
 * touching 100, leaving room for live signals to move the number.
 */
const PEAK_FLOOR = 78;
const PEAK_BONUS = 10;
const BUSY_FLOOR = 55;
const BUSY_BONUS = 8;

/**
 * Event lift, applied with diminishing returns against the remaining headroom.
 * Big enough to invert a day-shape on a quiet night — the spec's
 * Nowhere/Macho Monday case — while adding little to an already-packed room,
 * which is both truer to how crowds work and keeps room for live signals.
 */
const EVENT_BUMP = 40;
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
  // These deliberately land short of 100: a baseline pinned at the ceiling
  // cannot be moved by live signals, which would defeat the blend. Peak lands
  // in "Hot Now" with headroom above it for real people to push into.
  if (inWindow(min, baseline.peak_start, baseline.peak_end)) {
    score = Math.max(score, PEAK_FLOOR * factor + PEAK_BONUS);
  } else if (inWindow(min, baseline.busy_start, baseline.busy_end)) {
    score = Math.max(score, BUSY_FLOOR * factor + BUSY_BONUS);
  } else if (baseline.busy_start != null && baseline.busy_end != null) {
    // Outside a known busy window, the venue is genuinely quiet.
    score = Math.min(score, 25);
  }

  for (const e of events) {
    if (e.day !== day || e.start_min == null) continue;
    if (min >= e.start_min - EVENT_LEAD_MIN && min < e.start_min + EVENT_TAIL_MIN) {
      score += EVENT_BUMP * (1 - Math.min(score, 100) / 100);
    }
  }

  return clamp(Math.round(score));
}
