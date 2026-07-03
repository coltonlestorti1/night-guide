# ENDZ — Replace Lisbon Mock Data with East Village NYC Venues

**Date:** 2026-07-03
**Status:** Approved
**Scope:** Replace the hardcoded Lisbon demo venue dataset with the 19 real East Village beachhead venues, and remove every Lisbon reference from UI copy, map coordinates, and dead assets it touches.

---

## Context

`src/data/venues.ts` currently hardcodes 12 fictional/generic Lisbon venues (`LISBON_VENUES`) as the app's only data source (via `DemoDataSource`, the active default per `src/data/resolver.ts`). ENDZ's actual beachhead — per `~/Documents/endz/CLAUDE.md` and `ENDZ.md` — is East Village, NYC, with 19 real venues already researched and captured in `~/Documents/endz/endz-seed-venues.sql`. The mock data needs to reflect the real product, not a placeholder city, before further MVP work (Supabase wiring, launch-night validation) makes sense.

Lisbon isn't confined to the data file — it's referenced in 6 files total: page copy, aria-labels, a toast message, and hardcoded map center/recenter coordinates.

## Decision: fabricated demo stats

The current Lisbon data invents `buzz_score`, `hot_tonight`, `editors_pick`, and `venue_stats.crowd_level` for visual polish. For the 19 real venues, these fields are **omitted entirely** (left `undefined`), not fabricated.

**Why:** `~/Documents/endz/ENDZ.md`'s own "ground truth" section states live crowd data must come from real user check-ins, never invented — showing a fake "🔥 Hot Tonight, buzz 92" for an actual identifiable bar (e.g. McSorley's) directly contradicts that principle and risks embarrassment if anyone who knows these bars sees fabricated activity claims.

Also omitted for the same reason (unknown, not fabricatable from the seed data): `open_now`, `cover_charge`.

## Decision: images

No `image_url` for any of the 19 venues — no budget for a photo shoot or stock licensing, and using generic non-venue-specific stock photos risks looking like a real (wrong) photo of an identifiable bar. `BarCard` and `VenueDetail` already have a working gradient-fallback for missing/failed images (confirmed during exploration — this is an existing, first-class supported state, not a broken one).

---

## Design

### 1. Data mapping — `src/data/venues.ts`

Rename `LISBON_VENUES` → `EAST_VILLAGE_VENUES`. Transcribe (not runtime-parse) each of the 19 rows from `~/Documents/endz/endz-seed-venues.sql` into a `Venue` object:

| Seed field | Venue field | Mapping |
|---|---|---|
| `name` | `id` | slugified (lowercase, spaces→hyphens, apostrophes stripped) — e.g. `"The Grafton"` → `"the-grafton"` |
| `name` | `title` | verbatim |
| `type` (`bar`\|`lounge`) | `category` | direct — seed has no `club` rows |
| `price` (`$`/`$$`/`$$$`) | `avg_price_level` | `$`→1, `$$`→2, `$$$`→3 |
| `description` | `description` | verbatim |
| `music` | `music_type` | title-cased (e.g. `"latin/jazz"` → `"Latin / Jazz"`); `"none"` → omitted (not the literal string `"None"`) |
| `age_range` (e.g. `"21-30"`) | `age_range_min`, `age_range_max` | parsed to two ints |
| `lat`, `lng` | `latitude`, `longitude` | direct |
| — | `serves_alcohol` | `true` for all 19 (every row is a bar or lounge) |
| SQL section comment (1st Avenue / Avenue A / Avenue B–Alphabet City / St. Marks / Upper East Village / E 14th border) | `neighborhood` | grounded in the seed file's own groupings, not invented |
| — | `image_url`, `buzz_score`, `hot_tonight`, `editors_pick`, `venue_stats`, `open_now`, `cover_charge` | omitted (see decisions above) |

Import statements for the 12 Lisbon `.jpg` assets are removed along with the data (no venue in the new set has an `image_url`).

### 2. De-Lisbon UI copy and coordinates

Every Lisbon string/coordinate found via repo-wide search, by file:

- **`src/pages/MapPage.tsx`**: file-header comment ("investor-demo-ready Lisbon nightlife map"), the `<p>` under the ENDZ wordmark ("Find your night in Lisbon" → "Find your night in the East Village"), and the `sr-only` `<h1>` ("ENDZ Nightlife Map — Lisbon" → "ENDZ Nightlife Map — East Village")
- **`src/pages/Discover.tsx`**: "Trending nightlife in Lisbon tonight" → "Trending nightlife in the East Village tonight"
- **`src/components/Map.tsx`**: the "Recenter on Lisbon" aria-label → "Recenter on East Village"; the "Location unavailable — showing Lisbon center" toast → "...showing East Village center"; all 3 hardcoded `flyTo({ center: [-9.1393, 38.7223], ... })` calls updated to the new center
- **`src/store/mapState.ts`**: default `center` changed from `[-9.1393, 38.7223]` to `[-73.9833, 40.7270]` (the actual centroid of the 19 venues, computed from their lat/lng — lands in the St. Marks/Avenue A area), default `zoom` changed from `13` to `15` (East Village is one walkable neighborhood, not a whole city — Lisbon's zoom level would show far too wide an area)
- **`src/data/resolver.ts`**: comment referencing "12 Lisbon nightlife venues" updated to describe the East Village dataset
- **`src/data/sources/DemoDataSource.ts`**: import and both usages of `LISBON_VENUES` renamed to `EAST_VILLAGE_VENUES`

### 3. Delete dead assets

The 10 unreferenced Finger-Lakes-themed images in `src/assets/venues/` — `beef-and-brew.jpg`, `billsboro-winery.jpg`, `eddie-obriens.jpg`, `flx-live.jpg`, `hog-wallow-tavern.jpg`, `kashong-creek-distillery.jpg`, `lake-drum-brewing.jpg`, `ports-cafe.jpg`, `smith-opera-house.jpg`, `the-linden.jpg` (verified via `comm -23` against every `@/assets/venues/*.jpg` import in `venues.ts` — confirms `by-the-wine.jpg` and the other 11 files actually used by the Lisbon data are excluded from this list) — are deleted, leftover from an earlier, pre-East-Village mock dataset.

---

## Out of scope

- Wiring real Supabase-backed venue data (separate, later plan per `~/Documents/endz/build-plan.md` Week 1)
- Adding real venue photos (revisit if/when budget allows, or when venues are onboarded and can supply their own)
- Any change to the `Venue` type shape in `src/data/types.ts` — every field used here already exists on the type
