# Named Directions — Build Notes + Apple Verification Runbook (2026-07-15)

Follows the 2026-07-14 prep doc (`2026-07-14-apple-maps-named-nav-prep.md`).
This is the build of **approach B** from that prep: name + address navigation now,
with a slot for verified Apple place IDs that Colton fills in later.

Branch: `feat/named-directions` (not merged, not deployed).

---

## What was built

**Problem:** the Directions button sent only `lat,lng`, so Apple/Google Maps
dropped an unnamed pin — no venue name, no place card.

**Now:** Directions builds a *named* destination from the venue name + full
street address, with a provider place ID when we have a verified one.

### Files

| File | Change |
|---|---|
| `src/data/places/places.json` | **New.** Generated from `scripts/place-ids.json`. One entry per venue title: `matchedName`, `address`, `googlePlaceId`, `applePlaceId`, `appleMatchStatus`, `appleVerifiedAt`. 43/47 have address + Google ID; 4 are null (see below). |
| `src/data/places/index.ts` | **New.** `getVenuePlace(title)` + `VenuePlace` / `AppleMatchStatus` types. Mirrors the `src/data/enrichment` module pattern (keyed by venue title). |
| `src/lib/directions.ts` | **Rewritten.** `directionsUrl(provider, target)` / `openDirections(provider, target)` now take a `DirectionsTarget` (`{ title, latitude, longitude }`) instead of bare coords, and build unified named URLs. |
| `src/components/DirectionsButton.tsx` | Props gained `title`; passes a `DirectionsTarget` to `openDirections`. |
| `src/components/VenuePreview.tsx`, `src/pages/VenueDetail.tsx` | Pass `title={venue.title}` to the button. |

### Why `src/data/places/` (not `scripts/place-ids.json` directly)

`scripts/` is outside the tsconfig `include: ["src"]`, so importing it into the
app is not clean. The established pattern is scripts → generated JSON that lives
in `src/data` (exactly how `scripts/enrich-venues.mjs` feeds
`src/data/enrichment/enrichment.json`). `places.json` is regenerated from
`scripts/place-ids.json`; Apple fields are then edited in place.

### URL formats produced

Walking mode (East Village is walkable). Fallback chain, safest first:

1. **name + address + place ID** — most precise.
2. **name + address** — address on file, no verified provider ID.
3. **raw lat/lng** — only when no address is on file. Unnamed pin, but never a
   wrong-business geocode match.

**Google (verified for all 43 with an address today):**
```
https://www.google.com/maps/dir/?api=1&destination=<name, address>&destination_place_id=<googleId>&travelmode=walking
```

**Apple (unified URL, iOS 18.4+ / macOS 15.4+):**
```
https://maps.apple.com/directions?destination=<name, address>&mode=walking
```
…and once an Apple ID is verified, `&destination-place-id=<appleId>` is added.

**Fallback (either provider, no address):**
```
.../directions?destination=<lat,lng>&mode=walking
```

### The 4 venues with no address (coordinate fallback)

Google's match failed for these (apostrophes / name mismatch), so they have no
address or place ID and navigate by coordinates until fixed:

- Paul's Cocktail Lounge
- Manitoba's
- The Bourgeois Pig
- Angel's Share

To fix: rerun / hand-correct the Google match in `scripts/place-ids.json`, then
regenerate `places.json`. They also need Apple lookups in the runbook below.

---

## Current behavior: Apple vs Google

- **Google:** fully named **today**. Tapping Google Maps for any of the 43
  venues opens the real business card via `destination_place_id`. The 4
  null-address venues fall back to coordinates.
- **Apple:** named by **name + address today** (big improvement over a dropped
  pin), but not yet pinned to a verified Apple listing. Apple's geocoder
  resolves the string at tap time — usually right, but this is the
  "nearby-but-wrong-business" risk the tracker warns about. It upgrades to an
  exact, verified match the moment `applePlaceId` + `appleMatchStatus:
  "verified"` are filled in — no code change needed.

---

## What Colton must still do — Apple Place ID runbook

Apple place IDs cannot be fetched programmatically (they need the Apple
Developer account or the manual Place ID Lookup tool). Do this once for the 47
venues; ~1–2 hours.

**Tool:** https://developer.apple.com/maps/place-id-lookup/ (free; may require
Apple ID sign-in).

**Data to record per venue in `src/data/places/places.json`:**
- `applePlaceId` — the ID string (e.g. `I521E602783BA9605`), or leave `null`.
- `appleMatchStatus` — one of:
  - `verified` — matched the correct listing, ID recorded.
  - `needs_review` — ambiguous / low-confidence. Leave `applePlaceId` null; it
    stays name+address (do NOT link a guessed ID).
  - `no_listing` — no Apple listing, or permanently closed. `applePlaceId` null.
  - `unverified` — not checked yet (the starting value).
- `appleVerifiedAt` — ISO date you verified, e.g. `"2026-07-20"`, else `null`.

### Steps

1. Open `src/data/places/places.json`. Work top to bottom; the venue title is
   the key. Use `matchedName` + `address` in each entry as your search target.
2. In the Place ID Lookup tool, search the venue name + address (or tap the
   exact building on the map). Confirm the pin is the **actual venue**, not a
   neighbor or a same-name business in another neighborhood.
3. Watch the known-ambiguous names — **Berlin, Lucky, The Library, Big Bar,
   Solas** — and venues inside larger buildings (e.g. PDT is inside Crif Dogs;
   Angel's Share is a hidden upstairs bar). Cross-check the address, not just
   the name.
4. Copy the Place ID. Set `applePlaceId`, `appleMatchStatus: "verified"`,
   `appleVerifiedAt: "<today>"`.
5. If you can't get a confident match, set `appleMatchStatus` to `needs_review`
   or `no_listing` and leave `applePlaceId: null`. It will safely keep using
   name + address. Never link a guessed ID.
6. Also handle the 4 null-address venues above — for these, first find the
   address in the tool, hand-add `address` (+ Apple ID) to their `places.json`
   entry so they stop falling back to coordinates.
7. Save. No code change is needed — `directions.ts` reads these fields at
   runtime and starts adding `destination-place-id` for every `verified` venue.

### Verify on a physical iPhone (iOS 18.4+)

The unified URL and place-ID behavior can only be trusted on a real device.

1. `npm run dev`, open the app on an iPhone on the same network (or a preview
   build).
2. Tap Directions → Apple Maps on a **verified** venue → confirm Apple Maps
   opens with the **venue name** as the destination (not a bare pin).
3. Repeat for an ambiguous name (Berlin / Lucky / The Library) → confirm it
   routes to the correct East Village location.
4. Test one `no_listing` / null-address venue → confirm it still opens
   directions (by address or coordinates) without erroring.
5. If you have a pre-18.4 device handy, tap Directions there too and note how it
   handles the `/directions` path (expected: opens web Apple Maps in Safari). If
   that UX is poor, the follow-up is a legacy `?daddr=` fallback with
   name+address — deferred until this test says it's needed.

---

## Later (approach C, when scaling)

At fall campus expansion (hundreds of venues) move Apple matching to the Maps
Server API ($99/yr Apple Developer Program, 25k free calls/day) for automated
matching + periodic re-verification (`appleVerifiedAt` cadence). The $99
account is needed anyway for the Capacitor / App Store step, and the
`places.json` schema built here (per-venue ID + status + verified date) feeds
that pipeline directly — no rework.
