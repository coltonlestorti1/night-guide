# Happy Hour + Pin Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship spec `2026-07-07-happy-hour-and-pin-icons-design.md`: live happy-hour highlighting (amber pin rings, 🥂 chip, active states) + weekly planner rail on Discover + recut category glyphs (🍺/🍸/🪩 with cocktail override).

**Architecture:** One new pure state function (`getHappyHourState` + per-day helper) in the enrichment module drives every surface; a shared 60s tick hook makes time boundaries live. Trait detection (`isCocktailSpot`) extracted from vibeScore into `src/lib/venueTraits.ts` for reuse by Map. Branch: `happy-hour-pins`.

**Tech Stack:** existing (Vite/React/TS/Tailwind, MapLibre DOM markers). No new deps.

## Global Constraints

Same as prior plans: gates = script test + `npx tsc --noEmit -p tsconfig.app.json` + `npm run build` + Playwright demo-mode; no fabricated data (no-HH venues don't participate); marker geo-anchoring rule (no inline `position` on wrapper); markers must not rebuild on every render (stable memo keys); copy tone bank; commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

### Task 1: `getHappyHourState` + `getHappyHourPeriodsForDay` + `useMinuteTick`
- Files: `src/data/enrichment/index.ts` (append), `src/hooks/useMinuteTick.ts` (new).
- `getHappyHourState(happyHour, now = new Date())`: reuse minutes-of-week math; active → `{ status: "active", endsAt: formatTime(close) }`; else if any period with `p.day === now.getDay()` and start > nowMin → `{ status: "upcoming-today", startsAt: formatTime(open) }` (earliest such); else `{ status: "none" }`.
- `getHappyHourPeriodsForDay(happyHour, day)`: filter + sort by openHour/openMinute.
- `useMinuteTick()`: `useState(0)` + 60s `setInterval` increment, cleanup on unmount; returns the counter (consumers just reference it to re-render).
- Gates; commit `feat: happy-hour state helpers and minute tick`.

### Task 2: `venueTraits.ts` + glyph recut + amber ring (Map.tsx)
- New `src/lib/venueTraits.ts`: `isCocktailSpot(v)` = normalized title+description contains cocktail|speakeasy, OR `avg_price_level >= 3` with category "bar"; `pinGlyph(v)` = club → "🪩", lounge → "🍸", bar → isCocktailSpot ? "🍸" : "🍺". `vibeScore.ts` swaps its inline keyword check to `isCocktailSpot` (keep scoring weights identical).
- Map.tsx: delete `CATEGORY_GLYPH`, use `pinGlyph(v)`; new prop `happyHour?: Set<string>`; when `happyHour.has(v.id)` add ring via additional box-shadow layers `0 0 0 2.5px #f59e0b, 0 0 14px rgba(245,158,11,0.67)` prepended to the existing shadow expression (selected/hot logic unchanged). Add `happyHourKey` (sorted ids joined) to `addMarkers` dep array — NOT the Set object.
- MapPage: `const tick = useMinuteTick();` `hhActiveIds` = `useMemo(Set of venues where getHappyHourState(getEnrichment(title)?.happyHour).status === "active", [venues, tick])`; pass to `<Map happyHour={hhActiveIds} />`.
- Gates; commit `feat: category pin glyphs with cocktail override and happy-hour ring`.

### Task 3: 🥂 chip (MapPage)
- `PRIMARY_FILTERS` gains `{ label: "Happy hour", value: "happy-hour" }` (render 🥂 prefix); local `hhFilter` state on MapPage (chip active styling mirrors others via `isActive` given a callback — FilterChips gains props `hhActive: boolean; onHappyHour: () => void`).
- When on: `venues` displayed (map + list) filtered to `hhActiveIds`; count line reflects; list empty state text: "No happy hours running — most kick off around 4 PM." + Link to `/discover` "See the week's happy hours →".
- Gates; commit `feat: live happy-hour filter chip`.

### Task 4: Discover planner rail
- Discover.tsx: fetch venues (existing hook), `useMinuteTick`; section "Happy hours" above the main list, hidden only if zero venues have `happyHour` data; day tabs Today + Mon–Sun (reuse PopularTimesChart tab styling); Today = active (ends-soonest) then upcoming (starts-soonest); other days via `getHappyHourPeriodsForDay` sorted by start; per-row `BarCard` + line (`🥂 til 7 PM` amber / `🥂 starts 4 PM` muted / `🥂 4–7 PM` for other days); empty selected day: "No happy hours listed for {day} yet."
- Gates; commit `feat: weekly happy-hour planner rail on Discover`.

### Task 5: active-state upgrades
- `VenueQuickInfo` + `VenueInfoCard`: swap 🍸 HH mark → 🥂; when state active render "🥂 Happy hour now · til {endsAt}" (amber/primary emphasis); upcoming-today appends "· starts {startsAt}"; else schedule text as today. `vibeScore` reason emoji → 🥂 (no scoring change).
- Gates; commit `feat: live happy-hour states on drawer strip and info card`.

### Task 6: Playwright verification (demo mode, env aside → restore)
- Ringed pins exactly = venues where `getHappyHourState` says active at real now (assert dynamically, not hardcoded names); Death & Co pin 🍸 not 🍺; McSorley's 🍺; a club 🪩; 🥂 chip filters + empty state + link; Discover rail: Today ordering, pick another weekday (e.g. Fri) → expect the 14 HH venues' Friday periods sorted by start; drawer/info card active-state strings; console clean. Screenshots: map pins, rail. Restore env; full gates; merge decision to user.
