# MapLibre + OpenFreeMap Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `mapbox-gl` with `maplibre-gl` + OpenFreeMap's dark style so the map renders with no token, no account, and no cost, and delete the entire Mapbox-token flow from the app.

**Architecture:** MapLibre is API-compatible with everything `src/components/Map.tsx` uses (`Map`, DOM-element `Marker`, `NavigationControl`, `flyTo`, `getBounds`, events), so Task 1 is a targeted rename + style-URL + prop-removal pass across `Map.tsx` and `MapPage.tsx` (they change together: removing `MapProps.accessToken` breaks the caller unless both move at once). Task 2 sweeps the dead token config out of Profile/config-store/env/docs.

**Tech Stack:** `maplibre-gl` ^5, OpenFreeMap tiles (`https://tiles.openfreemap.org/styles/dark`), React/Vite/TypeScript.

## Global Constraints

- Type-check command is `npx tsc --noEmit -p tsconfig.app.json`. Bare `npx tsc --noEmit` is a silent no-op in this repo (root tsconfig has `"files": []`) — never trust it.
- No test runner exists; verification is tsc + `npm run build` + live browser checks.
- OSM attribution is legally mandatory: the map must be created with `attributionControl: { compact: true }` — never `false`.
- What must NOT change (spec §3): pin colors/glyphs/pulse/hover, recenter/locate buttons, East Village center `[-73.9833, 40.7270]` zoom 15, viewport persistence, legend, drawer, filters; `MapProps` shrinks only by `accessToken`.
- After both tasks: `grep -rniI "mapbox" src/ .env.example README.md` must return zero matches.
- npm cache workaround if EACCES: append `--cache /private/tmp/claude-501/-Users-colton-lestorti/522064c6-5c08-483f-aa54-dbdee21aecb1/scratchpad/npm-cache`.

---

### Task 1: Swap the library and render the map unconditionally

**Files:**
- Modify: `package.json` (via npm uninstall/install)
- Modify: `src/components/Map.tsx:1-9,15-21,43-46,101,114-127,148-149,178`
- Modify: `src/pages/MapPage.tsx:1-28,149-206,211-212,275-293`

**Interfaces:**
- Produces: `MapProps` without `accessToken` (now `{ venues: Venue[]; selectedId?: string; onSelect?: (id: string) => void; onViewportChanged?: (bbox: BBox) => void }`); the map renders whenever it mounts. Task 2 does not consume anything from this task — it only removes config that nothing references after this task lands.

- [ ] **Step 1: Swap the dependency**

Run: `npm uninstall mapbox-gl && npm install maplibre-gl`
Expected: `mapbox-gl` gone from `package.json` dependencies, `maplibre-gl` present at `^5.x`.

- [ ] **Step 2: Convert `src/components/Map.tsx`**

Apply these exact replacements:

Lines 1-6 (header comment):

```tsx
/**
 * Mapbox GL map component with category-colored branded markers,
 * selected-marker pulse, legend, and viewport state preservation.
 *
 * MAPBOX_TOKEN: Set via Profile screen, MapPage inline input, or VITE_MAPBOX_TOKEN.
 */
```

becomes:

```tsx
/**
 * MapLibre GL map component with category-colored branded markers,
 * selected-marker pulse, legend, and viewport state preservation.
 *
 * Tiles come from OpenFreeMap (no key, no account). OSM attribution is
 * mandatory — the compact attribution control handles it; never disable it.
 */
```

Lines 8-9:

```tsx
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
```

becomes:

```tsx
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
```

Lines 15-21 (`MapProps`) — delete the `accessToken?: string;` line:

```tsx
export type MapProps = {
  venues: Venue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onViewportChanged?: (bbox: BBox) => void;
};
```

Line 43 (component signature):

```tsx
const Map: React.FC<MapProps> = ({ accessToken, venues, selectedId, onSelect, onViewportChanged }) => {
```

becomes:

```tsx
const Map: React.FC<MapProps> = ({ venues, selectedId, onSelect, onViewportChanged }) => {
```

Lines 45-46 (ref types):

```tsx
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
```

becomes:

```tsx
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
```

Line 101:

```tsx
      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
```

becomes:

```tsx
      const marker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
```

Lines 114-125 (map init effect):

```tsx
  useEffect(() => {
    if (!mapContainer.current || !accessToken) return;

    mapboxgl.accessToken = accessToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
      pitch: 0,
      attributionControl: false,
    });
```

becomes:

```tsx
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center,
      zoom,
      pitch: 0,
      attributionControl: { compact: true },
    });
```

Line 127:

```tsx
    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
```

becomes:

```tsx
    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
```

Lines 148-149 (effect dependency — token no longer exists):

```tsx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);
```

becomes:

```tsx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Line 178 — delete this line entirely:

```tsx
  if (!accessToken) return null;
```

- [ ] **Step 3: Convert `src/pages/MapPage.tsx`**

Lines 1-9 (header comment):

```tsx
/**
 * MapPage — investor-demo-ready East Village nightlife map.
 *
 * MAPBOX_TOKEN precedence: the VITE_MAPBOX_TOKEN env var (build-time,
 * what production deploys use) takes priority. If it's unset, falls back
 * to the token saved locally via the Profile tab or the inline setup card
 * on this page (useConfigStore) — this keeps local dev working without a
 * .env.local file, and keeps the manual-entry flow testable.
 */
```

becomes:

```tsx
/**
 * MapPage — investor-demo-ready East Village nightlife map.
 * Map tiles are free and keyless (MapLibre + OpenFreeMap), so the map
 * renders unconditionally — no token setup screen exists.
 */
```

Line 12 — delete (no longer used once NoTokenFallback and the token resolution go):

```tsx
import { useConfigStore } from "@/store/config";
```

Lines 21-24 (lucide imports) — remove `KeyRound` and `ExternalLink`:

```tsx
import {
  MapPin, List, X, MapIcon, Search, Bookmark,
  Navigation as NavigationIcon, Flame, Star, Sparkles
} from "lucide-react";
```

Line 27 — delete (only NoTokenFallback used `toast`):

```tsx
import { toast } from "sonner";
```

Lines 149-206 — delete the entire `NoTokenFallback` component, including its `/* ── No-token fallback ─────────────────────── */` banner comment.

Lines 211-212 — delete both token-resolution lines:

```tsx
  const { mapboxToken: storedMapboxToken } = useConfigStore();
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || storedMapboxToken;
```

Lines 275-293 (conditional render) — replace:

```tsx
      {view === "map" ? (
        <>
          {!mapboxToken ? (
            <NoTokenFallback onBrowseList={() => setView("list")} />
          ) : (
            <div className="w-full h-[calc(100vh-5rem)]">
              <Map
                accessToken={mapboxToken}
                venues={venues}
                selectedId={selected?.id}
                onSelect={(id) => {
                  const v = venues.find((x) => x.id === id) || null;
                  setSelected(v);
                }}
                onViewportChanged={(b) => setBbox(b)}
              />
            </div>
          )}
        </>
      ) : (
```

with:

```tsx
      {view === "map" ? (
        <div className="w-full h-[calc(100vh-5rem)]">
          <Map
            venues={venues}
            selectedId={selected?.id}
            onSelect={(id) => {
              const v = venues.find((x) => x.id === id) || null;
              setSelected(v);
            }}
            onViewportChanged={(b) => setBbox(b)}
          />
        </div>
      ) : (
```

Before moving on, confirm no other usage of the removed imports survives: `grep -n "useConfigStore\|toast\|KeyRound\|ExternalLink" src/pages/MapPage.tsx` — expected: zero matches. (`Input` and `Button` STAY — `TopHeader` uses `Input`, the list view's "Clear filters" uses `Button`.)

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the bundle no longer contains mapbox-gl.

- [ ] **Step 5: Live browser verification**

Run `npm run dev`, open `http://localhost:8080/` (clear `localStorage` key `endz-config` first to prove no token is needed).
Expected: dark map tiles render immediately — no "Unlock the live map" screen exists on any path; 19 venue pins around the East Village with category colors/glyphs; clicking a pin opens the venue drawer; compact attribution ⓘ visible in a corner (expanding it shows OpenStreetMap credit); "Recenter on East Village" button flies to St. Marks/Ave A.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/Map.tsx src/pages/MapPage.tsx
git commit -m "feat: swap mapbox-gl for maplibre-gl + OpenFreeMap, drop token requirement"
```

---

### Task 2: Sweep the dead Mapbox config out of Profile, store, env, and docs

**Files:**
- Modify: `src/pages/Profile.tsx:12-53`
- Modify: `src/store/config.ts:6,19`
- Modify: `src/vite-env.d.ts:4`
- Modify: `.env.example:1-4`
- Modify: `README.md:53-65`

**Interfaces:**
- Consumes: Task 1 must be complete (nothing may still read `mapboxToken` / `VITE_MAPBOX_TOKEN` — Task 1 removed the only readers).
- Produces: nothing — final task.

- [ ] **Step 1: Remove the Mapbox field from `src/pages/Profile.tsx`**

Line 12 (comment):

```tsx
/** Developer-only config (Mapbox token, API base URL, Supabase overrides). */
```

becomes:

```tsx
/** Developer-only config (API base URL, Supabase overrides). */
```

Line 14 — remove `mapboxToken` from the destructure:

```tsx
  const { apiBaseUrl, mapboxToken, supabaseUrl, supabaseAnonKey, setConfig } = useConfigStore();
```

becomes:

```tsx
  const { apiBaseUrl, supabaseUrl, supabaseAnonKey, setConfig } = useConfigStore();
```

Line 16 — delete:

```tsx
  const [token, setToken] = useState(mapboxToken ?? "");
```

In the `save` object — delete the line:

```tsx
      mapboxToken: token || undefined,
```

Delete the whole Mapbox field block (the `<div className="space-y-2">` containing the "Mapbox Public Token" label and its `Input`):

```tsx
        <div className="space-y-2">
          <label className="text-sm font-medium">Mapbox Public Token</label>
          <Input placeholder="pk.***" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
```

(The API Base URL, Supabase URL, and Supabase Publishable Key fields all stay.)

- [ ] **Step 2: Remove `mapboxToken` from `src/store/config.ts`**

Delete line 6 (`  mapboxToken?: string;`) from `AppConfig` and line 19 (`      mapboxToken: undefined,`) from the store defaults.

- [ ] **Step 3: Remove the env var declaration from `src/vite-env.d.ts`**

Delete line 4:

```ts
  readonly VITE_MAPBOX_TOKEN?: string;
```

(`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` stay.)

- [ ] **Step 4: Remove the Mapbox block from `.env.example`**

Delete lines 1-4:

```
# Mapbox public token (starts with "pk."). Get a free one at
# https://account.mapbox.com/access-tokens/ — free tier covers 50,000
# map loads/month, plenty for MVP/pitch use.
VITE_MAPBOX_TOKEN=pk.your_token_here
```

(The Supabase section stays; the file should start with the Supabase comment block afterward.)

- [ ] **Step 5: Rewrite the README Configuration section**

Replace lines 53-65 (the whole `## Configuration` body up to but not including `## What technologies are used for this project?`):

```markdown
## Configuration

The map needs no configuration — tiles come from [OpenFreeMap](https://openfreemap.org) via MapLibre GL (no API key, no account; attribution is shown automatically).

**Supabase (backend):**
1. Copy `.env.example` to `.env.local`
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project (Settings → Data API / API Keys)
3. Restart `npm run dev` (Vite only reads env files at server start)

Without Supabase configured, the app falls back to a built-in demo venue dataset.

**Production (Vercel):** set the two Supabase env vars in the Vercel project settings (Project → Settings → Environment Variables) before deploying.
```

- [ ] **Step 6: Verify nothing Mapbox remains, types pass, build passes**

Run: `grep -rniI "mapbox" src/ .env.example README.md`
Expected: zero matches.

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Live spot-check the Profile tab**

Run `npm run dev`, open `http://localhost:8080/profile`, expand "Developer settings".
Expected: exactly three fields — Public API Base URL, Supabase URL, Supabase Publishable Key — and Save still persists them.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Profile.tsx src/store/config.ts src/vite-env.d.ts .env.example README.md
git commit -m "chore: remove dead Mapbox token config from profile, store, env, and docs"
```
