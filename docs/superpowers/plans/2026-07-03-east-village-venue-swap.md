# East Village Venue Data Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Lisbon demo venue dataset with the 19 real East Village (NYC) beachhead venues, and remove every Lisbon reference from UI copy, map coordinates, and now-dead assets.

**Architecture:** `src/data/venues.ts` exports a single hardcoded `Venue[]` array consumed by `DemoDataSource` (the active default data source per `src/data/resolver.ts`). This plan replaces that array's contents and rename (`LISBON_VENUES` → `EAST_VILLAGE_VENUES`), updates every other file that references Lisbon by name or hardcodes Lisbon's map coordinates, then deletes image assets that become unreferenced as a result (plus 10 already-unreferenced leftover images found during exploration).

**Tech Stack:** Vite, React, TypeScript. No test runner is configured in this repo — verification is via `npx tsc --noEmit`, `npm run build`, and manual/browser checks, same as the prior Mapbox-token plan.

## Global Constraints

- No fabricated venue stats: `buzz_score`, `hot_tonight`, `editors_pick`, `venue_stats`, `open_now`, `cover_charge` must be omitted (not set to invented values) for every East Village venue — live activity data must come from real check-ins, never made up, per `~/Documents/endz/ENDZ.md`'s ground truth section.
- No `image_url` for any East Village venue — no budget for photos, and generic stock photos risk misrepresenting a real, identifiable venue. Rely on the existing gradient fallback in `BarCard`/`VenueDetail`.
- Every field populated on an East Village venue must be traceable to `~/Documents/endz/endz-seed-venues.sql` or its section-comment groupings — no invented `venue_type_primary`/`venue_types` subtypes (the seed data doesn't have that granularity).
- Do not change the `Venue` type shape in `src/data/types.ts` — every field used here already exists on the type.

---

### Task 1: Replace the venue dataset

**Files:**
- Modify: `src/data/venues.ts` (full replacement)

**Interfaces:**
- Produces: `export const EAST_VILLAGE_VENUES: Venue[]` (replaces the removed `LISBON_VENUES` export) — Task 2 renames every import/usage of `LISBON_VENUES` to this new name.

- [ ] **Step 1: Replace the full contents of `src/data/venues.ts`**

Replace the entire file with:

```ts
/**
 * East Village (NYC) nightlife dataset — 19 venues.
 * This file is the single source of truth for demo venue data.
 * Sourced from ~/Documents/endz/endz-seed-venues.sql (the beachhead's
 * real venue list). No fabricated activity stats or images — see
 * docs/superpowers/specs/2026-07-03-east-village-venue-swap-design.md.
 */
import { Venue } from "@/data/types";

export const EAST_VILLAGE_VENUES: Venue[] = [
  {
    id: "the-grafton",
    title: "The Grafton",
    description: "Chill neighborhood Irish pub. Launch-night anchor.",
    latitude: 40.7268,
    longitude: -73.9862,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "1st Avenue",
    age_range_min: 21,
    age_range_max: 30,
    avg_price_level: 2,
    music_type: "Mixed",
  },
  {
    id: "standings",
    title: "Standings",
    description: "Sports bar, no TVs — just good beer and standing room.",
    latitude: 40.7264,
    longitude: -73.9860,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "1st Avenue",
    age_range_min: 21,
    age_range_max: 28,
    avg_price_level: 1,
  },
  {
    id: "international-bar",
    title: "International Bar",
    description: "Divey, cheap, packed on weekends. No-frills East Village.",
    latitude: 40.7267,
    longitude: -73.9861,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "1st Avenue",
    age_range_min: 21,
    age_range_max: 27,
    avg_price_level: 1,
    music_type: "Mixed",
  },
  {
    id: "coyote-ugly-saloon",
    title: "Coyote Ugly Saloon",
    description: "High-energy bar, bar-top dancing, rowdy crowd.",
    latitude: 40.7283,
    longitude: -73.9854,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "1st Avenue",
    age_range_min: 21,
    age_range_max: 28,
    avg_price_level: 2,
    music_type: "Rock / Pop",
  },
  {
    id: "niagara-bar",
    title: "Niagara Bar",
    description: "Rock bar, tattoo-crowd vibe, cheap drinks.",
    latitude: 40.7264,
    longitude: -73.9816,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue A",
    age_range_min: 21,
    age_range_max: 30,
    avg_price_level: 1,
    music_type: "Rock",
  },
  {
    id: "pauls-cocktail-lounge",
    title: "Paul's Cocktail Lounge",
    description: "Cozy dive with strong pours. Regulars and newcomers mix.",
    latitude: 40.7277,
    longitude: -73.9816,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue A",
    age_range_min: 21,
    age_range_max: 35,
    avg_price_level: 2,
    music_type: "Mixed",
  },
  {
    id: "lucys-bar",
    title: "Lucy's Bar",
    description: "No-frills dive, cash only, always buzzing late night.",
    latitude: 40.7278,
    longitude: -73.9815,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue A",
    age_range_min: 21,
    age_range_max: 30,
    avg_price_level: 1,
    music_type: "Mixed",
  },
  {
    id: "doc-hollidays",
    title: "Doc Holliday's",
    description: "Country-tinged dive, cheap shots, late-night staple.",
    latitude: 40.7285,
    longitude: -73.9814,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue A",
    age_range_min: 21,
    age_range_max: 30,
    avg_price_level: 1,
    music_type: "Country",
  },
  {
    id: "cienfuegos",
    title: "Cienfuegos",
    description: "Cuban rum lounge. Mojitos and sultry lighting.",
    latitude: 40.7257,
    longitude: -73.9818,
    serves_alcohol: true,
    category: "lounge",
    neighborhood: "Avenue A",
    age_range_min: 23,
    age_range_max: 35,
    avg_price_level: 3,
    music_type: "Latin / Jazz",
  },
  {
    id: "the-library",
    title: "The Library",
    description: "Cramped, loud, dive. Good jukebox. Good people.",
    latitude: 40.7231,
    longitude: -73.9830,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue A",
    age_range_min: 21,
    age_range_max: 28,
    avg_price_level: 1,
    music_type: "Mixed",
  },
  {
    id: "manitobas",
    title: "Manitoba's",
    description: "Rock and roll bar owned by a Dictators punk legend.",
    latitude: 40.7258,
    longitude: -73.9790,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue B / Alphabet City",
    age_range_min: 21,
    age_range_max: 40,
    avg_price_level: 2,
    music_type: "Rock",
  },
  {
    id: "death-and-co",
    title: "Death & Co",
    description: "Cocktail bar that helped define the craft cocktail era.",
    latitude: 40.7250,
    longitude: -73.9808,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue B / Alphabet City",
    age_range_min: 25,
    age_range_max: 40,
    avg_price_level: 3,
    music_type: "Mixed",
  },
  {
    id: "the-summit-bar",
    title: "The Summit Bar",
    description: "Neighborhood bar, strong cocktails, laid-back crowd.",
    latitude: 40.7277,
    longitude: -73.9768,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue B / Alphabet City",
    age_range_min: 23,
    age_range_max: 35,
    avg_price_level: 2,
    music_type: "Mixed",
  },
  {
    id: "alphabet-city-beer-co",
    title: "Alphabet City Beer Co",
    description: "Craft beer focus, chill, good for early-night drinking.",
    latitude: 40.7257,
    longitude: -73.9768,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "Avenue B / Alphabet City",
    age_range_min: 21,
    age_range_max: 35,
    avg_price_level: 2,
  },
  {
    id: "the-bourgeois-pig",
    title: "The Bourgeois Pig",
    description: "Wine and cocktail bar, cozy booths, low lighting.",
    latitude: 40.7264,
    longitude: -73.9840,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "St. Marks Place",
    age_range_min: 23,
    age_range_max: 35,
    avg_price_level: 2,
    music_type: "Mixed",
  },
  {
    id: "kgb-bar",
    title: "KGB Bar",
    description: "Soviet-themed dive, literary events, real underground feel.",
    latitude: 40.7248,
    longitude: -73.9887,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "St. Marks Place",
    age_range_min: 21,
    age_range_max: 35,
    avg_price_level: 2,
  },
  {
    id: "mcsorleys-old-ale-house",
    title: "McSorley's Old Ale House",
    description: "NYC institution. Two beers: light or dark. Cash only.",
    latitude: 40.7267,
    longitude: -73.9893,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "St. Marks Place",
    age_range_min: 21,
    age_range_max: 40,
    avg_price_level: 1,
  },
  {
    id: "angels-share",
    title: "Angel's Share",
    description: "Hidden Japanese cocktail lounge. Quiet, precise, stunning.",
    latitude: 40.7299,
    longitude: -73.9887,
    serves_alcohol: true,
    category: "lounge",
    neighborhood: "Upper East Village",
    age_range_min: 25,
    age_range_max: 40,
    avg_price_level: 3,
    music_type: "Jazz",
  },
  {
    id: "beauty-bar",
    title: "Beauty Bar",
    description: "Former beauty salon turned dance bar. Fun, campy, good DJ.",
    latitude: 40.7330,
    longitude: -73.9830,
    serves_alcohol: true,
    category: "bar",
    neighborhood: "E 14th Street",
    age_range_min: 21,
    age_range_max: 30,
    avg_price_level: 2,
    music_type: "Pop / Indie",
  },
];
```

Note this removes all 12 `@/assets/venues/*.jpg` imports the old Lisbon array had — no East Village venue has an `image_url`, so none are needed. This makes those 12 image files unreferenced; Task 3 handles deleting them (after this task lands, so nothing references them when they're removed).

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (This will surface any typo in a field name or a value outside the `VenueCategory`/`1|2|3|4|5` union — e.g. if `category` were misspelled as `"bars"` instead of `"bar"`.)

- [ ] **Step 3: Verify it's exactly 19 venues with no duplicate ids**

Run: `node -e "const ts=require('fs').readFileSync('src/data/venues.ts','utf8'); const ids=[...ts.matchAll(/id: \"([a-z0-9-]+)\"/g)].map(m=>m[1]); console.log('count:', ids.length); console.log('unique:', new Set(ids).size);"`
Expected: `count: 19` and `unique: 19` (confirms no duplicate slugs).

- [ ] **Step 4: Commit**

```bash
git add src/data/venues.ts
git commit -m "feat: replace Lisbon mock venues with 19 real East Village venues"
```

---

### Task 2: Remove every remaining Lisbon reference

**Files:**
- Modify: `src/data/resolver.ts:11`
- Modify: `src/data/sources/DemoDataSource.ts:3,38,43`
- Modify: `src/store/mapState.ts:11-12`
- Modify: `src/components/Map.tsx:164-165,170,175,197`
- Modify: `src/pages/MapPage.tsx:2,52,243`
- Modify: `src/pages/Discover.tsx:15`

**Interfaces:**
- Consumes: `EAST_VILLAGE_VENUES` (Task 1) — this task's `resolver.ts`/`DemoDataSource.ts` edits reference it by that exact name.
- Produces: nothing new consumed by Task 3 — Task 3 only needs Task 1 and this task both landed so it can safely check which images are unreferenced.

- [ ] **Step 1: Update `src/data/resolver.ts`**

Replace line 11:

```ts
  // Default to demo data with 12 Lisbon nightlife venues
```

with:

```ts
  // Default to demo data with 19 East Village nightlife venues
```

- [ ] **Step 2: Update `src/data/sources/DemoDataSource.ts`**

Replace line 3:

```ts
import { LISBON_VENUES } from "@/data/venues";
```

with:

```ts
import { EAST_VILLAGE_VENUES } from "@/data/venues";
```

Replace line 38:

```ts
    return filterVenues(LISBON_VENUES, q);
```

with:

```ts
    return filterVenues(EAST_VILLAGE_VENUES, q);
```

Replace line 43:

```ts
    return LISBON_VENUES.find((v) => v.id === id) ?? null;
```

with:

```ts
    return EAST_VILLAGE_VENUES.find((v) => v.id === id) ?? null;
```

- [ ] **Step 3: Update the default map center in `src/store/mapState.ts`**

Replace lines 11-12:

```ts
  center: [-9.1393, 38.7223],
  zoom: 13,
```

with:

```ts
  center: [-73.9833, 40.7270],
  zoom: 15,
```

(This is the actual centroid of the 19 East Village venues' coordinates — lands in the St. Marks/Avenue A area. Zoom 15 frames one walkable neighborhood; Lisbon's zoom 13 was tuned for a whole-city view.)

- [ ] **Step 4: Update hardcoded coordinates and copy in `src/components/Map.tsx`**

Replace lines 163-166:

```tsx
        () => {
          toast.info("Location unavailable — showing Lisbon center");
          map.current?.flyTo({ center: [-9.1393, 38.7223], zoom: 13, duration: 1500 });
        }
```

with:

```tsx
        () => {
          toast.info("Location unavailable — showing East Village center");
          map.current?.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
        }
```

Replace line 170:

```tsx
      map.current.flyTo({ center: [-9.1393, 38.7223], zoom: 13, duration: 1500 });
```

with:

```tsx
      map.current.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
```

Replace line 175:

```tsx
    map.current?.flyTo({ center: [-9.1393, 38.7223], zoom: 13, duration: 1200 });
```

with:

```tsx
    map.current?.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1200 });
```

Replace line 197:

```tsx
          aria-label="Recenter on Lisbon"
```

with:

```tsx
          aria-label="Recenter on East Village"
```

- [ ] **Step 5: Update copy in `src/pages/MapPage.tsx`**

Replace line 2:

```tsx
 * MapPage — investor-demo-ready Lisbon nightlife map.
```

with:

```tsx
 * MapPage — investor-demo-ready East Village nightlife map.
```

Replace line 52:

```tsx
            <p className="text-xs text-muted-foreground -mt-0.5">Find your night in Lisbon</p>
```

with:

```tsx
            <p className="text-xs text-muted-foreground -mt-0.5">Find your night in the East Village</p>
```

Replace line 243:

```tsx
      <h1 id="map-heading" className="sr-only">ENDZ Nightlife Map — Lisbon</h1>
```

with:

```tsx
      <h1 id="map-heading" className="sr-only">ENDZ Nightlife Map — East Village</h1>
```

- [ ] **Step 6: Update copy in `src/pages/Discover.tsx`**

Replace line 15:

```tsx
        <p className="text-sm text-muted-foreground">Trending nightlife in Lisbon tonight</p>
```

with:

```tsx
        <p className="text-sm text-muted-foreground">Trending nightlife in the East Village tonight</p>
```

- [ ] **Step 7: Verify no Lisbon references remain and the app compiles**

Run: `grep -rniI "lisbon" src/`
Expected: no output (zero matches).

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 8: Manually verify the map loads centered on the East Village**

Run: `npm run dev`, open the app in a browser with a valid Mapbox token available (env var or pasted into the manual-entry screen).
Expected: the map opens centered around St. Marks Place/Avenue A (not Lisbon), showing pins for the 19 East Village venues; the page subtitle reads "Find your night in the East Village"; the Discover tab reads "Trending nightlife in the East Village tonight".

- [ ] **Step 9: Commit**

```bash
git add src/data/resolver.ts src/data/sources/DemoDataSource.ts src/store/mapState.ts src/components/Map.tsx src/pages/MapPage.tsx src/pages/Discover.tsx
git commit -m "feat: remove Lisbon references, center map on East Village"
```

---

### Task 3: Delete unreferenced venue images

**Files:**
- Delete: `src/assets/venues/beef-and-brew.jpg`
- Delete: `src/assets/venues/billsboro-winery.jpg`
- Delete: `src/assets/venues/eddie-obriens.jpg`
- Delete: `src/assets/venues/flx-live.jpg`
- Delete: `src/assets/venues/hog-wallow-tavern.jpg`
- Delete: `src/assets/venues/kashong-creek-distillery.jpg`
- Delete: `src/assets/venues/lake-drum-brewing.jpg`
- Delete: `src/assets/venues/ports-cafe.jpg`
- Delete: `src/assets/venues/smith-opera-house.jpg`
- Delete: `src/assets/venues/the-linden.jpg`
- Delete: `src/assets/venues/park-bar.jpg`
- Delete: `src/assets/venues/lux-fragil.jpg`
- Delete: `src/assets/venues/tasca-do-chico.jpg`
- Delete: `src/assets/venues/red-frog.jpg`
- Delete: `src/assets/venues/ministerium.jpg`
- Delete: `src/assets/venues/pensao-amor.jpg`
- Delete: `src/assets/venues/by-the-wine.jpg`
- Delete: `src/assets/venues/urban-beach.jpg`
- Delete: `src/assets/venues/village-underground.jpg`
- Delete: `src/assets/venues/cinco-lounge.jpg`
- Delete: `src/assets/venues/cheers-bar.jpg`
- Delete: `src/assets/venues/bairro-alto-bar.jpg`

**Interfaces:**
- Consumes: Task 1 (removed the 12 Lisbon image imports) and Task 2 (no other file introduces new references to these images) — this task must run after both, otherwise deleting the 12 Lisbon-venue images would break a build that still imports them.
- Produces: nothing — this is the final task in this plan.

- [ ] **Step 1: Confirm every file in this task is actually unreferenced before deleting**

Run: `grep -rlE "(beef-and-brew|billsboro-winery|eddie-obriens|flx-live|hog-wallow-tavern|kashong-creek-distillery|lake-drum-brewing|ports-cafe|smith-opera-house|the-linden|park-bar|lux-fragil|tasca-do-chico|red-frog|ministerium|pensao-amor|by-the-wine|urban-beach|village-underground|cinco-lounge|cheers-bar|bairro-alto-bar)\.jpg" src/`

Expected: no output (zero matches — confirms none of these 22 filenames are imported anywhere, including in `src/data/venues.ts` after Task 1's rewrite).

If this command DOES print a match, STOP — do not delete that file. Report back with the matching file:line; something in this plan's assumptions was wrong (e.g. a file was reused for an East Village venue by coincidence, or Task 1/2 didn't land as expected) and needs the controller's judgment before proceeding.

- [ ] **Step 2: Delete the 22 unreferenced images**

```bash
git rm src/assets/venues/beef-and-brew.jpg src/assets/venues/billsboro-winery.jpg src/assets/venues/eddie-obriens.jpg src/assets/venues/flx-live.jpg src/assets/venues/hog-wallow-tavern.jpg src/assets/venues/kashong-creek-distillery.jpg src/assets/venues/lake-drum-brewing.jpg src/assets/venues/ports-cafe.jpg src/assets/venues/smith-opera-house.jpg src/assets/venues/the-linden.jpg src/assets/venues/park-bar.jpg src/assets/venues/lux-fragil.jpg src/assets/venues/tasca-do-chico.jpg src/assets/venues/red-frog.jpg src/assets/venues/ministerium.jpg src/assets/venues/pensao-amor.jpg src/assets/venues/by-the-wine.jpg src/assets/venues/urban-beach.jpg src/assets/venues/village-underground.jpg src/assets/venues/cinco-lounge.jpg src/assets/venues/cheers-bar.jpg src/assets/venues/bairro-alto-bar.jpg
```

- [ ] **Step 3: Verify the app still builds with the images gone**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors (confirms nothing still references a deleted file).

- [ ] **Step 4: Verify the directory is now empty (or report what's left)**

Run: `ls src/assets/venues/`
Expected: empty output. If any files remain, list them in your report — that's expected only if a venue image legitimately still exists for a reason outside this plan's scope; don't delete anything not explicitly listed in this task's Files section.

- [ ] **Step 5: Commit**

```bash
git add -A src/assets/venues/
git commit -m "chore: delete unreferenced venue images (Lisbon + leftover Finger Lakes set)"
```
