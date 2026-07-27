# "Typical night" — design

**Date:** 2026-07-27
**Status:** approved (gate passed section by section with Colton)
**Supersedes:** the `PopularTimesChart` paragraph in
`2026-07-27-activity-heat-system-design.md` (§ PopularTimesChart), which
proposed a medium-confidence render gate. That gate is replaced — see
[Who gets the chart](#who-gets-the-chart).

## Problem

`PopularTimesChart` has shipped since 2026-07-06 and has never rendered. It
reads `enrichment.popularTimes`, which is populated for **0 of 56 venues** — the
serpapi source it was built for was never run and is deliberately paused (paid).
Meanwhile the heat engine already computes exactly the hourly shape the chart
wants, for every venue.

This replaces the chart's data source with the heat engine and retitles it
**"Typical night"**, because the data is a model, not observed measurement.

## Who gets the chart

**All 56 venues.** The heat spec proposed rendering only at medium-or-better
confidence; that rule is dropped. The confidence math makes it sharper than it
sounds — 41 venues are `archetype_default` / `low` and score 20, so a medium
gate takes the feature from 0/56 to 15/56 and leaves 41 venues with a blank
space behind "More info".

The circularity concern behind that gate is real but applies to **precision, not
existence**. "This kind of bar fills up after 10 and peaks near midnight" is
useful even as a model, and every venue has a real archetype assigned. So
confidence gates *what the chart may claim*, not whether it appears:

| Tier | Venues | Chart shows |
|---|---|---|
| Researched (`research_estimate`, has windows) | 15 | Shape + marked peak band + exact-time lines |
| Archetype-only (`archetype_default`) | 41 | Shape + one soft line derived from the curve |

The tier is never **named**. No "Researched venue" badge, no source type, no
confidence value — the same rule that removed `⚡ {buzz_score}`. The difference
is visible in what is said, not announced.

## Placement

Directly above the **More info** expander inside `VenuePreview`, below the
Directions / Make a plan row. Everything else on the card is unchanged.

It renders in all three containers that mount `VenuePreview` (mobile drawer,
desktop panel, `/venue/:id`) — but **outside** `VenueMoreInfo`, so it is visible
without expanding. The card's glance-first premise is unaffected: the drawer
still opens collapsed, and the chart sits below the fold within it.

## Data

### Bars come from `baselineScore()`, not the raw curve

The chart calls the existing `baselineScore(baseline, events, syntheticDate)`
once per hour on the axis, rather than reading `curveValue()` directly. This is
the load-bearing decision: researched peak/busy floors, `best_nights` lift and
event bumps all live in `baselineScore`, and a chart drawn from the bare curve
would contradict the ACTIVITY block **on the same screen** — a flat Tuesday
under a status line reading "Macho Monday tonight".

Live signals are deliberately **not** blended in. The chart is what the venue
typically does; "right now" is the ACTIVITY block's job. Blending would also
make a bar move under the user as check-ins arrive.

### Day selector: four tabs

**WEEKNIGHT · THURSDAY · WEEKEND · SUNDAY** — exactly the four shapes
`DAY_SHAPE_FACTOR` knows (×0.5 / ×0.8 / ×1.0 / ×0.6).

Seven tabs were considered and rejected: for the 41 archetype-only venues
Mon/Tue/Wed are an identical shape and so are Fri/Sat, so three of seven tabs
would be duplicates presented as distinct choices. Four tabs state exactly what
the model knows.

Consequence to accept: `best_nights` and events are per-**day**, and a tab spans
up to three days. Resolution — each tab renders a **representative day**, chosen
as the day in the group whose summed `baselineScore` across the axis is highest.
(The archetype curve itself is day-independent, so this tiebreak is decided
entirely by `best_nights` lift and event bumps — which is the point: a
Tuesday-residency venue shows its Tuesday under WEEKNIGHT rather than a dead
Monday.) Ties resolve to the earliest day in the group, so the choice is
deterministic. Group membership: weeknight = [1,2,3], thursday = [4],
weekend = [5,6], sunday = [0].

Default tab on open = the group containing `nightlifeDay(now)`, **not**
`now.getDay()` — at 1 AM Sunday you are still in Saturday night and must open on
WEEKEND.

### Axis

Starts at **5 PM**. Ends at the venue's **close time** for the representative
day, read from `enrichment.hours` (`closeHour` + `closeDayOffset`), capped at
4 AM and floored at 11 PM so no venue gets a degenerate 3-bar chart. Hours
absent → 5 PM–2 AM.

Hours are laid out in **night order** (17, 18, … 23, 0, 1, …), never clock
order 0→23, which would split the peak across both edges of the chart.

Cost accepted: pub and rooftop afternoons (the curves carry real values from
noon) are cut off. Correct for a nightlife app.

## Copy

### Researched tier

Two lines under the bars, from `peak_start/peak_end` and `busy_start/busy_end`:

```
Busiest 11:30 PM – 1:30 AM
Crowded 9:30 PM – 2:30 AM
```

Rendered only when the window exists. Reuses `copy.ts`'s `displayTime()` so
time formatting stays identical to the ACTIVITY block.

### Archetype-only tier

One line, derived from the rendered bars — the first hour reaching 70% of that
day's maximum:

```
Usually picks up around 10 PM
```

Honest (that is precisely what the model says), fills the space, and claims no
specific window. Never rendered when the day's maximum is 0.

### Never rendered

Numbers on bars, percentages, raw scores, confidence values, source types, or
hedging words. Unchanged from the heat spec.

## Component shape

Two units, split so the arithmetic is testable without a DOM:

**`src/lib/heat/typicalNight.ts`** (new, pure)

```ts
export type TypicalNightTab = "weeknight" | "thursday" | "weekend" | "sunday";

export type TypicalNight = {
  bars: { hour: number; value: number }[];  // night-ordered, 5 PM → close
  peakBand: { startHour: number; endHour: number } | null;
  busiestLine: string | null;   // researched tier
  crowdedLine: string | null;   // researched tier
  softLine: string | null;      // archetype tier
};

export function typicalNight(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  hours: WeeklyPeriod[] | undefined,
  tab: TypicalNightTab,
): TypicalNight;

export function defaultTab(now: Date): TypicalNightTab;
```

No clock reads, no React — `now` is an argument, same contract as the rest of
`src/lib/heat/`.

**`src/components/TypicalNightChart.tsx`** (rewrite of `PopularTimesChart.tsx`)

Presentational only. Owns tab state and the "now" highlight; every string comes
from `typicalNight()`.

### "Now" highlight

The current hour's bar renders in the primary accent, but **only when the
selected tab is the group containing `nightlifeDay(now)`** and the venue is
open. On any other tab there is no "now" to point at.

## Deletions

- `PopularTimesChart.tsx` — replaced. Its 7-tab day row, `busynessLabel`
  thresholds and `PopularTimesDay` dependency all go.
- The `{e?.popularTimes && <PopularTimesChart …/>}` line in
  `VenueMoreInfo.tsx`.
- `PopularTimesDay` / `popularTimes` / `popularTimesSource` stay in
  `enrichment/types.ts`: the enrichment pipeline still writes the fields and
  removing them is unrelated cleanup.

## Testing

`typicalNight.test.ts`, following the existing golden-case style:

1. Night ordering — bars run 17→close, never 0→23.
2. Axis end respects close time; 11 PM floor and 4 AM cap both bind.
3. Weekend bars exceed weeknight bars for the same venue (day factor applied).
4. A researched venue's peak band lines up with `peak_start/peak_end`.
5. Event bump appears on the representative day that carries the event.
6. Representative-day choice picks the busiest day in a group.
7. Archetype tier produces a soft line and **no** exact-time lines.
8. Researched tier produces exact-time lines and **no** soft line.
9. `defaultTab` returns WEEKEND at 1 AM Sunday (night rollover).
10. Chart and ACTIVITY agree: bars derive from the same `baselineScore` the
    heat engine uses.

## Trajectory: the curve is scaffolding

The archetype curve is a **cold-start device, not the destination.** The
intended end state is a per-venue observed shape learned from check-ins and vibe
reports, so that every spot's busy times come from what actually happened there
rather than from what its category usually does.

The migration path, in order:

1. **Bank the history.** `venue_hour_stats` accumulates per-venue, per-hour
   samples. It is write-only today and **cannot be backfilled** — every night it
   is not running is data permanently lost. `scripts/venue-hour-stats.sql` is
   **still unpasted** (needs pg_cron). This is the gating prerequisite for
   everything below and the reason it should go in before the read side is
   designed.
2. **Blend, per venue, per hour.** The same shape the heat engine already uses
   for live signals — `weight = min(cap, samples / (samples + k))` — applied to
   the hourly bars. A venue with three months of Saturdays draws its own
   Saturday; a venue with none keeps the curve. No global switch, no flag day,
   and venues cross over individually as their evidence accrues.
3. **Retire the archetype per venue** once its observed shape is dense enough,
   keeping the curve only as the fallback for new venues and thin hours.

The read gate must count `crowd_samples`, **not** `sample_count`: with no users
every sample is legitimately zero, and "nobody was here" is indistinguishable
from "nobody was running the app" if you count rows instead of people.

`typicalNight.ts` is deliberately the only unit that decides what a bar's value
is, so step 2 changes one pure function and its tests. The component, the tabs,
the axis and the copy tiers do not move.

## Out of scope

- The `venue_hour_stats` read side itself — designed and built when there is
  history to read, per the trajectory above.
- Reviving serpapi. Still paused, still paid.
- Specials (`specials.json` is `{}` for all 56) — separate open call.
