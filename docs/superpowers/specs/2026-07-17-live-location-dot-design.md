# Live Location Dot — Design Spec (tracker items 9 + 8)

**Date:** 2026-07-17
**Status:** Approved (design) — pending spec review, then implementation plan
**Branch:** `feat/live-location-dot`

## Goal

Show the user their own location as a live, Google-Maps-style blue dot on the
map — one that appears automatically for users who've already granted location,
and follows them as they move. No new permission prompt on load. Ever.

Scope is **your own dot only.** Snap-Map-style friend dots (broadcasting live
location to friends) is explicitly a separate, later feature with its own gate.

## Current behavior (audited 2026-07-17)

- `Map.tsx:324 placeUserDot()` draws a static blue dot (18px, white ring, soft
  static halo). It never pulses and never re-positions once dropped.
- The dot only appears when the user taps the "Locate me" button
  (`handleLocateMe`, Navigation icon). Nothing happens on map load.
- The other bottom-right button (`LocateFixed`) is "recenter on East Village" —
  it does not use the user's location.
- No `watchPosition` runs on the map. `store/location.ts` exposes
  `watch()`/`stopWatch()`, but only the out-tonight feature uses them.
- **Gap:** nothing checks whether geolocation permission is *already granted*.
  The Permissions API (`navigator.permissions.query`), which reports `granted`
  **without** firing a prompt, is not wired anywhere. This is the linchpin for
  auto-showing the dot without a rogue prompt.

## Behavior after this change

1. **Already-granted user opens the map** → blue dot appears immediately and
   follows them as they move. No prompt.
2. **Not-yet-granted user opens the map** → nothing auto-happens. No prompt on
   load. The "Locate me" button still works; granting through it starts the
   live dot for the rest of the session.
3. **Denied** → graceful. Button-triggered deny keeps the existing
   "Location unavailable — showing East Village center" toast. No nagging.
4. **Leaving the map** (tab hidden or navigating away) → tracking stops to save
   battery. Returning → resumes (auto if still granted).

## Design

### Permission state (item 8)

- Add a helper to `store/location.ts` that reads permission state without
  prompting: `navigator.permissions.query({ name: 'geolocation' })` →
  `'granted' | 'prompt' | 'denied'`. Guard for browsers without the Permissions
  API (older Safari) — treat a missing API as `'prompt'` (i.e. do nothing on
  load, button still works).
- On map mount, only `'granted'` triggers auto-show + watch. `'prompt'` and
  `'denied'` do nothing automatically.

### Shared watcher — reference counting (the one plumbing change)

`store/location.ts` has a single `watchId`. Out-tonight already calls
`watch()`/`stopWatch()` on it (`outTonight.ts:105,111`). If the live dot also
drives that watcher, whichever feature stops *last* would call `stopWatch()` and
kill the other's tracking.

Fix: **reference-count** the watcher. Track an internal `watcherCount`.
`watch()` increments and only starts a real `watchPosition` on the 0→1
transition; `stopWatch()` decrements and only calls `clearWatch` on the 1→0
transition. Both features share one GPS stream — one prompt, one battery draw,
no stomping. `watch()` stays idempotent per caller only if each caller pairs
exactly one `watch()` with one `stopWatch()` (the existing out-tonight effect
already does; the new live-dot effect will too).

### Live dot rendering (item 9)

- Reuse and upgrade `placeUserDot`. Keep the blue dot + white ring. Add a
  **gentle CSS pulse** on the soft halo (Google/Snap feel).
- The dot re-positions on every fix via `userMarkerRef.current.setLngLat(...)`
  (already supported).
- **MVP halo = fixed size + pulse.** A true accuracy-radius halo (sized to the
  GPS accuracy in meters, redrawn on zoom) is deferred as a cheap follow-up.
- Do **not** auto-`flyTo` on the silent auto-show — dropping the dot is enough;
  yanking the viewport on load would be jarring. The "Locate me" button keeps
  its existing `flyTo` (explicit user intent).

### Map lifecycle wiring (`Map.tsx`)

- On mount: query permission. If `granted`, call `watch()` and subscribe to the
  location store; each fix updates the dot position. On unmount: unsubscribe and
  `stopWatch()`.
- Pause on tab-hidden via `document.visibilitychange` (stop the watch when
  hidden, resume when visible + still granted) to respect battery.
- Button path (`handleLocateMe`) unchanged in intent, but after a successful
  grant it should also start the live watcher so the dot follows from then on.

## Files touched

- `src/store/location.ts` — reference-counted `watch()`/`stopWatch()`; add a
  `permissionState()` helper (no prompt).
- `src/components/Map.tsx` — mount-time permission check + auto-show + watcher
  subscription + visibility pause; pulse styling on the dot; button starts watch
  on grant.

No DB, no schema, no new dependencies, **zero API cost** (browser geolocation +
existing MapLibre map).

## Out of scope

- Snap-Map-style friend location dots (separate feature, separate gate).
- Native background location (PWA can't; Phase 2 / Capacitor).
- True accuracy-radius halo sizing (cheap follow-up if wanted).
- Any server-side location — coords never leave the device (unchanged rule).

## Acceptance criteria

- [ ] Granted user: dot appears on map load and follows movement, **no prompt**.
- [ ] Not-granted user: **no prompt on load**; "Locate me" button still works and
      starts the live dot after granting.
- [ ] Denied: graceful, existing toast, no nagging.
- [ ] Out-tonight + live-dot both active at once → both keep working (ref-count
      verified: turning one off doesn't kill the other's tracking).
- [ ] Tracking stops when the map tab is hidden / user navigates away.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` clean.
- [ ] Live-verified in browser with geolocation simulated (moving fix → dot
      follows). Verifiable without sign-in (dot is not auth-gated).
