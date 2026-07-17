# Live Location Dot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the user their own live, Google-Maps-style blue dot on the map — auto-appearing for already-granted users and following them as they move, with no permission prompt on load.

**Architecture:** Wire the browser Permissions API to detect an existing grant without prompting; reference-count the shared `watchPosition` in the location store so the dot coexists with out-tonight; upgrade the existing `placeUserDot` marker with a pulsing halo and drive it off live fixes in `Map.tsx`.

**Tech Stack:** React + TypeScript, Zustand store, MapLibre GL markers, browser Geolocation + Permissions APIs, Tailwind/CSS keyframes.

## Global Constraints

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- Build check with `npm run build`.
- **No test runner exists** in this project — verification is tsc + build + live browser (matches every prior ENDZ feature). Do NOT add a test framework.
- **Coords never leave the device** — no server calls, no DB, no schema. Unchanged privacy rule.
- **Never trigger a geolocation prompt on map load.** Only auto-act when permission is already `granted`.
- Zero API cost — browser geolocation + existing MapLibre map only. No new dependencies.
- Reuse the existing `endz-pulse` keyframe in `src/index.css:85` for the halo animation — do not invent a new one.
- Nothing merges, pushes, or touches Supabase without Colton's explicit OK.

---

### Task 1: Reference-counted shared watcher + no-prompt permission helper

**Files:**
- Modify: `src/store/location.ts` (`watch()`/`stopWatch()` at lines 53-75; add an exported helper)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `watch(): void` and `stopWatch(): void` — now reference-counted (unchanged signatures).
  - `geolocationPermission(): Promise<"granted" | "prompt" | "denied">` — exported module function; reads permission state WITHOUT prompting.

- [ ] **Step 1: Replace the single-flag watcher with a reference counter and add the permission helper**

In `src/store/location.ts`, change the module-level watcher state (currently `let watchId: number | null = null;` at line 24) to add a counter:

```ts
let watchId: number | null = null;
let watcherCount = 0;
```

Replace the `watch` and `stopWatch` implementations (lines 53-75) with reference-counted versions:

```ts
  watch: () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      set({ status: "unsupported" });
      return;
    }
    watcherCount += 1;
    if (watchId !== null) return; // already watching for an earlier caller
    set({ status: "prompting" });
    watchId = navigator.geolocation.watchPosition(
      (pos) => set({
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracy: pos.coords.accuracy,
        status: "granted",
      }),
      () => set({ status: "denied" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  },
  stopWatch: () => {
    if (watcherCount > 0) watcherCount -= 1;
    if (watcherCount > 0) return; // another caller still needs the stream
    if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  },
```

At the end of the file (after the closing `}));` of `useLocationStore`), add the exported helper:

```ts
/**
 * Read geolocation permission WITHOUT prompting. Returns "granted" | "prompt" |
 * "denied". Browsers lacking the Permissions API (older Safari) report "prompt"
 * so we simply don't auto-anything — the manual "Locate me" button still works.
 */
export async function geolocationPermission(): Promise<"granted" | "prompt" | "denied"> {
  if (
    typeof navigator === "undefined" ||
    !("permissions" in navigator) ||
    typeof navigator.permissions?.query !== "function"
  ) {
    return "prompt";
  }
  try {
    const res = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return res.state as "granted" | "prompt" | "denied";
  } catch {
    return "prompt";
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean (no output, exit 0).

- [ ] **Step 3: Confirm out-tonight stays balanced (regression reasoning)**

Run: `grep -n "\.watch()\|\.stopWatch()" src/store/outTonight.ts`
Expected: exactly one `watch()` (in the effect body) and one `stopWatch()` (in the effect cleanup) — one balanced pair. With ref-counting, out-tonight's effect re-running (deps change) does stopWatch→watch = count goes N→N-1→N, never reaching 0 while the live dot also holds a count, so neither feature kills the other. No code change needed here; this step is a verification, not an edit.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: builds cleanly, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/store/location.ts
git commit -m "$(cat <<'EOF'
feat(location): ref-counted watcher + no-prompt permission helper

watch()/stopWatch() now reference-count a single watchPosition so the
live-location dot can share the GPS stream with out-tonight without one
feature stopping the other. Add geolocationPermission() which reads
permission state via the Permissions API without ever prompting.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Live pulsing dot + auto-show + lifecycle in Map.tsx

**Files:**
- Modify: `src/components/Map.tsx` (import at line 14; `placeUserDot` at 324-341; add watcher plumbing between `placeUserDot` and `handleLocateMe`; update `handleLocateMe` at 343-354)

**Interfaces:**
- Consumes (from Task 1): `geolocationPermission()`, plus the existing `watch()`/`stopWatch()` and `subscribe`/`getState` on `useLocationStore`.
- Produces: no exported surface — internal component behavior only.

- [ ] **Step 1: Import the permission helper**

In `src/components/Map.tsx`, the store import is currently:

```ts
import { useLocationStore } from "@/store/location";
```

Change it to:

```ts
import { useLocationStore, geolocationPermission } from "@/store/location";
```

- [ ] **Step 2: Upgrade `placeUserDot` with a pulsing halo**

Replace the `placeUserDot` callback (lines 322-341) with a version that builds a two-layer marker (expanding pulse ring behind a solid core) and still re-positions on every fix:

```ts
  // Drops (or moves) a "you are here" dot: a solid blue core with a pulsing
  // halo (reuses the endz-pulse keyframe). Only setLngLat is touched on updates
  // so the follow path stays cheap; never set an inline position on the wrapper
  // (that would break MapLibre's anchoring).
  const placeUserDot = useCallback((lng: number, lat: number) => {
    if (!map.current) return;
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Your location");
      el.style.position = "relative";
      el.style.width = "18px";
      el.style.height = "18px";

      const pulse = document.createElement("div");
      pulse.setAttribute("aria-hidden", "true");
      pulse.style.position = "absolute";
      pulse.style.inset = "0";
      pulse.style.borderRadius = "9999px";
      pulse.style.background = "#3b82f6";
      pulse.style.animation = "endz-pulse 2s ease-out infinite";

      const core = document.createElement("div");
      core.style.position = "absolute";
      core.style.inset = "0";
      core.style.borderRadius = "9999px";
      core.style.background = "#3b82f6";
      core.style.border = "2px solid #ffffff";
      core.style.boxShadow = "0 0 0 1px rgba(59,130,246,0.35)";
      core.style.boxSizing = "border-box";

      el.appendChild(pulse);
      el.appendChild(core);
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }
  }, []);
```

- [ ] **Step 3: Add the shared watcher plumbing + auto-show effect**

Immediately AFTER the `placeUserDot` callback and BEFORE `handleLocateMe`, insert:

```ts
  // Live-follow plumbing. Both the auto-show (already-granted users) and the
  // "Locate me" button funnel through ensureWatching so there's exactly one
  // subscription and one ref-counted watch() to unwind.
  const watchingRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const ensureWatching = useCallback(() => {
    if (watchingRef.current) return;
    watchingRef.current = true;
    useLocationStore.getState().watch();
    unsubRef.current = useLocationStore.subscribe((s) => {
      if (s.coords) placeUserDot(s.coords.lng, s.coords.lat);
    });
  }, [placeUserDot]);

  const stopWatching = useCallback(() => {
    if (!watchingRef.current) return;
    watchingRef.current = false;
    unsubRef.current?.();
    unsubRef.current = null;
    useLocationStore.getState().stopWatch();
  }, []);

  // Auto-show the dot for users who already granted location (never prompts),
  // and pause tracking while the tab is hidden to save battery.
  useEffect(() => {
    geolocationPermission().then((state) => {
      if (state === "granted") ensureWatching();
    });
    const onVisibility = () => {
      if (document.hidden) {
        stopWatching();
      } else {
        geolocationPermission().then((state) => {
          if (state === "granted") ensureWatching();
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatching();
    };
  }, [ensureWatching, stopWatching]);
```

- [ ] **Step 4: Make the "Locate me" button start live-follow after a grant**

Replace `handleLocateMe` (lines 343-354) so a successful grant kicks off continuous follow:

```ts
  const handleLocateMe = useCallback(async () => {
    if (!map.current) return;
    const coords = await requestLocation();
    if (coords) {
      placeUserDot(coords.lng, coords.lat);
      map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 1500 });
      ensureWatching(); // follow from now on
      toast.success("Found your location");
    } else {
      toast.info("Location unavailable — showing East Village center");
      map.current.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
    }
  }, [requestLocation, placeUserDot, ensureWatching]);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean (exit 0). If it complains `useRef`/`useEffect`/`useCallback` unused-or-missing, confirm they're already imported at line 8 (`useCallback, useEffect, useRef` all are).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: builds cleanly, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/Map.tsx
git commit -m "$(cat <<'EOF'
feat(map): live user location dot (auto-show if granted, follows you)

Upgrade placeUserDot to a pulsing Google-Maps-style dot and drive it off
live watchPosition fixes. Auto-show for users who already granted location
(Permissions API, no prompt on load); the Locate-me button now starts
live-follow after a grant. Tracking pauses while the tab is hidden. Shares
the ref-counted watcher with out-tonight.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: End-to-end browser verification (simulated geolocation)

**Files:** none (verification only).

This exercises the whole feature and the out-tonight coexistence. Runnable without sign-in — the dot is not auth-gated. Use the Chrome DevTools MCP with a geolocation override.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Note the local URL (Vite default `http://localhost:8080` per this project's config).

- [ ] **Step 2: Verify NO prompt + no dot when permission is not granted**

With geolocation permission unset/denied for the origin, load the map page. Expected: no permission prompt fires on load; no user dot appears. The "Locate me" button is still present.

- [ ] **Step 3: Verify auto-show when already granted**

Grant geolocation for the origin and set a fixed override (e.g. East Village `40.7270, -73.9833`). Reload the map. Expected: the blue pulsing dot appears on load with NO prompt, centered on the override coords.

- [ ] **Step 4: Verify live-follow**

Change the geolocation override to a nearby coordinate (e.g. nudge lat/lng a few hundred meters). Expected: the dot moves to the new position without reload (watchPosition fix → `setLngLat`).

- [ ] **Step 5: Verify the button path**

In a not-yet-granted state, tap "Locate me", grant when prompted. Expected: dot appears, map flies to it, toast "Found your location", and a subsequent override change moves the dot (follow started).

- [ ] **Step 6: Verify out-tonight coexistence**

With the dot live, toggle "I'm out tonight" on, then off. Expected: the location dot keeps updating the entire time (ref-count never hits 0 while the dot holds its count). Toggle the dot's tab hidden/visible and confirm out-tonight, if on, still receives fixes.

- [ ] **Step 7: Verify battery pause**

Switch the browser tab away (hidden) and back. Expected: while hidden, the watcher stops (no new fixes processed); on return with permission still granted, tracking resumes.

- [ ] **Step 8: Stop the dev server.**

## Notes for the human reviewer (Colton)

- Nothing here is merged or pushed. It lives on `feat/live-location-dot`.
- No Supabase, no DB, no network — pure client. Coords never leave the device.
- MVP halo is fixed-size + pulse. A true accuracy-radius halo (sized to GPS
  accuracy, redrawn on zoom) is a deferred cheap follow-up, per the spec.
