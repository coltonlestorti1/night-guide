# ENDZ — Happy Hour Highlighting + Category Pin Icons

**Date:** 2026-07-07 (~1:30 AM)
**Status:** Approved (user: both map + rail; icon set 🍺/🍸/🪩 with cocktail override; HH mark = amber glow ring + 🥂)
**Scope:** Surface the 14-of-43 venues with real Google happy-hour times across map pins, a filter chip, a Discover rail, and existing info surfaces — plus recut the category pin glyphs. Client-only, $0, no schema changes, no fabricated data (venues without HH data simply don't participate).

## Context

Happy-hour periods (`enrichment.happyHour: WeeklyPeriod[]`) shipped tonight with the Google enrichment; `isWithinPeriods`/`computeOpenState`/`formatTime` exist in `src/data/enrichment/index.ts`. Pins are DOM markers in `Map.tsx` with `CATEGORY_GLYPH` textContent (currently bar 🍸 / club 🎧 / lounge 🛋️), activity badges top-right, selection pulse, and the documented geo-anchoring rule (never inline `position` on the wrapper).

## 1. Shared logic — `getHappyHourState` (in `src/data/enrichment/index.ts`)

```ts
export type HappyHourState =
  | { status: "active"; endsAt: string }        // "7 PM"
  | { status: "upcoming-today"; startsAt: string } // "4 PM"
  | { status: "none" };
export function getHappyHourState(happyHour: WeeklyPeriod[] | undefined, now?: Date): HappyHourState;
```

Minutes-of-week math consistent with `computeOpenState`. "Upcoming-today" = a period starting later the same calendar day. All consumers below use only this function. Surfaces that must flip at boundaries re-render on a shared 60s tick (small `useMinuteTick()` hook in `src/hooks/useMinuteTick.ts`).

## 2. Category pin glyphs (Map.tsx + legend)

- `CATEGORY_GLYPH` becomes: **bar → 🍺, club → 🪩, lounge → 🍸**.
- **Cocktail override:** a bar whose normalized title/description matches cocktail|speakeasy (reuse the exact keyword logic from `vibeScore`, extracted to `src/lib/venueTraits.ts` as `isCocktailSpot(venue)` so both consumers share it) or whose `avg_price_level >= 3` renders 🍸 instead of 🍺. Death & Co, PDT, Accidental Bar stop wearing beer mugs.
- Map legend and any category chips referencing glyphs update to match.
- Brand note (user): martini = logo; it marks the cocktail end of the map, not generic bars.

## 3. Happy-hour pin treatment (Map.tsx)

- Active HH → **amber glow ring**: `box-shadow: 0 0 0 2.5px #f59e0b, 0 0 14px #f59e0baa` layered with existing shadows (selection glow wins when selected; activity glow and HH ring may coexist — HH is the ring, activity stays the colored blur).
- No extra emoji on the pin (count badge keeps top-right slot; visual noise cap).
- MapPage computes `hhActiveIds: Set<string>` (memoized on venues + minute tick) → new Map prop `happyHour?: Set<string>`; marker rebuild deps include a stable key (sorted joined ids) — markers must not rebuild every render (the memoization lesson from the check-in loop).

## 4. 🥂 Happy hour filter chip (MapPage)

- New chip in `PRIMARY_FILTERS`: `🥂 Happy hour`. Toggle = local MapPage state (not the filter store; it's time-dependent, not a query facet). Active → venues filtered to `hhActiveIds`; works in map and list views; count line reflects it.
- Empty state (e.g., 1 AM): list view shows "No happy hours running — most kick off around 4 PM." plus a link "See the week's happy hours →" navigating to the Discover rail. Map shows zero ringed pins; chip stays visible.
- Division of labor (user requirement 2026-07-07): **map = live only; planning for later today / other days lives in the Discover rail's day tabs** — the map never grows a date picker.

## 5. Discover rail with day tabs (Discover.tsx)

- New top section **"Happy hours"** with day tabs: **Today · Mon–Sun** (same Monday-first tab pattern as `PopularTimesChart`; Today is default and highlighted).
- **Today tab:** active venues sorted by ends-soonest, then upcoming-today sorted by starts-soonest. Lines: `🥂 til 7 PM` (active, amber) / `🥂 starts 4 PM` (upcoming, muted).
- **Other-day tabs:** every venue with a happy hour on that weekday, sorted by start time, line = `🥂 4–7 PM` (via `formatPeriodRange`). Helper `getHappyHourPeriodsForDay(happyHour, day): WeeklyPeriod[]` added next to `getHappyHourState`.
- Row = existing `BarCard` + the time line under it. Today tab hidden-when-empty rule applies only to the section as a whole when NO venue has HH data at all; an empty *selected day* shows "No happy hours listed for {day} yet."

## 6. Active-state upgrades on existing surfaces

- `VenueQuickInfo` line 2 and `VenueInfoCard` happy-hour row: when active → "🥂 **Happy hour now** · til 7 PM" in amber; when upcoming-today → schedule text plus "starts 4 PM"; otherwise unchanged schedule text (existing 🍸 emoji in these lines becomes 🥂 to keep the mark consistent and distinct from the lounge glyph).
- `vibeScore`: no logic change (already boosts active HH); reason string emoji aligns to 🥂.

## Error handling / edges

- No `happyHour` data → `status: "none"` → venue simply doesn't participate anywhere. Cross-midnight HH periods handled by the same closeDayOffset math. Expired enrichment (>30d) already returns undefined upstream.

## Verification

Gates: script test, tsc (`-p tsconfig.app.json`), build. Playwright demo-mode: at a mocked/real "now", ringed pins match `getHappyHourState` output; 🥂 chip filters correctly incl. empty state; Discover rail ordering (ends-soonest first) and hides-when-empty; Death & Co pin shows 🍸 not 🍺; drawer/info card show "Happy hour now · til X" only when active. Screenshot pins + rail for the user.
