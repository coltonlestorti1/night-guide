# East Village Import + College Scene / Rooftop / Outdoor — Design

**Status:** APPROVED by Colton 2026-07-25 (gate discussion done; he authorized building
to a good stopping point while away).
**Tracker:** §26 follow-ons 1 (scoped), 2, and the rooftop/outdoor slice of 4.
**Source:** `docs/ENDZ_NIGHTLIFE_DATASET.md`.

## Problem

The nightlife dataset holds enriched attributes for 10 East Village venues — age
cohort, rooftop, outdoor, happy-hour windows — and none of it is reachable by the app.
Three concrete blockers, found during the gate audit:

1. **`src/data/venues.ts` is not the live source.** `src/data/resolver.ts:12` selects
   `SupabaseDataSource` whenever Supabase is configured; `DemoDataSource` (which reads
   `venues.ts`) is only the no-config fallback. Editing `venues.ts` alone ships nothing.
2. **The live `venues` table has nowhere to put the enrichment.** Columns are
   `id, name, type, price, description, music, age_range, lat, lng, is_active, created_at`.
   No rooftop, outdoor, or neighborhood. `mapVenueRow` never maps `neighborhood`.
3. **`age_range` is text parsed by `^(\d+)\s*-\s*(\d+)$`** (`SupabaseDataSource.ts:30`).
   Encoding `"College scene · 21–25"` into that column silently drops the age entirely.

## Scope

**In:** 5 new East Village venues · enrich 5 existing · College-scene age display ·
rooftop + outdoor flags on cards, search, and Find the Vibe.

**Out (logged, not built):** happy-hour window data (the `HAPPY_HOURS` chip in
`VibeFinder.tsx:39` still has no venue data behind it — the dataset supplies windows for
9 venues, but Colton scoped this pass to rooftop/outdoor) · occasion filters · the 5-zone
taxonomy · West / Meatpacking venues · the ~13 unverified PDF backlog EV names · the
3 ENDZ venues with PDF-only scraps (KGB, Paradise Lost, Mona's) — annotations too thin
to import without verification.

## Data model

`age_range` stays **clean numeric**. The college cohort is a separate boolean, and the
display layer composes them. This is what keeps the existing regex working and makes the
"never render 18–21" rule enforceable in one place.

### DDL (one paste, recorded in `~/Documents/endz/endz-schema.sql`)

```sql
alter table venues add column if not exists neighborhood     text;
alter table venues add column if not exists is_college_scene boolean not null default false;
alter table venues add column if not exists has_rooftop      boolean not null default false;
alter table venues add column if not exists has_outdoor      boolean not null default false;
```

`false` is an honest default here: it means "not a rooftop venue", which is true of the
47 venues we have no dataset coverage for. `neighborhood` stays nullable — `null` means
"unknown", which is also true, and 28 of the current 52 already have no sub-neighborhood.

### Venue type (`src/data/types.ts`)

```ts
is_college_scene?: boolean;
has_rooftop?: boolean;
has_outdoor?: boolean;
```

`neighborhood?: string` already exists; `mapVenueRow` starts populating it.

## Age display rule

One function, `formatAgeDisplay(venue)` in `src/lib/format.ts`, is the only place that
composes the string. Every surface calls it.

| `is_college_scene` | numeric band | renders |
|---|---|---|
| true | 21–25 | `College scene · 21–25` |
| true | none | `College scene` |
| false | 21–30 | `21–30` |
| false | none | *(tile omitted)* |

**Sub-21 guard:** if a numeric band has `min < 21`, the numeric half is suppressed and
only `College scene` renders. This is the enforcement point for "the string 18–21 never
renders anywhere" — it holds even if bad data reaches the column later.

The existing `formatAgeRange` is kept for its current callers and returns
`"Not provided"` as it does today; `formatAgeDisplay` returns `null` when there is
nothing to show, so `VenueStatTiles` can keep its "no permanent — placeholders" rule.

## Surfaces

**Cards** — `VenueStatTiles.tsx`. The `Ages` tile switches to `formatAgeDisplay`.
Rooftop and outdoor become two additional tiles in the same grid, **each with its own
icon** — per §20's hard rule that rooftops are never lumped in with general outdoor
seating. Tiles only render when true, matching the file's existing behavior.

**Search** — `MapPage.tsx`. Two chips added to `FilterChips` beside the existing
category / happy-hour / saved chips. `VenueQuery` gains `rooftop?: boolean` and
`outdoor?: boolean`; `filterVenues` in `DemoDataSource.ts` handles them (both data
sources route through it). `searchMatch.ts` also folds the flags into its haystack so
typing "rooftop" or "backyard" matches.

**Find the Vibe** — `VibeFinder.tsx`. One chip group in the existing `Chip` pattern,
alongside `HAPPY_HOURS`.

**Dead-end guard:** with this data there is exactly **1** rooftop venue and **2**
outdoor. `MapPage.tsx:50` already establishes that a chip with zero matches is a
dead-end filter, so both chips hide when nothing in the loaded set matches, rather than
offering a filter that empties the map.

## Venues

### Enriched (already in ENDZ — no new rows, `update` by name)

| Venue | Age | College | Rooftop | Outdoor |
|---|---|---|---|---|
| Downtown Social (13th Step) | 21–25 | **yes** | — | — |
| Doc Holliday's | 23–35 | — | — | — |
| Niagara | 21–30 | — | — | **yes** |
| Wiggle Room | 21–27 | — | — | — |
| The Library | 21–30 | — | — | — |

### New (5 rows, 52 → 57)

Coordinates geocoded from street addresses via OSM/Nominatim (Google lookups stay
paused per 2026-07-17). Three resolved to the venue or its building **by name** —
noted below. **Colton should eyeball these before the paste.**

| Venue | Type | Address | Lat / Lng | Age | Flags | Geocode confidence |
|---|---|---|---|---|---|---|
| Phebe's Tavern | bar `$$` | 359 Bowery | 40.726876, -73.991353 | 21–25 | college | **named match** (`Phebes`) |
| Joyface | lounge | 104 Ave C | 40.723918, -73.978791 | 21–27 | — | **named match** (`Joyface`) |
| St. Dymphna's | bar | 117 Ave A | 40.726448, -73.983620 | 23–33 | **outdoor** (backyard) | address match |
| Nublu 151 | club | 151 Ave C | 40.725651, -73.978020 | 21–30 | — | address match |
| The Ready Rooftop | lounge | 112 E 11th St | 40.731407, -73.989437 | 21–28 | **rooftop** | **named match** (`Moxy`, its building) |

Sanity-checked against neighbors already on the map: St. Dymphna's (117 Ave A) lands
just south of Doc Holliday's (141 Ave A), as it should.

**Sub-neighborhoods:** St. Dymphna's → `Avenue A` and The Ready → `Upper East Village`
reuse existing buckets. Phebe's needs a new `Bowery`; Joyface and Nublu need a new
`Avenue C / Alphabet City`. Two new values, both accurate — better than forcing Ave C
venues into the existing `Avenue B / Alphabet City`.

Descriptions and music come verbatim from the dataset's verified profiles. Taglines and
`_internal:_` reputation flags are **not** imported — they never render publicly.

## Two sources, kept in parity

`venues.ts` (demo) and the Supabase rows must describe the same venues, or the fallback
lies. Both get updated in this change: `venues.ts` directly, Supabase via staged SQL.

## Rollout

Code merges before the DDL is pasted, so it must degrade cleanly:

- `select("*")` does not error on columns that don't exist yet — it just returns fewer.
- `mapVenueRow` reads the new fields defensively; absent → `undefined` → falsy.
- Result pre-paste: the 5 new venues are missing and no rooftop/outdoor chips appear
  (dead-end guard hides them), but **nothing throws and nothing regresses.**

Post-paste, the data appears with no redeploy.

## Acceptance criteria

1. `npx tsc --noEmit -p tsconfig.app.json` and `npm run build` both clean.
2. Demo source (`venues.ts`) shows 57 venues; the 5 new ones render on the map.
3. Downtown Social and Phebe's show `College scene · 21–25` in the Ages tile.
4. No venue anywhere renders a band whose lower bound is under 21.
5. The Ready shows a rooftop tile; St. Dymphna's and Niagara show an outdoor tile;
   the two are visually distinct.
6. Rooftop chip filters the map to The Ready; Outdoor chip to St. Dymphna's + Niagara.
7. Both chips hide when the loaded set has no match.
8. Typing "rooftop" in search surfaces The Ready.
9. With the DDL unpasted, the app loads and behaves exactly as it does today.

## What Colton does on return

1. Review this spec and the coordinate table.
2. Paste the staged DDL + inserts from `~/Documents/endz/endz-schema.sql`.
3. Decide merge / push.
