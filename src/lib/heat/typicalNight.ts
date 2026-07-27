/**
 * "Typical night": the hourly shape a venue usually has, per day group.
 *
 * Bars come from baselineScore() run hour by hour — NOT from the raw archetype
 * curve. Researched peak/busy floors, best_nights lift and event bumps all live
 * in baselineScore, and a chart drawn from the bare curve would contradict the
 * ACTIVITY block on the same screen.
 *
 * Live signals are deliberately excluded: this is what the venue typically
 * does, not what it is doing right now. That is ActivitySection's job.
 *
 * Pure — every date is constructed here from a fixed reference week, so the
 * output is identical whenever it runs.
 *
 * See docs/superpowers/specs/2026-07-27-typical-night-design.md
 */
import { WeeklyPeriod } from "@/data/enrichment/types";
import { baselineScore } from "@/lib/heat/baseline";
import { nightlifeDay } from "@/lib/heat/curves";
import { VenueBaseline, WeeklyEvent } from "@/lib/heat/types";

export type TypicalNightTab = "weeknight" | "thursday" | "weekend" | "sunday";

/** 0 = Sunday … 6 = Saturday. Exactly the four shapes DAY_SHAPE_FACTOR knows. */
export const TAB_DAYS: Record<TypicalNightTab, number[]> = {
  weeknight: [1, 2, 3],
  thursday: [4],
  weekend: [5, 6],
  sunday: [0],
};

export const TAB_ORDER: TypicalNightTab[] = ["weeknight", "thursday", "weekend", "sunday"];

export const TAB_LABEL: Record<TypicalNightTab, string> = {
  weeknight: "Weeknight",
  thursday: "Thursday",
  weekend: "Weekend",
  sunday: "Sunday",
};

/** The axis always opens at 5 PM — earlier is not a nightlife question. */
const AXIS_START_HOUR = 17;
/** Absolute night hours: 24 = midnight, 28 = 4 AM. */
const MIN_END_HOUR = 23; // an 11 PM close still gets a readable chart
const MAX_END_HOUR = 28; // nothing past 4 AM
const DEFAULT_END_HOUR = 26; // 2 AM, used when hours data is absent

/**
 * 2026-07-26 is a Sunday, so REF + day lands on that weekday. Any fixed week
 * works; this one matches the dates already used across the heat tests.
 */
const REF_YEAR = 2026;
const REF_MONTH = 6; // July, zero-indexed
const REF_SUNDAY_DATE = 26;

/**
 * A real Date standing for `hour` on the night of `day`. Absolute hours past 24
 * belong to the NEXT calendar day — 1 AM Sunday is Saturday night, which is
 * exactly what nightlifeDay() decodes back.
 */
export function dateFor(day: number, hour: number): Date {
  const dayOffset = hour >= 24 ? 1 : 0;
  return new Date(
    REF_YEAR,
    REF_MONTH,
    REF_SUNDAY_DATE + day + dayOffset,
    hour % 24,
    0,
  );
}

export function tabForDay(day: number): TypicalNightTab {
  if (day === 0) return "sunday";
  if (day === 4) return "thursday";
  if (day === 5 || day === 6) return "weekend";
  return "weeknight";
}

/** The tab to open on. Uses the nightlife day, so 1 AM Sunday opens WEEKEND. */
export function defaultTab(now: Date): TypicalNightTab {
  return tabForDay(nightlifeDay(now));
}

/** Absolute close hour for a day, e.g. 4 AM the next morning = 28. */
function closeHourFor(hours: WeeklyPeriod[] | undefined, day: number): number {
  const period = hours?.find((p) => p.day === day);
  if (!period) return DEFAULT_END_HOUR;
  const abs = period.closeHour + (period.closeDayOffset === 1 ? 24 : 0);
  return Math.min(MAX_END_HOUR, Math.max(MIN_END_HOUR, abs));
}

/**
 * Axis hours, 5 PM through the last full hour before close. Absolute and
 * strictly increasing: 17…23, 24, 25 — never wrapped to 0, which would split
 * the peak across both edges of the chart.
 */
export function axisHours(hours: WeeklyPeriod[] | undefined, day: number): number[] {
  const end = closeHourFor(hours, day);
  const out: number[] = [];
  for (let h = AXIS_START_HOUR; h < end; h++) out.push(h);
  return out;
}

/** Probe range for comparing days — fixed, so close times can't skew the pick. */
const PROBE_HOURS = Array.from({ length: 11 }, (_, i) => AXIS_START_HOUR + i); // 17–27

/**
 * Which single day a tab renders. A tab spans up to three days, and
 * best_nights and events are per-day, so a Tuesday-residency venue must show
 * its Tuesday rather than a dead Monday. Ties go to the earliest day, which
 * keeps the choice deterministic.
 */
export function representativeDay(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  tab: TypicalNightTab,
): number {
  const days = TAB_DAYS[tab];
  let best = days[0];
  let bestTotal = -1;
  for (const day of days) {
    const total = PROBE_HOURS.reduce(
      (sum, h) => sum + baselineScore(baseline, events, dateFor(day, h)),
      0,
    );
    if (total > bestTotal) {
      bestTotal = total;
      best = day;
    }
  }
  return best;
}

export type TypicalNight = {
  /** Absolute night hours with their 0–100 baseline score. */
  bars: { hour: number; value: number }[];
  /** Absolute hours; end is exclusive. Null outside the researched tier. */
  peakBand: { startHour: number; endHour: number } | null;
  busiestLine: string | null;
  crowdedLine: string | null;
  softLine: string | null;
  /** The day the bars were computed for — the component labels nothing with it. */
  day: number;
};

export function typicalNight(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  hours: WeeklyPeriod[] | undefined,
  tab: TypicalNightTab,
): TypicalNight {
  const day = representativeDay(baseline, events, tab);
  const bars = axisHours(hours, day).map((hour) => ({
    hour,
    value: baselineScore(baseline, events, dateFor(day, hour)),
  }));

  return { bars, peakBand: null, busiestLine: null, crowdedLine: null, softLine: null, day };
}
