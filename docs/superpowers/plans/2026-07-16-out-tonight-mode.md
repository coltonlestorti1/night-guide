# "I'm Out Tonight" Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a PWA-foreground "I'm out tonight" mode that silently logs detected venue presence to our metrics and offers a one-tap "you're at {venue} — check in?" prompt.

**Architecture:** A pure proximity detector (`lib/venueProximity.ts`) ranks venues by distance and decides when we're confidently at one. The location store gains a continuous `watchPosition` mode. An orchestrator store (`store/outTonight.ts`) consumes location fixes, logs presence to the existing `events` table, and raises a check-in prompt. UI on the Map screen toggles the mode (behind an opt-in disclosure) and renders the prompt, reusing the existing `checkIn` action.

**Tech Stack:** React + TypeScript, Zustand stores, Supabase (`events` + `check_ins` tables — no schema changes), Vite, Tailwind, shadcn/ui, sonner, lucide.

## Global Constraints

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op). `npm run build` must stay clean.
- **No test runner exists.** Verify via tsc + build + Vite dev server + Chrome DevTools geolocation override. Pure functions are checked in the browser console via `await import('/src/lib/...')` against the running dev server.
- **No DDL / no Supabase schema change.** All new data rides the existing generic `events` table (`event_name` + `venue_id` + `props`). Do not add tables or columns.
- **Location coords never persist to a server.** Only a resolved `venue_id` + coarse buckets go to `events`. Raw lat/lng stays in-memory (client-only), same as today.
- **Opt-in disclosure is mandatory copy, not optional.** Enabling the mode the first time MUST show: *"Out tonight lets ENDZ see which venues you visit tonight to understand where people go — never shown to your friends. Turn it off anytime."*
- Detection thresholds are named constants, tuned on-device later: `ARRIVAL_RADIUS_M = 60`, `ACCURACY_CEILING_M = 40`, `RUNNER_UP_MARGIN_M = 25`, `CONFIRM_FIXES = 2`.
- Branch: `feat/out-tonight-mode` (already created). Do NOT merge, push, or touch Supabase. Small commits per task.
- Nothing here changes the existing check-in loop's behavior; the prompt reuses `checkIn()` unchanged.

---

## File Structure

- **Modify** `src/lib/distance.ts` — add `haversineMeters` (reuses `haversineMiles`).
- **Create** `src/lib/venueProximity.ts` — pure detector: `rankNearby`, `pickConfident`, thresholds.
- **Modify** `src/store/location.ts` — add `accuracy`, `watch()`, `stopWatch()`.
- **Create** `src/store/outTonight.ts` — mode state + `processFix` reducer + `useOutTonightWatcher` hook.
- **Create** `src/components/OutTonightToggle.tsx` — the "I'm out tonight" control + opt-in disclosure dialog.
- **Create** `src/components/OutTonightPrompt.tsx` — the "you're at {venue} — check in?" prompt.
- **Modify** `src/pages/MapPage.tsx` — mount the toggle, the prompt, and `useOutTonightWatcher(venues)`.
- **Modify** `docs/plans/2026-07-15-privacy-terms-DRAFT.md` — disclose venue-presence logging.

---

### Task 1: Meters helper + pure proximity detector

**Files:**
- Modify: `src/lib/distance.ts`
- Create: `src/lib/venueProximity.ts`

**Interfaces:**
- Consumes: `haversineMiles(a: Coords, b: {lat:number;lng:number})` from `src/lib/distance.ts`; `Venue` from `src/data/types.ts`; `Coords` from `src/store/location.ts`.
- Produces: `rankNearby(coords: Coords, venues: Venue[]): NearbyVenue[]`; `pickConfident(ranked: NearbyVenue[], accuracyM: number): Venue | null`; `type NearbyVenue = { venue: Venue; distanceM: number }`; constants `ARRIVAL_RADIUS_M`, `ACCURACY_CEILING_M`, `RUNNER_UP_MARGIN_M`.

- [ ] **Step 1: Add `haversineMeters` to `src/lib/distance.ts`** (append after `haversineMiles`):

```ts
const MILES_TO_METERS = 1609.344;

/** Great-circle distance in meters. */
export function haversineMeters(a: Coords, b: { lat: number; lng: number }): number {
  return haversineMiles(a, b) * MILES_TO_METERS;
}
```

- [ ] **Step 2: Create `src/lib/venueProximity.ts`:**

```ts
/**
 * Pure venue-proximity detection for "I'm out tonight" mode. No React, no I/O.
 * `rankNearby` sorts venues by distance; `pickConfident` decides whether we're
 * confidently AT the nearest one, guarding against dense-block ambiguity and
 * low GPS accuracy. Thresholds are exported for on-device tuning.
 */
import { haversineMeters } from "@/lib/distance";
import type { Venue } from "@/data/types";
import type { Coords } from "@/store/location";

/** How close (m) to a venue before we call it "you're here". ~half a block. */
export const ARRIVAL_RADIUS_M = 60;
/** Reject fixes blurrier than this (m) — can't tell which bar. */
export const ACCURACY_CEILING_M = 40;
/** Nearest must beat the runner-up by this margin (m) or it's ambiguous. */
export const RUNNER_UP_MARGIN_M = 25;

export type NearbyVenue = { venue: Venue; distanceM: number };

/** All venues sorted nearest-first, with meter distances. */
export function rankNearby(coords: Coords, venues: Venue[]): NearbyVenue[] {
  return venues
    .map((venue) => ({
      venue,
      distanceM: haversineMeters(coords, { lat: venue.latitude, lng: venue.longitude }),
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * The venue we're confidently at, or null. Requires: accuracy within ceiling,
 * nearest within arrival radius, and nearest clearly closer than the runner-up.
 */
export function pickConfident(ranked: NearbyVenue[], accuracyM: number): Venue | null {
  if (accuracyM > ACCURACY_CEILING_M) return null;
  const nearest = ranked[0];
  if (!nearest || nearest.distanceM > ARRIVAL_RADIUS_M) return null;
  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.distanceM - nearest.distanceM < RUNNER_UP_MARGIN_M) return null;
  return nearest.venue;
}
```

- [ ] **Step 3: Typecheck.**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no errors.

- [ ] **Step 4: Verify the detector in the browser console** (pure-function check — no test runner in repo).

Start the dev server (`npm run dev`), open the app, then in DevTools console:

```js
const { rankNearby, pickConfident } = await import('/src/lib/venueProximity.ts');
const grafton = { id: 'g', title: 'The Grafton', latitude: 40.7265, longitude: -73.9815, serves_alcohol: true, category: 'bar' };
const other   = { id: 'o', title: 'Other Bar',   latitude: 40.7280, longitude: -73.9830, serves_alcohol: true, category: 'bar' };
const venues = [grafton, other];
// At Grafton, sharp fix -> confident Grafton
console.assert(pickConfident(rankNearby({lat:40.7265,lng:-73.9815}, venues), 15)?.title === 'The Grafton', 'A: at-venue');
// Blurry fix -> null
console.assert(pickConfident(rankNearby({lat:40.7265,lng:-73.9815}, venues), 80) === null, 'B: low-accuracy');
// Far away -> null
console.assert(pickConfident(rankNearby({lat:40.7500,lng:-73.9900}, venues), 15) === null, 'C: out-of-range');
console.log('proximity checks done');
```
Expected: no `console.assert` failures; "proximity checks done" logged. (Adjust the sample lat/lng if the seeded Grafton differs — the point is at-venue passes, blurry/far return null.)

- [ ] **Step 5: Commit.**

```bash
git add src/lib/distance.ts src/lib/venueProximity.ts
git commit -m "feat: pure venue-proximity detector + haversineMeters"
```

---

### Task 2: Location store — continuous watch + accuracy

**Files:**
- Modify: `src/store/location.ts`

**Interfaces:**
- Consumes: existing `LocationState` (`coords`, `status`, `request`).
- Produces: adds `accuracy: number | null`, `watch(): void`, `stopWatch(): void` to the store.

- [ ] **Step 1: Extend the store type and state.** In `src/store/location.ts`, add to `LocationState`:

```ts
  /** Accuracy radius (m) of the latest fix, or null. */
  accuracy: number | null;
  /** Start continuous foreground tracking (watchPosition). Idempotent. */
  watch: () => void;
  /** Stop continuous tracking. */
  stopWatch: () => void;
```

- [ ] **Step 2: Add a module-level watch id** above `export const useLocationStore`:

```ts
let watchId: number | null = null;
```

- [ ] **Step 3: Add `accuracy: null` to the initial state and implement `watch`/`stopWatch`** inside the store (alongside `request`):

```ts
  accuracy: null,
  watch: () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      set({ status: "unsupported" });
      return;
    }
    if (watchId !== null) return; // already watching
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
    if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  },
```

- [ ] **Step 4: Typecheck + build.**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: exit 0, build succeeds.

- [ ] **Step 5: Runtime smoke via DevTools.** Dev server running, open the app. In DevTools console:

```js
const { useLocationStore } = await import('/src/store/location.ts');
useLocationStore.getState().watch();
```
Then in DevTools **Sensors** panel set a custom Location (e.g. Grafton lat/lng). Confirm:
```js
useLocationStore.getState().coords // updates
useLocationStore.getState().accuracy // a number
```
Then `useLocationStore.getState().stopWatch()`. Expected: coords/accuracy populate while watching, stop clears the watch (no further updates on location change).

- [ ] **Step 6: Commit.**

```bash
git add src/store/location.ts
git commit -m "feat: continuous watchPosition + accuracy in location store"
```

---

### Task 3: Out-tonight orchestrator store + watcher hook

**Files:**
- Create: `src/store/outTonight.ts`

**Interfaces:**
- Consumes: `rankNearby`, `pickConfident` from `src/lib/venueProximity.ts`; `useLocationStore` (`watch`, `stopWatch`, `coords`, `accuracy`, `subscribe`) from `src/store/location.ts`; `logEvent` from `src/lib/analytics.ts`; `Venue` from `src/data/types.ts`; `Coords` from `src/store/location.ts`.
- Produces: `useOutTonightStore` with `{ active, promptVenue, setActive(on, venuesForStart?), processFix(coords, accuracy, venues), dismissPrompt() }`; `useOutTonightWatcher(venues: Venue[]): void`.

- [ ] **Step 1: Create `src/store/outTonight.ts`:**

```ts
/**
 * "I'm out tonight" mode. Client-only, session-scoped (no DB, no persistence).
 * Consumes location fixes, logs confidently-detected venue presence to our
 * metrics (events table, option 4), and raises a check-in prompt (option 1).
 * Hysteresis (CONFIRM_FIXES consecutive confident fixes) stops flip-flop
 * between two close bars. Raw coords never leave the device — only a venue_id
 * + coarse buckets are logged.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { pickConfident, rankNearby } from "@/lib/venueProximity";
import { logEvent } from "@/lib/analytics";
import { useLocationStore, type Coords } from "@/store/location";
import type { Venue } from "@/data/types";

const CONFIRM_FIXES = 2;

const distanceBucket = (m: number) => (m < 20 ? "0-20" : m < 40 ? "20-40" : "40-60");
const accuracyBucket = (m: number) => (m < 15 ? "0-15" : m < 30 ? "15-30" : "30-40");

type OutTonightState = {
  active: boolean;
  promptVenue: Venue | null;
  detectedVenueId: string | null;
  candidateVenueId: string | null;
  candidateStreak: number;
  loggedVenueIds: string[];
  setActive: (on: boolean) => void;
  processFix: (coords: Coords, accuracy: number | null, venues: Venue[]) => void;
  dismissPrompt: () => void;
};

export const useOutTonightStore = create<OutTonightState>((set, get) => ({
  active: false,
  promptVenue: null,
  detectedVenueId: null,
  candidateVenueId: null,
  candidateStreak: 0,
  loggedVenueIds: [],

  setActive: (on) => {
    if (on === get().active) return;
    if (on) {
      logEvent("out_tonight_start");
      set({ active: true });
    } else {
      set({
        active: false,
        promptVenue: null,
        detectedVenueId: null,
        candidateVenueId: null,
        candidateStreak: 0,
        loggedVenueIds: [],
      });
    }
  },

  processFix: (coords, accuracy, venues) => {
    const s = get();
    if (!s.active || accuracy === null) return;
    const ranked = rankNearby(coords, venues);
    const confident = pickConfident(ranked, accuracy);

    if (!confident) {
      set({ candidateVenueId: null, candidateStreak: 0 });
      return;
    }

    // Hysteresis: same candidate N fixes in a row before we commit.
    const streak = confident.id === s.candidateVenueId ? s.candidateStreak + 1 : 1;
    set({ candidateVenueId: confident.id, candidateStreak: streak });
    if (streak < CONFIRM_FIXES || confident.id === s.detectedVenueId) return;

    // Newly-committed presence.
    const nearestDist = ranked[0].distanceM;
    if (!s.loggedVenueIds.includes(confident.id)) {
      logEvent("venue_presence", {
        venue_id: confident.id,
        distance_bucket: distanceBucket(nearestDist),
        accuracy_bucket: accuracyBucket(accuracy),
        source: "out_tonight",
      });
    }
    set({
      detectedVenueId: confident.id,
      promptVenue: confident,
      loggedVenueIds: s.loggedVenueIds.includes(confident.id)
        ? s.loggedVenueIds
        : [...s.loggedVenueIds, confident.id],
    });
  },

  dismissPrompt: () => set({ promptVenue: null }),
}));

/**
 * Wires location fixes into the orchestrator while the mode is active.
 * Mount once where the venue list is available (MapPage).
 */
export function useOutTonightWatcher(venues: Venue[]): void {
  const active = useOutTonightStore((s) => s.active);
  const processFix = useOutTonightStore((s) => s.processFix);
  useEffect(() => {
    if (!active) return;
    useLocationStore.getState().watch();
    const unsub = useLocationStore.subscribe((s) => {
      if (s.coords) processFix(s.coords, s.accuracy, venues);
    });
    return () => {
      unsub();
      useLocationStore.getState().stopWatch();
    };
  }, [active, venues, processFix]);
}
```

- [ ] **Step 2: Typecheck.**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0. (If `useLocationStore.subscribe` types complain, confirm zustand's vanilla `subscribe` is available — it is on the store returned by `create`.)

- [ ] **Step 3: Verify `processFix` reducer in the browser console** (no runner):

```js
const { useOutTonightStore } = await import('/src/store/outTonight.ts');
const st = useOutTonightStore;
const grafton = { id:'g', title:'The Grafton', latitude:40.7265, longitude:-73.9815, serves_alcohol:true, category:'bar' };
const other   = { id:'o', title:'Other',       latitude:40.7280, longitude:-73.9830, serves_alcohol:true, category:'bar' };
const at = {lat:40.7265,lng:-73.9815};
st.getState().setActive(true);
st.getState().processFix(at, 15, [grafton, other]); // fix 1: candidate, no prompt yet
console.assert(st.getState().promptVenue === null, 'no prompt after 1 fix');
st.getState().processFix(at, 15, [grafton, other]); // fix 2: commit + prompt
console.assert(st.getState().promptVenue?.id === 'g', 'prompt after CONFIRM_FIXES');
st.getState().setActive(false);
console.assert(st.getState().promptVenue === null && st.getState().active === false, 'reset on disable');
console.log('orchestrator checks done');
```
Expected: no assert failures; "orchestrator checks done" logged. (Check the Network tab: two `events` inserts fired — `out_tonight_start` and one `venue_presence`.)

- [ ] **Step 4: Commit.**

```bash
git add src/store/outTonight.ts
git commit -m "feat: out-tonight orchestrator store + watcher hook"
```

---

### Task 4: Toggle control + opt-in disclosure

**Files:**
- Create: `src/components/OutTonightToggle.tsx`

**Interfaces:**
- Consumes: `useOutTonightStore` (`active`, `setActive`) from `src/store/outTonight.ts`; shadcn `Dialog` from `src/components/ui/dialog`; `Button`; lucide icons.
- Produces: default export `OutTonightToggle` (no props).

- [ ] **Step 1: Confirm the disclosure key + dialog primitive exist.**

Run: `ls src/components/ui/dialog.tsx && echo ok`
Expected: `ok`. (shadcn Dialog ships with this template; if absent, use the existing `Drawer` from `src/components/ui/drawer` instead — same open/close API.)

- [ ] **Step 2: Create `src/components/OutTonightToggle.tsx`:**

```tsx
/**
 * "I'm out tonight" control for the Map screen. First enable shows a mandatory
 * opt-in disclosure (venue logging + never-shown-to-friends). The choice to
 * accept is remembered on-device so we only disclose once.
 */
import { useState } from "react";
import { Ghost, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useOutTonightStore } from "@/store/outTonight";
import { cn } from "@/lib/utils";

const DISCLOSED_KEY = "endz:out-tonight-disclosed";

export default function OutTonightToggle() {
  const active = useOutTonightStore((s) => s.active);
  const setActive = useOutTonightStore((s) => s.setActive);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const handleClick = () => {
    if (active) {
      setActive(false);
      return;
    }
    if (localStorage.getItem(DISCLOSED_KEY) === "yes") {
      setActive(true);
      return;
    }
    setShowDisclosure(true);
  };

  const accept = () => {
    localStorage.setItem(DISCLOSED_KEY, "yes");
    setShowDisclosure(false);
    setActive(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant={active ? "default" : "secondary"}
        className={cn("rounded-full gap-2", active && "shadow-glow")}
        aria-pressed={active}
      >
        {active ? <Radio className="h-4 w-4" /> : <Ghost className="h-4 w-4" />}
        {active ? "Out tonight — on" : "I'm out tonight"}
      </Button>

      <Dialog open={showDisclosure} onOpenChange={setShowDisclosure}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Out tonight</DialogTitle>
            <DialogDescription>
              Out tonight lets ENDZ see which venues you visit tonight to
              understand where people go — never shown to your friends. Turn it
              off anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDisclosure(false)}>
              Not now
            </Button>
            <Button onClick={accept}>Turn on</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Typecheck + build.**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: exit 0, build succeeds.

- [ ] **Step 4: Commit.**

```bash
git add src/components/OutTonightToggle.tsx
git commit -m "feat: out-tonight toggle + opt-in disclosure dialog"
```

---

### Task 5: Check-in prompt

**Files:**
- Create: `src/components/OutTonightPrompt.tsx`

**Interfaces:**
- Consumes: `useOutTonightStore` (`promptVenue`, `dismissPrompt`); `checkIn`, `pokeActivity`, `getStoredVisibility` from `src/lib/checkins`; `logEvent`; `useAuthStore`; `useQueryClient` from `@tanstack/react-query`; `rankNearby` from `src/lib/venueProximity`; `useLocationStore`; `useVenues`.
- Produces: default export `OutTonightPrompt` (no props).

- [ ] **Step 1: Create `src/components/OutTonightPrompt.tsx`:**

```tsx
/**
 * "Looks like you're at {venue} — check in?" prompt raised by out-tonight mode.
 * Check in reuses the normal check-in action (feeds friend map + live counts).
 * "Not here" reveals the next-nearest venues so a dense-block miss is one tap
 * to fix. Nothing public happens unless the user taps Check in.
 */
import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useOutTonightStore } from "@/store/outTonight";
import { useAuthStore } from "@/store/auth";
import { useLocationStore } from "@/store/location";
import { useVenues } from "@/hooks/useVenues";
import { rankNearby } from "@/lib/venueProximity";
import { checkIn, pokeActivity, getStoredVisibility } from "@/lib/checkins";
import { logEvent } from "@/lib/analytics";
import type { Venue } from "@/data/types";

export default function OutTonightPrompt() {
  const promptVenue = useOutTonightStore((s) => s.promptVenue);
  const dismissPrompt = useOutTonightStore((s) => s.dismissPrompt);
  const userId = useAuthStore((s) => s.session?.user.id);
  const coords = useLocationStore((s) => s.coords);
  const { data: venues } = useVenues({});
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pickOther, setPickOther] = useState(false);

  if (!promptVenue || !userId) return null;

  const doCheckIn = async (venue: Venue) => {
    if (busy) return;
    setBusy(true);
    const visibility = getStoredVisibility();
    const prev = queryClient.getQueryData(["my-check-in", userId]);
    queryClient.setQueryData(["my-check-in", userId], {
      id: "optimistic", venue_id: venue.id, vibe: null,
      expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    });
    try {
      await checkIn(userId, venue.id, visibility);
      logEvent("out_tonight_checkin_confirmed", { venue_id: venue.id, visibility });
      pokeActivity();
      useOutTonightStore.getState().dismissPrompt();
      setPickOther(false);
    } catch {
      queryClient.setQueryData(["my-check-in", userId], prev);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["my-check-in"] });
      queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
      setBusy(false);
    }
  };

  const nearby = coords && venues ? rankNearby(coords, venues).slice(0, 3) : [];

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,26rem)]">
      <div className="glass rounded-2xl p-4 shadow-glow animate-fade-in">
        <button
          onClick={() => { dismissPrompt(); setPickOther(false); }}
          className="absolute right-3 top-3 text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        {!pickOther ? (
          <>
            <div className="flex items-center gap-2 font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              Looks like you're at {promptVenue.title}
            </div>
            <p className="text-sm text-muted-foreground mt-1 mb-3">Check in?</p>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" disabled={busy} onClick={() => doCheckIn(promptVenue)}>
                Check in
              </Button>
              <Button variant="secondary" className="rounded-xl" disabled={busy} onClick={() => setPickOther(true)}>
                Not here
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="font-medium mb-2">Where are you?</div>
            <div className="grid gap-2">
              {nearby.map(({ venue }) => (
                <Button key={venue.id} variant="secondary" className="justify-start rounded-xl" disabled={busy} onClick={() => doCheckIn(venue)}>
                  {venue.title}
                </Button>
              ))}
              <Button variant="ghost" className="rounded-xl" onClick={() => { dismissPrompt(); setPickOther(false); }}>
                None of these
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build.**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: exit 0, build succeeds.

- [ ] **Step 3: Commit.**

```bash
git add src/components/OutTonightPrompt.tsx
git commit -m "feat: out-tonight check-in prompt with pick-nearest fallback"
```

---

### Task 6: Mount on the Map screen + end-to-end verification

**Files:**
- Modify: `src/pages/MapPage.tsx`

**Interfaces:**
- Consumes: `OutTonightToggle`, `OutTonightPrompt`, `useOutTonightWatcher`, and MapPage's existing `venues`/`data` from `useVenues`.

- [ ] **Step 1: Import the pieces** at the top of `src/pages/MapPage.tsx`:

```ts
import OutTonightToggle from "@/components/OutTonightToggle";
import OutTonightPrompt from "@/components/OutTonightPrompt";
import { useOutTonightWatcher } from "@/store/outTonight";
```

- [ ] **Step 2: Wire the watcher** inside the `MapPage` component body, using its existing venues list (the `useVenues` result already in MapPage — reuse that variable; it is the same `Venue[]`). Add near the other hooks:

```ts
  useOutTonightWatcher(data ?? []);
```
(Use whatever the local `useVenues({...})` result is named in MapPage — commonly `data`. If it's `venues`, pass that.)

- [ ] **Step 3: Render the toggle among the existing floating map controls**, and the prompt once near the end of the returned JSX (as a sibling of the map, not inside a transformed layer):

```tsx
      {/* floating controls row — place next to the existing locate/search controls */}
      <OutTonightToggle />
      ...
      <OutTonightPrompt />
```
Mirror the existing control's wrapper/positioning classes so the toggle sits with the current floating controls; the prompt is `position: fixed` already, so it can render anywhere in the tree.

- [ ] **Step 4: Typecheck + build.**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: exit 0, build succeeds.

- [ ] **Step 5: End-to-end runtime verification** (dev server + Chrome DevTools):

1. Open the app (Map screen). Confirm the **"I'm out tonight"** button shows.
2. Click it → the opt-in disclosure dialog appears with the mandatory copy → **Turn on**. Button flips to "Out tonight — on".
3. DevTools **Sensors** → set Location to a seeded venue's lat/lng (e.g. Grafton). Keep it set for ~2 fixes.
4. Confirm the **"Looks like you're at The Grafton — check in?"** prompt appears (after CONFIRM_FIXES), and the Network tab shows one `venue_presence` insert to `events`.
5. Click **Check in** → prompt dismisses; confirm a `check_ins` insert fired and `out_tonight_checkin_confirmed` logged. (Requires a signed-in session — sign in first, or note this sub-step as needing a real account, same as other check-in flows.)
6. Click **Not here** on a fresh prompt → the 3 nearest venues list; picking one checks in there.
7. Toggle **off** → prompt clears, watch stops (no further `events` on location change).
8. Confirm **0 console errors** throughout.

- [ ] **Step 6: Commit.**

```bash
git add src/pages/MapPage.tsx
git commit -m "feat: mount out-tonight toggle, prompt, and watcher on Map"
```

---

### Task 7: Disclose venue logging in the Privacy draft

**Files:**
- Modify: `docs/plans/2026-07-15-privacy-terms-DRAFT.md`

- [ ] **Step 1: Add a claim + a policy bullet.** Under "Claims I'm asserting", append:

```
8. **"Out tonight" venue logging (opt-in).** If a user turns on Out tonight, we
   log which venues they're detected at (venue id + coarse distance/accuracy
   buckets, never raw GPS) to OUR metrics only — never shown to friends. Off by
   default; disclosed at opt-in.
```

Under the Privacy Policy "What we collect" list, add:

```
- **"Out tonight" (opt-in).** When you turn on Out tonight, ENDZ records which
  venues you're near that night — a venue id and coarse distance, never your raw
  coordinates — to understand where people go. It's never shown to your friends,
  it's off by default, and you can turn it off anytime.
```

- [ ] **Step 2: Commit.**

```bash
git add docs/plans/2026-07-15-privacy-terms-DRAFT.md
git commit -m "docs: disclose out-tonight venue logging in privacy draft"
```

---

## Self-Review

**Spec coverage:**
- Phase-1 foreground scope → Tasks 2 (watch), 3 (active only while watching). ✓
- Option 4 silent metrics logging → Task 3 `venue_presence` event. ✓
- Option 1 confirm prompt → Tasks 5 + 6. ✓
- watchPosition + accuracy handling → Task 2. ✓
- Nearest-venue detector + threshold + hysteresis → Tasks 1 (threshold/margin) + 3 (CONFIRM_FIXES hysteresis). ✓
- Honest opt-in copy → Task 4 disclosure. ✓
- No DDL (events table) → Tasks 3 events; Global Constraints. ✓
- Raw coords never persist → Task 3 buckets only; Global Constraints. ✓
- Privacy Policy updated → Task 7. ✓
- Toggle placement = Map (open Q1, resolved to Map) → Task 6. ✓
- Thresholds tunable (open Q2) → named constants, Task 1. ✓
- Prompt cadence one-per-venue-per-session (open Q3) → Task 3 `loggedVenueIds` + `detectedVenueId` guard. ✓
- Out of scope (native/geofence/declared-intent/auto-checkin) → not built. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; verification steps have exact console/DevTools actions. One soft spot: Task 6 anchors into MapPage by description (its exact control markup wasn't inlined) — acceptable because it's "mirror the existing floating controls," and the implementer sees the file. No undefined types.

**Type consistency:** `Coords` ({lat,lng}) used consistently; `Venue.latitude/longitude` mapped to `{lat,lng}` at every haversine call; `pickConfident`/`rankNearby`/`processFix` signatures match across Tasks 1/3/5; `setActive`/`processFix`/`dismissPrompt`/`promptVenue` consistent between store (Task 3) and consumers (Tasks 4/5/6); check-in reuse matches `checkIn(userId, venueId, visibility)` from `lib/checkins`.
