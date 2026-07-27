# "Typical night" Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the never-rendering `PopularTimesChart` with a "Typical night" chart driven by the heat engine's archetype curves, so all 56 venues show an hourly busyness shape instead of 0.

**Architecture:** All arithmetic lives in one new pure module, `src/lib/heat/typicalNight.ts`, which calls the existing `baselineScore()` once per hour on the axis. A presentational component renders it. This split exists so that when observed `venue_hour_stats` history replaces the curve, only the pure module and its tests change.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind, vitest, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-27-typical-night-design.md`

## Global Constraints

- **Never render** a raw score, percentage, confidence value, source type, or hedging word ("we estimate", "approximately", "probably"). Uncertainty is expressed by saying less. Bars carry magnitude by height only — no numeric labels.
- **The tier is never named.** No "Researched venue" badge. The difference between tiers is only in what copy appears.
- Pure modules in `src/lib/heat/` take `now`/dates as **arguments**. No clock reads, no network, no React.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` — bare `npx tsc` is a silent no-op.
- Times are **minutes from midnight of the venue's night**: 1 AM is 1500, not 60.
- Hours on the axis are **absolute night hours**: 17–23 are that evening, 24–27 are 12 AM–3 AM of the next calendar day. Convert to clock with `% 24`.
- Do not modify `src/lib/heat/baseline.ts`, `curves.ts`, or `index.ts`. This feature is a **reader** of the heat engine.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/heat/typicalNight.ts` (create) | All arithmetic: axis, tabs, representative day, bars, peak band, copy lines |
| `src/lib/heat/typicalNight.test.ts` (create) | The 10 spec test cases |
| `src/lib/heat/copy.ts` (modify) | Export the existing `displayTime` so time formatting is shared, not duplicated |
| `src/components/TypicalNightChart.tsx` (create) | Presentational chart + tab state + "now" highlight |
| `src/components/PopularTimesChart.tsx` (delete) | Replaced |
| `src/components/VenueMoreInfo.tsx` (modify) | Drop the `popularTimes` render line |
| `src/components/VenuePreview.tsx` (modify) | Mount the chart above the More info expander |

---

### Task 1: `typicalNight.ts` — axis, tabs, and bars

**Files:**
- Create: `src/lib/heat/typicalNight.ts`
- Create: `src/lib/heat/typicalNight.test.ts`

**Interfaces:**
- Consumes: `baselineScore(baseline, events, now)` from `@/lib/heat/baseline`; `nightlifeDay(now)` from `@/lib/heat/curves`; types `VenueBaseline`, `WeeklyEvent` from `@/lib/heat/types`; `WeeklyPeriod` from `@/data/enrichment/types`.
- Produces: `type TypicalNightTab = "weeknight" | "thursday" | "weekend" | "sunday"`; `TAB_DAYS: Record<TypicalNightTab, number[]>`; `defaultTab(now: Date): TypicalNightTab`; `representativeDay(baseline, events, tab): number`; `axisHours(hours: WeeklyPeriod[] | undefined, day: number): number[]`; `typicalNight(baseline, events, hours, tab): TypicalNight` where `TypicalNight = { bars: { hour: number; value: number }[]; peakBand: { startHour: number; endHour: number } | null; busiestLine: string | null; crowdedLine: string | null; softLine: string | null }`. Task 2 fills the three `*Line` fields and `peakBand`; this task returns them as `null`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/typicalNight.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { defaultTab, representativeDay, axisHours, typicalNight } from "./typicalNight";
import { VenueBaseline, WeeklyEvent } from "./types";
import { WeeklyPeriod } from "@/data/enrichment/types";

const base = (o: Partial<VenueBaseline> = {}): VenueBaseline => ({
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
  ...o,
});

/** Niagara Bar's real researched record. */
const niagara = base({
  archetype: "dive",
  line_pattern: "door_pick",
  busy_start: 1290, busy_end: 1590,
  peak_start: 1410, peak_end: 1530,
  best_nights: [5, 6],
  confidence_base: "medium",
  source_type: "research_estimate",
});

const period = (day: number, closeHour: number, closeDayOffset: 0 | 1): WeeklyPeriod => ({
  day, openHour: 17, openMinute: 0, closeHour, closeMinute: 0, closeDayOffset,
});

describe("defaultTab", () => {
  it("returns weekend on a Saturday evening", () => {
    // Saturday 2026-07-25, 11 PM
    expect(defaultTab(new Date(2026, 6, 25, 23, 0))).toBe("weekend");
  });

  it("returns weekend at 1 AM Sunday — still Saturday night", () => {
    expect(defaultTab(new Date(2026, 6, 26, 1, 0))).toBe("weekend");
  });

  it("returns sunday on a Sunday evening", () => {
    expect(defaultTab(new Date(2026, 6, 26, 21, 0))).toBe("sunday");
  });

  it("returns thursday on a Thursday", () => {
    expect(defaultTab(new Date(2026, 6, 23, 21, 0))).toBe("thursday");
  });

  it("returns weeknight on a Tuesday", () => {
    expect(defaultTab(new Date(2026, 6, 21, 21, 0))).toBe("weeknight");
  });
});

describe("axisHours", () => {
  it("runs in night order starting at 5 PM, never 0 to 23", () => {
    const hours = axisHours([period(6, 4, 1)], 6);
    expect(hours[0]).toBe(17);
    // Strictly increasing in absolute-hour space.
    for (let i = 1; i < hours.length; i++) expect(hours[i]).toBeGreaterThan(hours[i - 1]);
  });

  it("ends before a 4 AM close", () => {
    expect(axisHours([period(6, 4, 1)], 6).at(-1)).toBe(27);
  });

  it("ends before a 2 AM close", () => {
    expect(axisHours([period(2, 2, 1)], 2).at(-1)).toBe(25);
  });

  it("floors a 10 PM close at the 11 PM end stop", () => {
    expect(axisHours([period(2, 22, 0)], 2).at(-1)).toBe(22);
  });

  it("caps a 6 AM close at 4 AM", () => {
    expect(axisHours([period(6, 6, 1)], 6).at(-1)).toBe(27);
  });

  it("falls back to a 2 AM end with no hours data", () => {
    expect(axisHours(undefined, 6).at(-1)).toBe(25);
  });
});

describe("representativeDay", () => {
  it("picks the day carrying an event over its dead neighbours", () => {
    const events: WeeklyEvent[] = [
      { venue: "X", day: 2, name: "Karaoke", start_min: 1320, source_url: "https://example.com" },
    ];
    expect(representativeDay(base(), events, "weeknight")).toBe(2);
  });

  it("picks a best_night over its neighbours", () => {
    expect(representativeDay(base({ best_nights: [3] }), [], "weeknight")).toBe(3);
  });

  it("resolves ties to the earliest day in the group", () => {
    expect(representativeDay(base(), [], "weeknight")).toBe(1);
    expect(representativeDay(base(), [], "weekend")).toBe(5);
  });

  it("returns the only day for single-day groups", () => {
    expect(representativeDay(base(), [], "thursday")).toBe(4);
    expect(representativeDay(base(), [], "sunday")).toBe(0);
  });
});

describe("typicalNight bars", () => {
  it("builds one bar per axis hour, in night order", () => {
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    expect(r.bars.map((b) => b.hour)).toEqual(axisHours([period(6, 4, 1)], 6));
  });

  it("scores the weekend above the weeknight for the same venue", () => {
    const hours = [period(6, 4, 1), period(2, 4, 1)];
    const weekend = typicalNight(niagara, [], hours, "weekend");
    const weeknight = typicalNight(niagara, [], hours, "weeknight");
    const peakOf = (bars: { value: number }[]) => Math.max(...bars.map((b) => b.value));
    expect(peakOf(weekend.bars)).toBeGreaterThan(peakOf(weeknight.bars));
  });

  it("agrees with baselineScore — bars are not drawn from the raw curve", async () => {
    const { baselineScore } = await import("./baseline");
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    const bar = r.bars.find((b) => b.hour === 23)!;
    // Saturday 2026-07-25 at 11 PM is the same moment the bar represents.
    expect(bar.value).toBe(baselineScore(niagara, [], new Date(2026, 6, 25, 23, 0)));
  });

  it("lifts the bars on the day an event lands", () => {
    const events: WeeklyEvent[] = [
      { venue: "X", day: 2, name: "Karaoke", start_min: 1320, source_url: "https://example.com" },
    ];
    const withEvent = typicalNight(base(), events, undefined, "weeknight");
    const without = typicalNight(base(), [], undefined, "weeknight");
    const at10 = (r: { bars: { hour: number; value: number }[] }) =>
      r.bars.find((b) => b.hour === 22)!.value;
    expect(at10(withEvent)).toBeGreaterThan(at10(without));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/heat/typicalNight.test.ts`
Expected: FAIL — `Failed to resolve import "./typicalNight"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/heat/typicalNight.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/heat/typicalNight.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/heat/typicalNight.ts src/lib/heat/typicalNight.test.ts
git commit -m "feat(heat): typical-night axis, day tabs and hourly bars"
```

---

### Task 2: Peak band and the two copy tiers

**Files:**
- Modify: `src/lib/heat/copy.ts` (export `displayTime`)
- Modify: `src/lib/heat/typicalNight.ts` (fill `peakBand`, `busiestLine`, `crowdedLine`, `softLine`)
- Modify: `src/lib/heat/typicalNight.test.ts` (append)

**Interfaces:**
- Consumes: everything Task 1 produced.
- Produces: the same `TypicalNight` shape, with the four previously-null fields populated. Task 3 renders exactly these strings and never composes its own.

**Tier rule:** a venue with `peak_start` **and** `peak_end` is the researched tier — it gets `busiestLine` (and `crowdedLine` when busy windows exist) and **no** `softLine`. Every other venue gets `softLine` only.

- [ ] **Step 1: Export `displayTime` from `copy.ts`**

In `src/lib/heat/copy.ts`, change line 37 from:

```ts
function displayTime(min: number): string {
```

to:

```ts
export function displayTime(min: number): string {
```

Leave the body and every existing caller untouched. This is shared so the chart's times format identically to the ACTIVITY block's.

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/heat/typicalNight.test.ts`:

```ts
describe("typicalNight copy tiers", () => {
  it("gives a researched venue exact-time lines and no soft line", () => {
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    expect(r.busiestLine).toBe("Busiest 11:30 PM – 1:30 AM");
    expect(r.crowdedLine).toBe("Crowded 9:30 PM – 2:30 AM");
    expect(r.softLine).toBeNull();
  });

  it("gives an archetype-only venue a soft line and no exact times", () => {
    const r = typicalNight(base(), [], [period(6, 4, 1)], "weekend");
    expect(r.busiestLine).toBeNull();
    expect(r.crowdedLine).toBeNull();
    expect(r.softLine).toMatch(/^Usually picks up around \d{1,2}(:\d{2})? (AM|PM)$/);
  });

  it("never hedges in the soft line", () => {
    const r = typicalNight(base({ archetype: "cocktail_room" }), [], undefined, "weeknight");
    expect(r.softLine).not.toMatch(/probably|approximately|estimate|about|roughly/i);
  });

  it("names the hour the shape actually rises, not the peak", () => {
    // Weekend dive: bars peak at 11 PM (80), so 70% = 56, first crossed at 9 PM.
    const r = typicalNight(base({ archetype: "dive" }), [], [period(6, 4, 1)], "weekend");
    expect(r.softLine).toBe("Usually picks up around 9 PM");
  });

  it("names a later hour for a venue that starts later", () => {
    // A dance club's shape is flat until late, so it must not claim 9 PM.
    const club = typicalNight(base({ archetype: "dance_club" }), [], [period(6, 4, 1)], "weekend");
    const dive = typicalNight(base({ archetype: "dive" }), [], [period(6, 4, 1)], "weekend");
    expect(club.softLine).not.toBe(dive.softLine);
  });

  it("marks a peak band covering the researched window", () => {
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    // 1410 min = 11:30 PM, 1530 min = 1:30 AM.
    expect(r.peakBand).toEqual({ startHour: 23, endHour: 26 });
  });

  it("has no peak band without a researched window", () => {
    expect(typicalNight(base(), [], undefined, "weekend").peakBand).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/heat/typicalNight.test.ts`
Expected: FAIL — `expected null to be "Busiest 11:30 PM – 1:30 AM"`.

- [ ] **Step 4: Implement**

In `src/lib/heat/typicalNight.ts`, add the import:

```ts
import { displayTime } from "@/lib/heat/copy";
```

Add these constants next to the other axis constants:

```ts
/** A bar this close to the day's maximum is where the night "picks up". */
const PICKS_UP_RATIO = 0.7;
```

Add above `typicalNight`:

```ts
/**
 * The hour a venue starts mattering: the first bar reaching 70% of the day's
 * own maximum. Derived from the rendered bars, so it can never disagree with
 * the chart it sits under.
 */
function softLineFor(bars: { hour: number; value: number }[]): string | null {
  const max = Math.max(0, ...bars.map((b) => b.value));
  if (max === 0) return null;
  const hit = bars.find((b) => b.value >= max * PICKS_UP_RATIO);
  if (!hit) return null;
  return `Usually picks up around ${displayTime(hit.hour * 60)}`;
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
```

Replace the `return` at the end of `typicalNight` with:

```ts
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
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/heat/typicalNight.test.ts`
Expected: PASS, 25 tests.

Note: the two soft-line assertions pin exact strings derived from the curve
arithmetic. If they fail on the hour, verify the arithmetic by hand before
changing the assertion — a shifted hour means `PICKS_UP_RATIO` or the axis is
wrong, not the test.

- [ ] **Step 6: Run the whole suite — `copy.ts` was touched**

Run: `npx vitest run`
Expected: PASS, 141 pre-existing + 25 new = 166 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit -p tsconfig.app.json
git add src/lib/heat/typicalNight.ts src/lib/heat/typicalNight.test.ts src/lib/heat/copy.ts
git commit -m "feat(heat): typical-night peak band and the two copy tiers"
```

---

### Task 3: `TypicalNightChart` component, mounted and old chart removed

**Files:**
- Create: `src/components/TypicalNightChart.tsx`
- Delete: `src/components/PopularTimesChart.tsx`
- Modify: `src/components/VenueMoreInfo.tsx` (drop the `popularTimes` line + import)
- Modify: `src/components/VenuePreview.tsx` (mount above the More info expander)

**Interfaces:**
- Consumes: `typicalNight`, `defaultTab`, `tabForDay`, `TAB_ORDER`, `TAB_LABEL`, `TypicalNightTab` from `@/lib/heat/typicalNight`; `getBaseline`, `getEvents` from `@/data/activity`; `getEnrichment` from `@/data/enrichment`; `useMinuteTick` from `@/hooks/useMinuteTick`; `nightlifeDay` from `@/lib/heat/curves`.
- Produces: `<TypicalNightChart venue={venue} />`, rendering `null` when the venue has no activity baseline.

- [ ] **Step 1: Create the component**

Create `src/components/TypicalNightChart.tsx`:

```tsx
/**
 * "Typical night" — the hourly shape a venue usually has.
 *
 * Presentational only: every number and string comes from typicalNight().
 * Replaces PopularTimesChart, which read enrichment.popularTimes and therefore
 * rendered for 0 of 56 venues (the serpapi source was never run).
 *
 * The chart is a MODEL, never observed measurement, which is why it is titled
 * "Typical night" and why no bar carries a number.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { getBaseline, getEvents } from "@/data/activity";
import { getEnrichment } from "@/data/enrichment";
import { nightlifeDay } from "@/lib/heat/curves";
import {
  TAB_LABEL,
  TAB_ORDER,
  TypicalNightTab,
  defaultTab,
  tabForDay,
  typicalNight,
} from "@/lib/heat/typicalNight";
import { useMinuteTick } from "@/hooks/useMinuteTick";
import { cn } from "@/lib/utils";

/** Absolute night hour: 1 AM reads as 25, matching the axis. */
function nowHour(now: Date): number {
  const h = now.getHours();
  return h < 5 ? h + 24 : h;
}

/** 17 -> "5p", 24 -> "12a". Only every third hour is labelled. */
function hourLabel(hour: number): string {
  const clock = hour % 24;
  const suffix = clock < 12 ? "a" : "p";
  const display = clock % 12 === 0 ? 12 : clock % 12;
  return `${display}${suffix}`;
}

export default function TypicalNightChart({ venue }: { venue: Venue }) {
  // A re-render trigger, NOT a timestamp — useMinuteTick returns a counter, so
  // `new Date(tick)` would read 1970. It exists here so the "now" bar and the
  // default tab cross hour and night boundaries without a reload.
  useMinuteTick();
  const baseline = getBaseline(venue.title);
  const [tab, setTab] = useState<TypicalNightTab | null>(null);

  if (!baseline) return null;

  const now = new Date();
  const activeTab = tab ?? defaultTab(now);
  const data = typicalNight(baseline, getEvents(venue.title), getEnrichment(venue.title)?.hours, activeTab);
  if (data.bars.length === 0) return null;

  // "Now" only means something on the tab covering tonight.
  const isTonight = activeTab === tabForDay(nightlifeDay(now));
  const currentHour = isTonight ? nowHour(now) : null;
  const max = Math.max(1, ...data.bars.map((b) => b.value));

  return (
    <section className="mt-3 rounded-2xl bg-secondary/60 p-3" aria-label="Typical night">
      <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
        Typical night
      </h3>

      <div role="tablist" aria-label="Night of week" className="flex gap-1 mb-3">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 text-[10px] font-semibold py-1.5 rounded-lg uppercase tracking-wide transition-colors",
              activeTab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/10",
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div
        className="flex items-end gap-0.5 h-20"
        role="img"
        aria-label={`Typical ${TAB_LABEL[activeTab].toLowerCase()} busyness by hour.`}
      >
        {data.bars.map((b) => {
          const inPeak =
            data.peakBand != null &&
            b.hour >= data.peakBand.startHour &&
            b.hour < data.peakBand.endHour;
          return (
            <div key={b.hour} className="flex-1 flex items-end h-full min-w-[6px]">
              <span
                className={cn(
                  "w-full rounded-t transition-colors",
                  b.hour === currentHour
                    ? "bg-primary"
                    : inPeak
                      ? "bg-primary/40"
                      : "bg-muted-foreground/30",
                )}
                style={{ height: `${Math.max((b.value / max) * 100, 4)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-0.5 mt-1">
        {data.bars.map((b) => (
          <span key={b.hour} className="flex-1 text-center text-[9px] text-muted-foreground/70">
            {b.hour % 3 === 0 ? hourLabel(b.hour) : ""}
          </span>
        ))}
      </div>

      {(data.busiestLine || data.softLine) && (
        <p className="mt-2 text-xs font-semibold">{data.busiestLine ?? data.softLine}</p>
      )}
      {data.crowdedLine && (
        <p className="text-xs text-muted-foreground">{data.crowdedLine}</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Remove the old chart from `VenueMoreInfo.tsx`**

Delete the import line:

```tsx
import PopularTimesChart from "@/components/PopularTimesChart";
```

and delete this block entirely:

```tsx
      {/* Carried over unchanged — renders for 0/56 venues today (the serpapi
          popular-times source was never run). Kept, not deleted, pending
          Colton's direction. */}
      {e?.popularTimes && <PopularTimesChart data={e.popularTimes} />}
```

`e` is still used by nothing else in that file after this — check with `grep -n "\be\b" src/components/VenueMoreInfo.tsx`. If `const e = getEnrichment(venue.title);` is now unused, delete that line and drop `getEnrichment` from the `@/data/enrichment` import, keeping `getSpecials`.

- [ ] **Step 3: Delete the old component**

```bash
git rm src/components/PopularTimesChart.tsx
```

- [ ] **Step 4: Mount the chart in `VenuePreview.tsx`**

Add the import beside the other component imports:

```tsx
import TypicalNightChart from "@/components/TypicalNightChart";
```

Then find the More info block, which begins with this comment:

```tsx
      {/* The deeper layer, in place — this replaced a "View Details" button
```

Insert immediately **above** that comment:

```tsx
      {/* Typical night sits above More info and outside it: the shape of the
          night is a glance question, not reference data. */}
      <TypicalNightChart venue={venue} />
```

- [ ] **Step 5: Verify nothing still references the deleted component**

Run: `grep -rn "PopularTimesChart" src/`
Expected: no matches.

- [ ] **Step 6: Typecheck, lint, and run the suite**

```bash
npx tsc --noEmit -p tsconfig.app.json
npx vitest run
npx eslint src/components/TypicalNightChart.tsx src/components/VenuePreview.tsx src/components/VenueMoreInfo.tsx
```

Expected: tsc silent, 166 tests pass, eslint clean on these three files.

- [ ] **Step 7: Commit**

```bash
git add -A src/components src/lib
git commit -m "feat(venue): replace Popular times with the Typical night chart"
```

---

### Task 4: Browser verification

The heat-system build found four real defects in the browser that a green test suite had missed — the title/id key mismatch, baselines pinned at 100, miscalibrated confidence, and a threshold no venue could cross. This task exists because of that.

**Files:** none — this is verification.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: serving on `localhost:8080`.

- [ ] **Step 2: Check a researched venue at mobile width**

Open `localhost:8080` at 390×844, tap the **Niagara Bar** pin.

Confirm, in order:
1. "Typical night" renders **above** the More info row and is visible without expanding it.
2. Four tabs read WEEKNIGHT · THURSDAY · WEEKEND · SUNDAY.
3. The axis starts at `5p` and its last label is before the venue's close.
4. The bars rise toward the right — the peak is **not** split across both edges.
5. Below the bars: `Busiest 11:30 PM – 1:30 AM` and `Crowded 9:30 PM – 2:30 AM`.
6. **No** "Researched venue" tag, no numbers on bars, no percentages anywhere.

- [ ] **Step 3: Check an archetype-only venue**

Open any venue **not** in this list (the 15 researched ones): Niagara Bar, Doc Holliday's, The Library, Wiggle Room, Death & Co, and the other `research_estimate` records in `src/data/activity/baseline.json`.

Confirm:
1. A "Usually picks up around …" line, and **no** `Busiest`/`Crowded` lines.
2. The WEEKNIGHT tab is visibly lower than WEEKEND, not empty or broken — this is the state 41 of 56 venues are in and the main thing being judged.
3. No shaded peak band.

- [ ] **Step 4: Check the description appears exactly once**

On any venue: the blurb shows in the ACTIVITY block, and expanding **More info** shows hours/phone/website with **no** ABOUT section repeating it.

- [ ] **Step 5: Check the "now" bar sits on the current hour**

On tonight's tab, exactly one bar renders in the solid primary accent, and it is the bar whose axis position matches the current hour. Switch to any other tab: **no** bar is accented, because there is no "now" on a night that isn't tonight.

The 1 AM night-rollover case (Sunday 1 AM must open WEEKEND, not SUNDAY) is covered by `defaultTab`'s unit tests in Task 1 and is **not** re-verified here — it needs clock manipulation, and the unit test asserts it directly against a fixed date.

- [ ] **Step 6: Check desktop and the standalone page**

At 1440×900, open a venue in the right-side panel, then navigate to `/venue/:id` directly. The chart renders in both, above More info.

- [ ] **Step 7: Confirm a clean console**

Expected: no errors, no React key warnings.

- [ ] **Step 8: Record the result**

Append a dated entry to `docs/ENDZ_MASTER_TASKS.md` covering: what shipped, that the medium-confidence gate from the heat spec was replaced by tiered copy, and that `scripts/venue-hour-stats.sql` remains unpasted and is the gate on ever replacing these curves with observed data.

```bash
git add docs/ENDZ_MASTER_TASKS.md
git commit -m "docs(tracker): log the Typical night chart"
```

---

## Self-Review

**Spec coverage:** All 56 venues → Task 1 (no gate anywhere). Tiered copy → Task 2. Tier never named → Task 3 renders no badge, Task 4 Step 2.6 checks. Placement above More info → Task 3 Step 4. Four tabs → Task 1. Night order → Task 1 `axisHours`. 5 PM start / close end / caps → Task 1. Bars from `baselineScore` → Task 1, asserted directly. Live signals excluded → `typicalNight` never takes `LiveSignals`. Representative day → Task 1. Default tab on rollover → Task 1. "Now" highlight only on tonight's tab → Task 3. Deletions → Task 3. All 10 spec test cases → Tasks 1–2.

**Known gap, deliberate:** the spec's `TypicalNight` type omitted `day`; the plan adds it because `representativeDay` is otherwise unobservable to tests. It is not rendered.

**Type consistency:** `TypicalNightTab`, `TAB_DAYS`, `TAB_ORDER`, `TAB_LABEL`, `defaultTab`, `tabForDay`, `representativeDay`, `axisHours`, `dateFor`, `typicalNight` are used in Tasks 2–3 exactly as defined in Task 1. `displayTime` is exported in Task 2 Step 1 before Task 2 Step 4 uses it.
