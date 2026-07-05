# ENDZ — Replace Mapbox GL with MapLibre GL + OpenFreeMap

**Date:** 2026-07-05
**Status:** Approved
**Scope:** Swap the map rendering stack from `mapbox-gl` (token-gated, now requires a credit card on file) to `maplibre-gl` + OpenFreeMap tiles (no key, no account, no limits), and delete the entire Mapbox-token flow from the app.

---

## Context

Mapbox changed its activation policy: new accounts must put a credit card on file before any API/token works, even within the free tier. The user's account is deactivated pending a card — conflicting with the project's no-budget rule and adding an overage-billing risk. The map was the only thing in the stack still requiring a token/signup wall.

**Chosen replacement (user-approved):** MapLibre GL JS (the open-source fork of mapbox-gl — API-compatible for everything `src/components/Map.tsx` uses: `Map`, `Marker` with custom DOM elements, `NavigationControl`, `flyTo`, `getBounds`, event handlers) + **OpenFreeMap** tiles.

**OpenFreeMap verified (openfreemap.org, checked 2026-07-05):** styles Positron / Bright / Liberty / **Dark** / Fiord 3D; no registration, no API keys, no cookies; explicitly unlimited views/requests; commercial use permitted; donation-funded. Attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" is mandatory — MapLibre's attribution control handles it automatically.

## Design

### 1. Library swap — `src/components/Map.tsx`, `package.json`

- Remove dependency `mapbox-gl`; add `maplibre-gl`.
- `Map.tsx`: import `maplibre-gl` + `maplibre-gl/dist/maplibre-gl.css`; every `mapboxgl.` reference becomes `maplibregl.`.
- Style: `mapbox://styles/mapbox/dark-v11` → `https://tiles.openfreemap.org/styles/dark` (nightlife-appropriate dark basemap; Fiord 3D noted as the fallback aesthetic if Dark disappoints in practice).
- Delete the `accessToken` prop from `MapProps`, the `mapboxgl.accessToken = ...` assignment, and the `if (!accessToken) return null` guard — the map always renders.
- **License-compliance fix bundled in:** `attributionControl: false` becomes `attributionControl: { compact: true }` — OSM-derived tiles legally require visible attribution; the compact ⓘ control satisfies it without cluttering the nightlife UI.

### 2. Token flow removal

- `src/pages/MapPage.tsx`: delete the `NoTokenFallback` component and its conditional render (map renders unconditionally); delete the `mapboxToken`/`storedMapboxToken` resolution and the related header-comment paragraph; remove now-unused imports (e.g. `KeyRound`, `ExternalLink`).
- `src/pages/Profile.tsx`: remove the "Mapbox Public Token" field from Developer settings (other three fields stay).
- `src/store/config.ts`: remove the `mapboxToken` field from `AppConfig` and the store defaults. (Stale persisted values in users' localStorage are silently ignored by zustand — no migration needed.)
- `src/vite-env.d.ts`: remove `VITE_MAPBOX_TOKEN`.
- `.env.example`: remove the Mapbox section (Supabase section stays).
- `README.md`: replace the Mapbox part of the Configuration section with a one-liner that the map needs no configuration (MapLibre + OpenFreeMap, attribution auto-handled); keep the Supabase env var docs.

### 3. What deliberately does not change

- Pin design: category colors/glyphs, custom DOM markers, selected-pin pulse, hover scaling.
- Recenter/Locate buttons, East Village center coordinates and zoom, viewport persistence (`useMapViewStore`), legend, drawer, filters.
- The `venues`, `selectedId`, `onSelect`, `onViewportChanged` props — `MapProps` shrinks only by `accessToken`.

## Accepted trade-off

OpenFreeMap is a donation-run public service with no SLA. If its tiles are ever unreachable, the map canvas fails to load (list/discover views and all Supabase-backed features keep working). Acceptable at MVP scale; the style URL is a single line to swap to another provider (MapTiler, Stadia, self-hosted) if reliability ever becomes a problem.

## Verification approach

No test runner in the repo. `npx tsc --noEmit -p tsconfig.app.json` (bare `tsc --noEmit` is a silent no-op here), `npm run build`, `grep -rniI "mapbox" src/` must return zero matches, plus live browser checks: map renders dark tiles immediately with no token screen anywhere; 19 venue pins visible around the East Village with correct category colors; pin click opens the venue drawer; compact attribution ⓘ present; recenter button flies to St. Marks/Ave A; Profile Dev Settings shows exactly three fields.

## Out of scope

- Any change to venue data, auth, check-ins, or the Supabase layer
- Self-hosting tiles, offline tiles, or a provider-abstraction layer (YAGNI — one style-URL constant is the abstraction)
- Deleting the Mapbox account (user can; nothing in the app references it after this)
