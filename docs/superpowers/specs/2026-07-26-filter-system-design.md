# Filter System Redesign (§27) — Design

**Status:** APPROVED by Colton 2026-07-26. Scope picked ("let's do 4"), reset-per-session
confirmed ("reset everytime").
**Tracker:** §27. Related: §20 (occasion filters, later), §28 (age filter, later).

## Problem

Two of the filters are broken in production, and the row has outgrown the screen.

### Bug 1 — "Hot Tonight" empties the map

The chip sets `crowdLevel: "high"`; `filterVenues` compares it against
`venue.venue_stats.crowd_level`. **Nothing ever populates `venue_stats`** — only
`ApiDataSource`'s zod schema references it, and that source isn't configured. So
`undefined !== "high"` rejects every venue.

Verified: `filterVenues(V, { crowdLevel: "high" })` → **0 of 56**.

### Bug 2 — the Music filter returns venues with no music

`if (q.musicVibe && v.music_type && !includes(...)) return false;` — when `music_type`
is undefined the condition short-circuits and the venue is **kept**. 38 of 56 venues
have no `music_type`, so "Latin" returns **38 results, none of them Latin**. "Latin"
also matches zero real venues — a dead option in a hardcoded list.

### Crowding

11 chips in a horizontal scroller; ~4 visible on a phone. Measured yield:

| Chip | Yield | Note |
|---|---|---|
| Bars | 47/56 | removes only 9 — barely a filter |
| Outdoor | 22/56 | |
| Happy hour | 16/56 | narrows further to active-now |
| Clubs | 6/56 | |
| Lounges | 3/56 | |
| Rooftop | 1/56 | |
| Hot Tonight | **0/56** | broken |

## Design

### 1. Fix Hot Tonight — wire to real check-ins

`useVenueActivity()` already returns live per-venue counts (it colours the pins). Point
the filter at that instead of the phantom `venue_stats`, reusing the tier boundary from
`vibeScore` (`count >= 3` = lively or better).

With nobody checked in this still matches zero — which is *true*, not broken. So it
also takes the **dead-end rule** already used for Rooftop/Outdoor and `MUSIC_VIBES`:
**the chip does not render when nothing qualifies.** A filter that blanks the map is
never shown.

### 2. Fix Music — exclude unknown, and stop hardcoding genres

Guard becomes "has music AND matches": a venue with no `music_type` is excluded rather
than passed through. The genre list is derived from the venues actually loaded, so dead
options like "Latin" can't appear.

### 3. Layout — 4 inline chips + a Filters sheet

**Inline** (what you'd tap standing on a corner): `All` · `Saved` · `Happy hour` ·
`Open now`. Plus the existing `Find the move` entry point, which is a different thing
(a wizard, not a filter) and keeps its leading slot.

`Open now` is new and earns its place: enrichment has hours for **100%** of venues, and
"what's open" is the most common real question.

**Behind a `Filters` button with a count badge:** category (Bars/Clubs/Lounges),
Outdoor, Rooftop, Music, Price. Category demotes because at 84% "Bars" hardly filters.

**No Age filter yet** — 52% coverage would silently hide half the map. It belongs after
§28 lands crowd-sourced ages.

### 4. State — one store, no persistence

Filter state is split today: `categories`/`crowdLevel`/`musicVibe`/`search` in
`useFilterStore`, but `hhFilter`/`savedFilter`/`rooftopFilter`/`outdoorFilter` are
`useState` inside `MapPage`. The sheet and the count badge both need to read everything,
so all of it moves into the store.

**`useFilterStore` has no persist middleware and must not gain one.** Filters reset when
the app reloads — Colton's call, and the right one: nightlife intent changes nightly, and
a sticky filter quietly hiding venues is a bad surprise.

## Out of scope

Occasion filters (§20) · age filter (§28) · sorting · saved filter presets · changing
Find the move.

## Acceptance criteria

1. `npx tsc --noEmit -p tsconfig.app.json` and `npm run build` clean.
2. "Hot Tonight" never returns 0 while visible — it is hidden when no venue has activity.
3. Music filtering excludes venues with unknown `music_type`; genre options come from
   loaded data, so every option returns ≥ 1 venue.
4. Four inline chips + `Find the move`; everything else lives in the sheet.
5. The Filters button shows a count of active filters and clears them all in one tap.
6. `Open now` matches the open/closed state already shown on venue cards.
7. Reloading the app clears every filter.
8. Existing behaviour intact: search, Saved, Happy hour, and the map/list toggle.
