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
import { curveValue, nightlifeDay } from "@/lib/heat/curves";
import { displayTime } from "@/lib/heat/copy";
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
 * The days in a tab's group the venue is actually open.
 *
 * Undefined `hours` means "unknown", NOT "closed" — the same reading
 * computeOpenState() uses — so an unknown-hours venue keeps every day.
 */
export function openDaysIn(
  hours: WeeklyPeriod[] | undefined,
  tab: TypicalNightTab,
): number[] {
  const days = TAB_DAYS[tab];
  if (!hours) return days;
  return days.filter((day) => hours.some((p) => p.day === day));
}

/**
 * Which single day a tab renders. A tab spans up to three days, and
 * best_nights and events are per-day, so a Tuesday-residency venue must show
 * its Tuesday rather than a dead Monday. Ties go to the earliest day, which
 * keeps the choice deterministic.
 *
 * Only days the venue is OPEN are candidates. Without that filter the
 * earliest-day tie-break lands on Monday, which is precisely the night the
 * venues most likely to be dark are dark — and the chart would draw them a
 * full night anyway.
 */
export function representativeDay(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  tab: TypicalNightTab,
  hours?: WeeklyPeriod[] | undefined,
): number {
  const open = openDaysIn(hours, tab);
  const days = open.length > 0 ? open : TAB_DAYS[tab];
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

/**
 * The archetype tier's one line: when the night peaks.
 *
 * Deliberately mirrors the researched tier's "Busiest 11:30 PM – 1:30 AM" so
 * the two tiers read as one system. It replaced a "picks up around" line keyed
 * to the first bar reaching 70% of the day's max, which put 29 of 46 venues at
 * 6 PM — technically true of the curve, useless to someone deciding when to go.
 *
 * Derived from the rendered bars, so it can never disagree with the chart it
 * sits under. Ties go to the earliest hour, which keeps it deterministic.
 */
function softLineFor(bars: { hour: number; value: number }[]): string | null {
  if (bars.length === 0) return null;
  let peak = bars[0];
  for (const b of bars) if (b.value > peak.value) peak = b;
  if (peak.value === 0) return null;
  return `Usually busiest around ${displayTime(peak.hour * 60)}`;
}

/**
 * Matches the `Math.min(score, 25)` clamp in `baseline.ts` for any hour
 * outside a researched busy window. Kept in sync deliberately, not imported:
 * `baseline.ts` clamps the *live* "right now" score and must not change, but
 * that flat 25-point ceiling reads as a data artifact once five bars in a
 * row hit it. This constant is that same ceiling, redistributed below.
 */
const OUTSIDE_CEILING = 25;

/**
 * A bar's hour is "outside" the researched busy window when the moment
 * typicalNight() built its Date for (hour, minute 0) falls outside
 * [busy_start, busy_end) — the same point `baselineScore` tested via
 * `inWindow`.
 */
function isOutsideBusyWindow(hour: number, busyStart: number, busyEnd: number): boolean {
  const min = hour * 60;
  return !(min >= busyStart && min < busyEnd);
}

/**
 * Chart-only reshaping. `baselineScore` flattens every hour outside a
 * researched busy window to the same 25-point ceiling (see OUTSIDE_CEILING
 * above), which makes early-evening bars on researched venues read as
 * identical placeholders rather than a rising night. This redistributes that
 * ceiling across the archetype curve's own shape among the outside-window
 * bars, so the bars still rise toward the window instead of plateauing.
 *
 * `Math.min(originalValue, scaled)` is load-bearing: reshaping may only
 * lower a bar, never raise it above what baselineScore actually returned —
 * the chart must never invent busyness beyond the live score.
 */
function reshapeOutsideBusyWindow(
  baseline: VenueBaseline,
  bars: { hour: number; value: number }[],
): { hour: number; value: number }[] {
  const { busy_start, busy_end } = baseline;
  if (busy_start == null || busy_end == null) return bars;

  const outside = (hour: number) => isOutsideBusyWindow(hour, busy_start, busy_end);
  const maxCurveAmongOutsideBars = Math.max(
    0,
    ...bars.filter((b) => outside(b.hour)).map((b) => curveValue(baseline.archetype, b.hour)),
  );
  if (maxCurveAmongOutsideBars === 0) return bars;

  return bars.map((b) => {
    if (!outside(b.hour)) return b;
    // A bar already above the ceiling was lifted by an EVENT_BUMP: `baseline.ts`
    // pins every clamped outside-window bar at exactly the ceiling, and only the
    // event lift is applied afterwards. Reshaping it would delete the event —
    // and representativeDay may have chosen this very day because of it.
    if (b.value > OUTSIDE_CEILING) return b;
    const scaled = Math.round(
      (OUTSIDE_CEILING * curveValue(baseline.archetype, b.hour)) / maxCurveAmongOutsideBars,
    );
    return { hour: b.hour, value: Math.min(b.value, scaled) };
  });
}

/** Absolute-hour band covering every bar that overlaps the researched window. */
function peakBandFor(baseline: VenueBaseline): { startHour: number; endHour: number } | null {
  const { peak_start, peak_end } = baseline;
  if (peak_start == null || peak_end == null) return null;
  return {
    startHour: Math.floor(peak_start / 60),
    endHour: Math.ceil(peak_end / 60),
  };
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
  /**
   * The venue has known hours and is open on NO day of this tab's group. The
   * chart must say so rather than draw a night that does not happen.
   */
  closed: boolean;
};

/**
 * The venue's busiest hour across every night of the week. Bars are scaled
 * against this rather than the selected night's own maximum, so a quiet
 * Tuesday renders visibly lower than a packed Saturday instead of both
 * filling the chart.
 */
export function venuePeak(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  hours: WeeklyPeriod[] | undefined,
): number {
  let peak = 0;
  for (const tab of TAB_ORDER) {
    for (const bar of typicalNight(baseline, events, hours, tab).bars) {
      if (bar.value > peak) peak = bar.value;
    }
  }
  return peak;
}

export function typicalNight(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  hours: WeeklyPeriod[] | undefined,
  tab: TypicalNightTab,
): TypicalNight {
  const day = representativeDay(baseline, events, tab, hours);

  // Known hours with no period anywhere in this group: the venue does not open
  // on this kind of night at all. Drawing the archetype curve here would invent
  // a night — Wiggle Room is open Fri/Sat only, and three of its four tabs
  // would otherwise show a full evening under a researched peak caption.
  if (hours && openDaysIn(hours, tab).length === 0) {
    return {
      bars: [],
      peakBand: null,
      busiestLine: null,
      crowdedLine: null,
      softLine: null,
      day,
      closed: true,
    };
  }

  const rawBars = axisHours(hours, day).map((hour) => ({
    hour,
    value: baselineScore(baseline, events, dateFor(day, hour)),
  }));
  const bars = reshapeOutsideBusyWindow(baseline, rawBars);

  // Researched and archetype tiers are mutually exclusive: a venue with a
  // researched peak states its times, everything else states the shape. The
  // tier itself is NEVER named in the UI — only its copy differs.
  const researched = baseline.peak_start != null && baseline.peak_end != null;

  const busiestLine = researched
    ? `Busiest ${displayTime(baseline.peak_start!)} – ${displayTime(baseline.peak_end!)}`
    : null;

  const crowdedLine =
    researched && baseline.busy_start != null && baseline.busy_end != null
      ? `Crowded ${displayTime(baseline.busy_start)} – ${displayTime(baseline.busy_end)}`
      : null;

  return {
    bars,
    peakBand: peakBandFor(baseline),
    busiestLine,
    crowdedLine,
    softLine: researched ? null : softLineFor(bars),
    day,
    closed: false,
  };
}
