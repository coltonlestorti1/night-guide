# Accuracy Halo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw a translucent circle under the user's location dot sized to the fix's reported accuracy radius in real meters, so coarse fixes read as "approximate" instead of "wrong."

**Architecture:** A pure helper generates a ~64-vertex GeoJSON circle polygon from `{lng, lat, accuracy}`; `Map.tsx` lazily creates one GeoJSON source + `fill` layer and pushes the polygon into it on every fix, clearing it whenever the dot's watcher stops. A ref buffers the latest halo so a fix arriving before the map style loads still paints on `load`.

**Tech Stack:** React + TypeScript, Zustand store, MapLibre GL GeoJSON source/fill layer, browser Geolocation API.

## Global Constraints

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- Build check with `npm run build`.
- **No test runner exists** in this project — verification is tsc + build + live browser (matches every prior ENDZ feature). Do NOT add a test framework.
- **Coords + accuracy never leave the device** — no server calls, no DB, no schema.
- **Always-on, no threshold, no radius cap** (Colton's call, 2026-07-18). Faintness is the safety valve: `fill-opacity` 0.10.
- Halo paint: brand blue `#3b82f6`, `fill-opacity` 0.10, `fill-outline-color` `rgba(59,130,246,0.25)`.
- No new dependencies (no Turf — the circle math is ~15 lines).
- Never trigger a geolocation prompt on map load (unchanged from item 8).
- Work on branch `feat/accuracy-halo`; nothing merges or pushes without Colton's explicit OK.

---

### Task 1: `request()` records accuracy + circle-polygon helper

**Files:**
- Modify: `src/store/location.ts:40-51` (the `getCurrentPosition` success callback)
- Create: `src/lib/geo.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `useLocationStore.getState().accuracy` is now set by `request()` as well as `watch()` (state shape unchanged — `accuracy: number | null` already exists).
  - `circlePolygon(lng: number, lat: number, radiusM: number): Feature<Polygon>` — exported from `src/lib/geo.ts`; geographic circle as a GeoJSON Feature, 64 segments.
  - `EMPTY_FC: FeatureCollection` — exported from `src/lib/geo.ts`; the empty collection used to clear the halo source.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/accuracy-halo
```

- [ ] **Step 2: Record accuracy in `request()`**

In `src/store/location.ts`, the `getCurrentPosition` success callback currently reads:

```ts
        (pos) => {
          const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          set({ coords: c, status: "granted" });
          resolve(c);
        },
```

Change the `set` call to also record accuracy:

```ts
        (pos) => {
          const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          set({ coords: c, accuracy: pos.coords.accuracy, status: "granted" });
          resolve(c);
        },
```

- [ ] **Step 3: Create `src/lib/geo.ts`**

```ts
import type { Feature, FeatureCollection, Polygon } from "geojson";

/** Empty collection used to clear GeoJSON sources (e.g. hide the accuracy halo). */
export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Geographic circle around [lng, lat] with radius in meters, as a GeoJSON
 * polygon (64 segments). Spherical-earth approximation — plenty for an
 * accuracy halo; longitude degrees shrink with cos(lat).
 */
export function circlePolygon(lng: number, lat: number, radiusM: number): Feature<Polygon> {
  const SEGMENTS = 64;
  const latRadius = radiusM / 111320;
  const lngRadius = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * 2 * Math.PI;
    ring.push([lng + lngRadius * Math.cos(theta), lat + latRadius * Math.sin(theta)]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
```

(`geojson` types ship with maplibre-gl's dependency tree — no new package.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean (no output, exit 0).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: builds cleanly, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/store/location.ts src/lib/geo.ts
git commit -m "feat(location): record accuracy on request(); add circlePolygon geo helper"
```

---

### Task 2: Halo source/layer + wiring in `Map.tsx`

**Files:**
- Modify: `src/components/Map.tsx` (dot/watcher block, currently lines ~322-436: `placeUserDot`, `ensureWatching`, `stopWatching`, map-init `on("load")` at line 292, `handleLocateMe`)

**Interfaces:**
- Consumes: `circlePolygon(lng, lat, radiusM)` and `EMPTY_FC` from `src/lib/geo.ts` (Task 1); existing `useLocationStore` state `{ coords, accuracy }`.
- Produces: no new exports — `Map.tsx` internals only. Internal callbacks: `updateHalo(lng: number, lat: number, accuracy: number | null): void` and `flushHalo(): void`.

- [ ] **Step 1: Add imports and halo refs**

Add to the imports in `src/components/Map.tsx`:

```ts
import { circlePolygon, EMPTY_FC } from "@/lib/geo";
```

(Match the repo's existing `@/` alias style used by neighboring imports; if `Map.tsx` imports from the store as `@/store/location`, mirror that.)

Next to `userMarkerRef` (line 133), add a buffer ref for fixes that arrive before the map style has loaded:

```ts
  const pendingHaloRef = useRef<{ lng: number; lat: number; accuracy: number } | null>(null);
```

- [ ] **Step 2: Add the halo update/flush callbacks**

Directly above `placeUserDot` (line 326), add:

```ts
  // Accuracy halo: one GeoJSON source + fill layer, sized in real meters so it
  // scales with zoom (the DOM marker can't). Always-on, no cap — a coarse
  // WiFi/IP fix honestly draws a big faint disc; a tight GPS fix hides under
  // the dot. Canvas layers render below DOM markers, so the dot stays on top.
  const HALO_ID = "user-accuracy";

  const updateHalo = useCallback((lng: number, lat: number, accuracy: number | null) => {
    const m = map.current;
    if (!m) return;
    if (accuracy == null) {
      pendingHaloRef.current = null;
      (m.getSource(HALO_ID) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
      return;
    }
    if (!m.isStyleLoaded() && !m.getSource(HALO_ID)) {
      // Style not ready — remember the fix; the map's load handler flushes it.
      pendingHaloRef.current = { lng, lat, accuracy };
      return;
    }
    if (!m.getSource(HALO_ID)) {
      m.addSource(HALO_ID, { type: "geojson", data: EMPTY_FC });
      m.addLayer({
        id: HALO_ID,
        type: "fill",
        source: HALO_ID,
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.1,
          "fill-outline-color": "rgba(59,130,246,0.25)",
        },
      });
    }
    (m.getSource(HALO_ID) as maplibregl.GeoJSONSource).setData(circlePolygon(lng, lat, accuracy));
  }, []);

  const flushHalo = useCallback(() => {
    const pending = pendingHaloRef.current;
    if (pending) {
      pendingHaloRef.current = null;
      updateHalo(pending.lng, pending.lat, pending.accuracy);
    }
  }, [updateHalo]);
```

- [ ] **Step 3: Flush pending halo on map load**

In the map-init effect's load handler (line 292):

```ts
    map.current.on("load", () => {
      addMarkers();
      onMoveEnd();
    });
```

add the flush:

```ts
    map.current.on("load", () => {
      addMarkers();
      onMoveEnd();
      flushHalo();
    });
```

The map-init effect intentionally has an empty dep array with an eslint-disable — leave that as is; `flushHalo` is stable (its only dep chain is refs + `updateHalo`, which has `[]` deps).

- [ ] **Step 4: Drive the halo from the watcher subscription**

In `ensureWatching`, the subscription and initial paint currently read:

```ts
    unsubRef.current = useLocationStore.subscribe((s) => {
      if (s.coords) placeUserDot(s.coords.lng, s.coords.lat);
    });
    // If a fix already exists (out-tonight's watcher is already running, or the
    // first fix landed before we subscribed), paint it now — subscribe only
    // fires on *subsequent* changes.
    const existing = useLocationStore.getState().coords;
    if (existing) placeUserDot(existing.lng, existing.lat);
```

Change both paths to also paint the halo:

```ts
    unsubRef.current = useLocationStore.subscribe((s) => {
      if (s.coords) {
        placeUserDot(s.coords.lng, s.coords.lat);
        updateHalo(s.coords.lng, s.coords.lat, s.accuracy);
      }
    });
    // If a fix already exists (out-tonight's watcher is already running, or the
    // first fix landed before we subscribed), paint it now — subscribe only
    // fires on *subsequent* changes.
    const { coords: existing, accuracy: existingAccuracy } = useLocationStore.getState();
    if (existing) {
      placeUserDot(existing.lng, existing.lat);
      updateHalo(existing.lng, existing.lat, existingAccuracy);
    }
```

Add `updateHalo` to `ensureWatching`'s dependency array: `[placeUserDot, updateHalo]`.

- [ ] **Step 5: Clear the halo when the watcher stops**

In `stopWatching`, after `useLocationStore.getState().stopWatch();`, add:

```ts
    pendingHaloRef.current = null;
    (map.current?.getSource(HALO_ID) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
```

`stopWatching`'s dependency array stays `[]` (it touches only refs and the store).

- [ ] **Step 6: Paint the halo on the "Locate me" first fix**

In `handleLocateMe`, the success branch currently starts:

```ts
    if (coords) {
      placeUserDot(coords.lng, coords.lat);
```

Add the halo right after the dot (accuracy comes from the store — Task 1 made `request()` record it):

```ts
    if (coords) {
      placeUserDot(coords.lng, coords.lat);
      updateHalo(coords.lng, coords.lat, useLocationStore.getState().accuracy);
```

Add `updateHalo` to `handleLocateMe`'s dependency array: `[requestLocation, placeUserDot, ensureWatching, updateHalo]`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean (no output, exit 0).

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: builds cleanly, exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/components/Map.tsx
git commit -m "feat(map): accuracy halo under the location dot (real-meters fill layer)"
```

---

### Task 3: Live browser verification (mocked geolocation)

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: the running app (`npm run dev`, http://localhost:8080) + everything above.
- Produces: verified acceptance criteria; screenshots for Colton.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Expected: Vite serves on http://localhost:8080.

- [ ] **Step 2: Open the app with mocked granted permission + coarse fix**

Use Chrome DevTools MCP. Before the app loads (evaluate on a fresh page via an init script, or reload after installing the mock), override geolocation so no real prompt fires:

```js
// Mock: permission already granted, watchPosition delivers a coarse EV fix.
Object.defineProperty(navigator, "permissions", {
  value: { query: async () => ({ state: "granted" }) },
});
const fix = (lat, lng, accuracy) => ({
  coords: { latitude: lat, longitude: lng, accuracy },
  timestamp: Date.now(),
});
let watchCb = null;
navigator.geolocation.watchPosition = (ok) => {
  watchCb = ok;
  setTimeout(() => ok(fix(40.727, -73.9833, 500)), 200);
  return 1;
};
navigator.geolocation.clearWatch = () => { watchCb = null; };
window.__sendFix = (lat, lng, acc) => watchCb && watchCb(fix(lat, lng, acc));
```

Note: mocks installed via `evaluate_script` don't survive a reload — install, then trigger the map (navigate client-side or install before the map mounts).

- [ ] **Step 3: Verify the coarse halo**

Expected: blue dot at Tompkins Square area with a faint blue disc under it. At zoom 15 a 500 m radius spans well beyond the surrounding blocks. Zoom in/out: the disc scales geographically (covers the same streets, not the same pixels). Screenshot.

- [ ] **Step 4: Verify a tight fix hides the halo**

Run: `window.__sendFix(40.727, -73.9833, 15)`
Expected: disc shrinks to roughly the dot's own footprint at neighborhood zoom — visually gone. Screenshot.

- [ ] **Step 5: Verify follow + clear-on-stop**

Run: `window.__sendFix(40.7295, -73.9856, 300)` → dot AND halo move together.
Then simulate tab hide (`document.dispatchEvent` won't flip `document.hidden`; instead call the page-level check by switching tabs via DevTools or temporarily asserting via code review that `stopWatching` runs `setData(EMPTY_FC)`) — at minimum, verify by navigating to another bottom-nav tab and back: halo clears on unmount and repaints on return.

- [ ] **Step 6: Verify no-prompt rule intact**

Reload with the permission mock returning `{ state: "prompt" }` and geolocation functions instrumented to throw if called. Expected: no dot, no halo, no geolocation call on load.

- [ ] **Step 7: Report**

Report pass/fail per acceptance criterion (spec `2026-07-18-accuracy-halo-design.md`) with screenshots. Do NOT merge or push — Colton's call.
