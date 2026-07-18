# Location-Denied Guidance Dialog — Design Spec (item 8, denial-UX slice)

**Date:** 2026-07-18
**Status:** Approved (design) — pending spec review, then implementation plan
**Motivation:** Colton hit this live (2026-07-18): iOS had location blocked for
Safari, ENDZ showed the generic "Location unavailable" toast, and nothing told
him the fix was in Settings. Denied users currently get the same dead-end copy
as a GPS timeout.

## Goal

When a user explicitly asks for location (Locate-me button, "around me" in
Find the move) and permission is denied at the browser/OS level, show a small
dialog with platform-specific steps to turn location back on — instead of the
generic toast. **Explicit taps only** (Colton's call): no proactive banners,
no nagging, consistent with the consensual-location principle.

Hard platform limit (verified): web pages cannot open iOS/Android system
settings or re-trigger a denied permission prompt. Instructions are the
ceiling for the PWA. **Future:** the Capacitor native wrap can deep-link to
the app's Settings pane (`UIApplication.openSettingsURLString`) — design the
dialog so that upgrade is a copy/button swap, not a rebuild.

## Current behavior (audited 2026-07-18)

- `store/location.ts` `request()`/`watch()` error callbacks set
  `status: "denied"` for **every** failure — `GeolocationPositionError.code`
  (1 = denied, 2 = unavailable, 3 = timeout) is thrown away.
- `Map.tsx` `handleLocateMe`: any null from `request()` → one generic toast
  ("Location unavailable — showing East Village center").
- `VibeFinder.tsx` `chooseNear`: any null → "Turn on location to sort by
  what's around you" toast, falls back to no-preference.
- `LocationPrimer` (onboarding): denied prompt falls through to the map by
  design — stays untouched.

## Behavior after this change

1. Tap Locate-me (or "around me") → first check `geolocationPermission()`
   (never prompts). If already `"denied"` → open the dialog immediately, no
   doomed geolocation call.
2. Otherwise request as today. If the request fails with error code 1
   (denied) → dialog. Codes 2/3 (unavailable/timeout) → keep the existing
   toasts, which are now truthful.
3. The dialog shows platform-aware steps (picked by user-agent):
   - **iOS:** Settings → Privacy & Security → Location Services →
     Safari Websites → "Ask Next Time Or When I Share"; plus the aA-menu →
     Website Settings → Location per-site path.
   - **Android/Chrome:** lock icon in the address bar → Permissions →
     Location → Allow.
   - **Fallback:** generic "enable location for your browser in system
     settings."
4. Dialog is dismissible ("Got it"), shows only on the triggering tap, never
   auto-reopens. Copy follows tone rules: direct, casual, no corporate voice.

## Design

### Store (`src/store/location.ts`)

- New state field `failure: "denied" | "unavailable" | "timeout" | null`,
  set from `err.code` in both `request()`'s and `watch()`'s error callbacks
  (cleared to `null` on any successful fix). `status` stays as-is for
  backward compatibility.

### Shared dialog (`src/components/LocationDeniedDialog.tsx`)

- Presentational shadcn Dialog (kit already in repo), controlled via
  `open`/`onOpenChange` props from the caller. Platform copy chosen by a
  small user-agent helper inside the component. No store coupling.

### Call sites

- `Map.tsx` `handleLocateMe` and `VibeFinder.tsx` `chooseNear`: pre-check
  `geolocationPermission()`; on `"denied"` (pre-check or `failure ===
  "denied"` after a null result) open the dialog; otherwise keep today's
  toast behavior for codes 2/3.

## Files touched

- `src/store/location.ts` — `failure` field.
- `src/components/LocationDeniedDialog.tsx` — new.
- `src/components/Map.tsx`, `src/components/VibeFinder.tsx` — branch on
  denial, render the dialog.

No DB, no schema, no new dependencies, nothing leaves the device.

## Out of scope

- Proactive banners, muted-button states, or any surface not behind an
  explicit tap (explicitly rejected).
- Native settings deep-link (Capacitor-phase upgrade, noted above).
- Onboarding primer changes.
- Re-prompting mechanics — impossible on the web once denied.

## Acceptance criteria

- [ ] Mocked permission "denied": tapping Locate-me opens the dialog with
      iOS copy under an iOS user-agent, Android copy under Android UA,
      generic otherwise; no geolocation call is made.
- [ ] Mocked grant-then-timeout (code 3): existing toast, no dialog.
- [ ] Mocked denial at request time (code 1, permission state "prompt"):
      dialog opens.
- [ ] "Around me" in Find the move: same branching.
- [ ] Dialog dismisses and does not reopen without a new tap.
- [ ] No geolocation prompt on load anywhere (unchanged).
- [ ] `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run build` clean.
- [ ] Live-verified in browser with mocked geolocation/permissions.
