# Location-Denied Guidance Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user explicitly asks for location and permission is denied at the browser/OS level, show a dialog with platform-specific enable steps instead of the generic dead-end toast.

**Architecture:** The location store starts recording *why* a request failed (`failure: "denied" | "unavailable" | "timeout"`, mapped from `GeolocationPositionError.code`); a new presentational `LocationDeniedDialog` renders platform-aware instructions; the two explicit tap points (Map's Locate-me, VibeFinder's "around me") pre-check `geolocationPermission()` (never prompts) and branch to the dialog on denial, keeping today's toasts for timeout/unavailable.

**Tech Stack:** React + TypeScript, Zustand store, shadcn Dialog (already in repo), browser Geolocation + Permissions APIs.

## Global Constraints

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- Build check with `npm run build`.
- **No test runner exists** — verification is tsc + build + live browser. Do NOT add a test framework.
- **Explicit taps only** (Colton's call): the dialog opens only from Locate-me / "around me" taps. No banners, no auto-open, no nagging.
- **Never trigger a geolocation prompt on map load** (unchanged). `geolocationPermission()` never prompts — safe to call on tap.
- Coords/accuracy/failure state never leave the device. No DB, no schema, no new dependencies.
- Copy tone: direct, casual, human. Banned: corporate/AI phrasing ("seamless", "unlock", etc.).
- Onboarding primer (`LocationPrimer.tsx`) stays untouched.
- Work on branch `feat/location-denied-dialog`; nothing merges or pushes without Colton's explicit OK.

---

### Task 1: Store records failure reason

**Files:**
- Modify: `src/store/location.ts` (state type ~line 11-22; `request()` callbacks ~lines 40-51; `watch()` callbacks ~lines 62-70)

**Interfaces:**
- Consumes: nothing new.
- Produces: `useLocationStore` state gains `failure: "denied" | "unavailable" | "timeout" | null` — set on any geolocation error, cleared (`null`) on any successful fix. Read later via `useLocationStore.getState().failure`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/location-denied-dialog
```

- [ ] **Step 2: Add the `failure` field and error mapping**

In `src/store/location.ts`, extend the state type (after the `accuracy` field in `LocationState`):

```ts
  /** Why the last geolocation attempt failed, or null. */
  failure: "denied" | "unavailable" | "timeout" | null;
```

Add a module-level helper above the store creation (near `let watchId`):

```ts
const failureFromError = (
  err: GeolocationPositionError,
): "denied" | "unavailable" | "timeout" =>
  err.code === err.PERMISSION_DENIED
    ? "denied"
    : err.code === err.TIMEOUT
      ? "timeout"
      : "unavailable";
```

Initialize in the store: `failure: null,` (next to `accuracy: null`).

In `request()`, the success callback's `set` gains `failure: null`, and the error callback (currently `() => { set({ status: "denied" }); resolve(null); }`) becomes:

```ts
        (err) => {
          set({ status: "denied", failure: failureFromError(err) });
          resolve(null);
        },
```

In `watch()`, the success callback's `set` gains `failure: null`, and the error callback (currently `() => set({ status: "denied" })`) becomes:

```ts
      (err) => set({ status: "denied", failure: failureFromError(err) }),
```

(`status` semantics stay as-is for backward compatibility — only the new field distinguishes causes.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean (no output, exit 0).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean, exit 0 (pre-existing chunk-size warning is fine).

- [ ] **Step 5: Commit**

```bash
git add src/store/location.ts
git commit -m "feat(location): record why geolocation failed (denied/unavailable/timeout)"
```

---

### Task 2: LocationDeniedDialog component

**Files:**
- Create: `src/components/LocationDeniedDialog.tsx`

**Interfaces:**
- Consumes: shadcn `Dialog` kit (`@/components/ui/dialog`), `Button` (`@/components/ui/button`).
- Produces: `LocationDeniedDialog({ open: boolean; onOpenChange: (open: boolean) => void })` — default export, fully controlled, no store coupling.

- [ ] **Step 1: Create the component**

```tsx
/**
 * Shown when the user explicitly asks for location but permission is denied
 * at the browser/OS level. Web pages can't open system settings or re-trigger
 * a denied prompt — clear steps are the ceiling until the Capacitor wrap
 * (native can deep-link straight to the app's Settings pane; when that lands,
 * swap the steps for an "Open Settings" button here).
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const platformSteps = (): string[] => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return [
      'Open Settings → Privacy & Security → Location Services, and set Safari Websites to "Ask Next Time Or When I Share".',
      "Still blocked? In Safari, tap aA in the address bar → Website Settings → Location → Ask.",
    ];
  }
  if (/Android/.test(ua)) {
    return [
      "Tap the lock icon next to the address bar → Permissions → Location → Allow.",
      "No Location entry? Open your browser's Settings → Site settings → Location.",
    ];
  }
  return ["Turn location back on for your browser in your device settings, then try again."];
};

const LocationDeniedDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Location is off for ENDZ</DialogTitle>
        <DialogDescription>
          Your phone is blocking location for this site, so the map can't find
          you. Here's the fix:
        </DialogDescription>
      </DialogHeader>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
        {platformSteps().map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} className="w-full">
          Got it
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default LocationDeniedDialog;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/LocationDeniedDialog.tsx
git commit -m "feat(ui): LocationDeniedDialog with platform-specific enable steps"
```

---

### Task 3: Wire the two tap points

**Files:**
- Modify: `src/components/Map.tsx` (`handleLocateMe`, ~line 476; component JSX return)
- Modify: `src/components/VibeFinder.tsx` (`chooseNear`, ~line 82; imports ~line 13; component JSX return)

**Interfaces:**
- Consumes: `LocationDeniedDialog` (Task 2), `failure` field (Task 1), existing `geolocationPermission()` from `@/store/location` (exported module function, returns `Promise<"granted" | "prompt" | "denied">`, never prompts).
- Produces: no new exports.

- [ ] **Step 1: Wire `Map.tsx`**

Add imports (`geolocationPermission` is already imported in Map.tsx; add the dialog and `useState` if not present — `useState` likely already imported):

```ts
import LocationDeniedDialog from "@/components/LocationDeniedDialog";
```

Add state next to the component's other `useState` hooks:

```ts
  const [showDeniedDialog, setShowDeniedDialog] = useState(false);
```

Replace `handleLocateMe` (which currently starts `if (!map.current) return;` / `const coords = await requestLocation();` / `if (!map.current) return;` and toasts in the else branch) with:

```ts
  const handleLocateMe = useCallback(async () => {
    if (!map.current) return;
    // Known-denied: skip the doomed geolocation call, explain the fix instead.
    if ((await geolocationPermission()) === "denied") {
      setShowDeniedDialog(true);
      return;
    }
    const coords = await requestLocation();
    if (!map.current) return;
    if (coords) {
      placeUserDot(coords.lng, coords.lat);
      updateHalo(coords.lng, coords.lat, useLocationStore.getState().accuracy);
      map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 1500 });
      ensureWatching(); // follow from now on
      toast.success("Found your location");
    } else if (useLocationStore.getState().failure === "denied") {
      setShowDeniedDialog(true);
    } else {
      toast.info("Location unavailable — showing East Village center");
      map.current.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
    }
  }, [requestLocation, placeUserDot, ensureWatching, updateHalo]);
```

In the component's JSX return, render the dialog alongside the map container (inside the outermost wrapper, after the existing overlay controls):

```tsx
      <LocationDeniedDialog open={showDeniedDialog} onOpenChange={setShowDeniedDialog} />
```

- [ ] **Step 2: Wire `VibeFinder.tsx`**

Extend the store import (line ~13) to include the permission helper:

```ts
import { useLocationStore, geolocationPermission } from "@/store/location";
```

Add the dialog import and state:

```ts
import LocationDeniedDialog from "@/components/LocationDeniedDialog";
```

```ts
  const [showDeniedDialog, setShowDeniedDialog] = useState(false);
```

Replace `chooseNear` (currently toasts on any null) with:

```ts
  // "Around me" needs location; denied gets the how-to dialog, anything else
  // falls back to no preference with the existing nudge.
  const chooseNear = async (want: boolean) => {
    if (want) {
      if ((await geolocationPermission()) === "denied") {
        setShowDeniedDialog(true);
        setNear(false);
        return;
      }
      if (!(await requestLocation())) {
        if (useLocationStore.getState().failure === "denied") {
          setShowDeniedDialog(true);
        } else {
          toast.info("Turn on location to sort by what's around you");
        }
        setNear(false);
        return;
      }
    }
    setNear(want);
  };
```

Render the dialog inside the component's outermost returned element:

```tsx
      <LocationDeniedDialog open={showDeniedDialog} onOpenChange={setShowDeniedDialog} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/Map.tsx src/components/VibeFinder.tsx
git commit -m "feat(location): denied taps get platform enable steps instead of dead-end toast"
```

---

### Task 4: Live browser verification (mocked geolocation)

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: the running app (`npm run dev`, http://localhost:8080) + everything above.
- Produces: verified acceptance criteria; screenshots.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Expected: Vite on http://localhost:8080.

- [ ] **Step 2: Denied pre-check path (iOS copy)**

Navigate with an init script that mocks `navigator.permissions.query` → `{ state: "denied" }`, stubs `getCurrentPosition`/`watchPosition` to record calls (they must NOT be called), and overrides the UA is not possible via script — instead verify iOS copy by spoofing: use Chrome DevTools MCP `emulate` (device emulation sets an iPhone UA) or assert the generic/desktop copy on the host UA and separately unit-check `platformSteps` by evaluating a copy of its regex against an iPhone UA string in the console. Tap Locate-me. Expected: dialog opens with enable steps; zero geolocation calls recorded; no prompt.

- [ ] **Step 3: Denied-at-request path**

Init script: permissions → `{ state: "prompt" }`; `getCurrentPosition` calls the error callback with `{ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }`. Tap Locate-me. Expected: dialog opens (no toast).

- [ ] **Step 4: Timeout path keeps the toast**

Init script: permissions → `{ state: "prompt" }`; `getCurrentPosition` errors with `{ code: 3, ... }`. Tap Locate-me. Expected: existing "Location unavailable — showing East Village center" toast, NO dialog, map flies to EV center.

- [ ] **Step 5: "Around me" branch**

Open Find the move, choose the around-me option with permissions `{ state: "denied" }`. Expected: dialog opens, near-preference falls back to off. Repeat with code-3 error: nudge toast, no dialog.

- [ ] **Step 6: Dismiss + no-reopen + no-load-prompt**

Dismiss via "Got it". Expected: dialog closes and does not reopen without a new tap. Reload with permission "prompt" and instrumented geolocation: no calls on load (unchanged rule).

- [ ] **Step 7: Report**

Report pass/fail per acceptance criterion (spec `2026-07-18-location-denied-dialog-design.md`) with screenshots. Do NOT merge or push — Colton's call.
