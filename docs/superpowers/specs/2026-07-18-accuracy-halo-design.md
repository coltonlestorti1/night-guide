# Accuracy Halo for the Location Dot — Design Spec (item 9 follow-up)

**Date:** 2026-07-18
**Status:** Approved (design) — pending spec review, then implementation plan
**Parent:** `2026-07-17-live-location-dot-design.md` (the deferred MVP piece)

## Goal

Draw a translucent circle around the user's location dot sized to the fix's
reported accuracy radius in real meters, so a coarse fix (laptop WiFi/IP,
often a block+ off) reads as "approximate" instead of "wrong." Google-Maps-style.

Motivation: Colton saw a desktop dot land a block off (2026-07-17). Browser
geolocation on laptops is WiFi/IP-triangulated — inherently coarse; phone GPS
is tight. Not a bug, but without a halo it *looks* like one.

## Current behavior (audited 2026-07-18)

- `store/location.ts` already captures `accuracy` (meters) on every
  `watchPosition` fix — but **only** `watch()` sets it; `request()`
  (`getCurrentPosition`, the "Locate me" path) does not.
- `Map.tsx`'s subscribe callback reads only `s.coords`; `accuracy` is ignored
  everywhere. No halo exists — the dot's soft ring is a fixed-px CSS pulse,
  not sized to anything real.
- The dot is a DOM marker (`maplibregl.Marker`), which cannot cheaply scale
  with zoom; a real-meters halo must live in the map canvas.

## Behavior after this change

1. Whenever the dot is showing and the latest fix has an accuracy value, a
   faint translucent circle renders under the dot at that radius in meters.
   It scales with zoom and moves with each fix, exactly like the dot.
2. **Always-on** (Colton's call, 2026-07-18): no visibility threshold, no
   radius cap. A tight phone GPS fix (~5–15 m) hides the halo under the dot
   naturally; a terrible IP fix honestly draws a big faint disc. The fill is
   faint enough (~10% opacity) that even a huge halo can't swamp the map.
3. Halo clears whenever the dot's watcher stops (tab hidden, map unmount) and
   whenever there's no accuracy value.

## Design

### Rendering — GeoJSON circle polygon + fill layer (approach A, approved)

- One GeoJSON source (e.g. `user-accuracy`) + one `fill` layer on the map,
  created lazily on first use (map style is fixed OpenFreeMap dark — no style
  reload ever wipes it).
- On each fix with `accuracy != null`: generate a ~64-vertex circle polygon
  from `{lng, lat, accuracy}` (simple spherical offset; longitude degrees
  divided by `cos(lat)`) and `source.setData(...)`. No Turf dependency.
- Paint: brand blue `#3b82f6`, `fill-opacity` ≈ 0.10, hairline
  `fill-outline-color` at ≈ 0.25 alpha. Canvas layers always render beneath
  DOM markers, so the dot + pulse stay on top for free.
- Clearing = `setData` with an empty FeatureCollection (layer stays).

Rejected: MapLibre `circle` layer with zoom-interpolated pixel radius
(approximate between stops, per-latitude expression rework each fix); DOM
resize on zoom events (lags zoom animation).

### Wiring (`Map.tsx`)

- The existing store subscription in `ensureWatching` reads `s.accuracy`
  alongside `s.coords` and updates the halo with the dot.
- The initial paint-from-existing-fix path also paints the halo.
- `stopWatching` clears the halo (alongside its existing teardown).
- `handleLocateMe` paints the halo with its first fix, same as the dot.

### Store (`store/location.ts`)

- One-line fix: `request()` records `pos.coords.accuracy` so the first
  "Locate me" paint has a halo immediately instead of waiting for the
  watcher's first fix.

## Files touched

- `src/components/Map.tsx` — halo source/layer creation, update-on-fix,
  clear-on-stop.
- `src/store/location.ts` — `request()` sets `accuracy`.

No DB, no schema, no new dependencies, zero API cost. Coords + accuracy never
leave the device (unchanged rule).

## Out of scope

- Any threshold/cap logic (explicitly rejected — always-on).
- Friend dots, heat map, or any other layer work.
- Changing the dot/pulse styling itself.

## Acceptance criteria

- [ ] With a mocked coarse fix (e.g. accuracy 500 m), a faint blue disc renders
      under the dot at the right geographic size (spans ~5 short EV blocks) and
      scales correctly when zooming in/out.
- [ ] With a mocked tight fix (accuracy 15 m), the halo is effectively hidden
      under the dot at neighborhood zoom.
- [ ] Halo follows the dot on position/accuracy changes.
- [ ] Halo clears when the watcher stops (hide tab / navigate away) and
      reappears on resume.
- [ ] "Locate me" first paint includes the halo (request() accuracy fix).
- [ ] `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` clean.
- [ ] Live-verified in browser with mocked geolocation (no sign-in needed).
