# Onboarding location step — prep & build

Date: 2026-07-15
Branch: `feat/onboarding-location`
Status: built on branch, not merged, not deployed.

## Goal

Make granting location permission an early, first-class step in onboarding
instead of an ad-hoc thing that only happens when a user taps "Locate me" on
the map. Explain *why* ("see what's live around you"), keep it skippable
(privacy), and never block users who deny.

---

## 1. Current-flow audit

The app has two separate entry paths. Only the second is real onboarding.

### `/join` — public waitlist (not app onboarding)
`src/pages/Join.tsx`, rendered outside `AppLayout`. Name + phone/email captured
into the waitlist. No auth, no map. This is the QR/landing page; it does not
lead into the app. Out of scope for the location step.

### The real onboarding sequence (Google auth → map)

Auth state lives in `src/store/auth.ts` with `AuthStatus`:
`loading | signedOut | signedIn | needsUsername`.

1. **Signed out.** A signed-out user can still browse the map — `AppLayout`
   (`src/layouts/AppLayout.tsx`) only force-redirects `needsUsername`. The
   sign-in entry point is the Profile tab (`src/pages/Profile.tsx` →
   `signInWithGoogle`), which OAuths and redirects back to `/profile`.
2. **OAuth returns.** `auth.init()` picks up the session, calls
   `refreshProfile()`. No profile row yet → status becomes `needsUsername`.
3. **Redirect to username.** `AppLayout` effect sends `needsUsername` → `/welcome`
   (`src/pages/PickUsername.tsx`).
4. **Claim username.** `PickUsername.claim()` inserts the `profiles` row, calls
   `refreshProfile()` → status flips to `signedIn`. Its effect
   (`if (status === "signedIn") navigate("/")`) drops the user on the map.
5. **Map (`/`).** `MapPage` → `Map.tsx`. **Location is never requested here.**
   It is only requested when the user taps the "Locate me" FAB
   (`handleLocateMe` → `useLocationStore.request()`), which fires the browser
   Geolocation prompt on demand.

### How location works today
`src/store/location.ts` — a Zustand store, client-only. `request()` calls
`navigator.geolocation.getCurrentPosition` once, caches coords in memory for the
session, and sets `status: idle | prompting | granted | denied | unsupported`.
**Coordinates are never sent to the server** (confirmed by the store and its
header comment). The map falls back to East Village center on deny/unsupported.

**Gap:** a new user reaches the map having never been asked for location and
without any explanation of why it helps. The first time they ever see the
browser prompt is a bare, context-free tap on a small compass icon.

---

## 2. Design

Insert one screen between "username claimed" and "land on map":

```
signedOut → (Google) → needsUsername → /welcome (pick username)
          → /welcome/location (NEW: location primer) → / (map)
```

### Why a dedicated screen (not a new AuthStatus, not a map modal)
- **No state-machine surgery.** Adding a `needsLocation` status would touch the
  core auth/redirect logic that already guards the whole app — high blast
  radius for a skippable nicety. Instead this is a plain standalone route
  (`/welcome/location`), exactly mirroring how `/welcome` already sits outside
  `AppLayout`. Auth stays a 4-state machine.
- **Reversible / low-risk.** Deleting the route + reverting two lines in
  `PickUsername` returns to the old behavior. Nothing else depends on it.
- **First-class, but not a wall.** It's a real full screen (it reads as a step,
  not a nag), yet both paths out of it go to the map.

### The screen (`src/pages/LocationPrimer.tsx`)
- Headline from the approved copy bank: **"See what's live around you."**
- Body explains the payoff: map opens on your block, sorted by closest + busiest.
- A glass privacy card (lock icon): location stays on your phone, never sent to
  servers, never shown to anyone; you only appear on the map when you check in.
  (All literally true per `location.ts` + the check-in presence model.)
- Primary button **"Turn on location"** → `request()`; on grant *or* deny,
  routes to `/`. A denied prompt must never trap the user.
- Secondary ghost button **"Not now"** → routes to `/`.
- Footer: "You can turn this on any time from the map." (The FAB still works.)

### Guards
`LocationPrimer` bounces `signedOut → /profile` and `needsUsername → /welcome`,
but **deliberately does not bounce `signedIn`** — signed-in is the expected
state on this screen. `PickUsername` sets a `claimedRef` before flipping to
`signedIn` so its existing "already signed in → /" redirect can't race ahead of
the intentional hop to the primer.

### Analytics
`track()` events (stub, matches `Join.tsx` usage): `location_primer_view`,
`location_primer_result` (with resolved location status), `location_primer_skip`.

---

## 3. What was built

- **`src/pages/LocationPrimer.tsx`** (new) — the primer screen above.
- **`src/App.tsx`** — new route `welcome/location` → `LocationPrimer`.
- **`src/pages/PickUsername.tsx`** — after a successful claim, navigate to
  `/welcome/location` (instead of `/`); `claimedRef` guards the redirect effect.

No changes to `location.ts`, `auth.ts`, the map, or Supabase. Reuses the
existing location store as-is.

Typecheck: `npx tsc --noEmit -p tsconfig.app.json` passes. `vite build` passes.

---

## 4. Privacy considerations

- **Skippable by design** — "Not now" is a first-class button, not fine print.
- **Deny never blocks** — a denied browser prompt falls through to the map.
- **Honest copy** — every privacy claim is backed by code: coords live in memory
  client-side only and are never transmitted (`location.ts`); presence on the
  map comes only from check-ins.
- **No new data leaves the device.** This step does not send location anywhere;
  it only primes the browser permission and caches coords for the session, same
  as the existing "Locate me" button.
- **PWA reality** — this is the browser Geolocation API only. There is no
  background tracking and this step does not imply any; true background location
  isn't possible until the Capacitor native wrap.

---

## 5. Acceptance criteria

- [x] A new user, after claiming a username, sees the location step before the map.
- [x] "Turn on location" fires the browser prompt; on grant the user proceeds to
      the map with coords cached; on deny the user still proceeds to the map.
- [x] "Not now" proceeds to the map without prompting.
- [x] Returning, already-onboarded users never see the step (only reachable via
      the post-claim hop; `PickUsername`/`LocationPrimer` guards send everyone
      else where they belong).
- [x] Auth remains a 4-state machine; no changes to `location.ts` or Supabase.
- [x] Typecheck and build pass.

---

## Open decisions for Colton

1. **Grant timing.** The screen calls `request()` on the button tap, so the OS
   prompt appears *after* our explainer (recommended — higher grant rates,
   less creepy). Confirm you don't want the OS prompt to fire on screen mount.
2. **Re-show on mid-step reload.** The step is one-time via the onboarding hop,
   but if a user *reloads the browser* while sitting on `/welcome/location`
   (signed-in, profile exists), they'll see it once more since we don't persist
   a "seen" flag. Left out to keep the change minimal/reversible. Add a
   `localStorage` flag if you'd rather it never repeat.
3. **Copy check.** Headline uses the approved "See what's live around you."
   Confirm the privacy card wording is how you want to talk about it.
4. **Skippers' second chance.** Today the only re-prompt for skippers is the map
   FAB. Fine for MVP? A later "turn on location" nudge on the map is possible
   but out of scope here.
