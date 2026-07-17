# "I'm Out Tonight" mode — design (2026-07-16)

**Status:** approved design, pre-implementation. Product-gate discussion done
with Colton 2026-07-16. Next step after his spec review = writing-plans.

## Problem / goal
Colton wants ENDZ to know **where people actually go** — feeding our metrics —
and to make checking in **effortless**, without forcing a manual tap. The north
star is unprompted check-ins per active user; passive venue attribution makes
that number real and powers the friend map hands-free.

## The hard constraint that shapes everything
A **web PWA cannot track location in the background.** Browser geolocation only
runs while the app is open and foregrounded; iOS kills it on lock/background.
True passive "track every bar they hit while pocketed" requires a **native app**
(Capacitor + background-location + App Store review of a high-scrutiny
permission). That is **Phase 2**, explicitly out of scope here.

**Phase 1 (this spec):** the strongest *consensual, foreground* version on the
current PWA stack — and the on-ramp to the native version.

## Scope decision (locked with Colton)
- **Phased approach A:** ship Phase 1 on PWA now; native background = Phase 2 later,
  designed better once Phase 1's real movement data exists.
- **Behavior = option 4 + option 1:**
  - **(4) Silent metrics logging.** While the mode is on + app open, detected
    venue presence is logged to our `events` table only. **Never shown to friends.**
  - **(1) Confirm-to-check-in.** When we're confident you're at a venue, we surface
    a one-tap prompt — *"Looks like you're at The Grafton — check in?"* Tap →
    normal public check-in (existing loop, feeds friend map + live crowd count).
    Ignore → nothing public happens. Confirm-gating means GPS error can never put a
    wrong bar in front of friends.
- **No separate "tell friends I'm out" broadcast in MVP** — the confirmed check-in
  already surfaces you to friends. (Declared-intent broadcast = possible fast-follow.)
- **Related decision (audit #7), locked:** ghost-mode users DO count in our own
  server-side metrics. Ghost only hides you from *friends*, not from our `events`.

## Privacy — the conscious step
Today, location coords **never leave the device** (`store/location.ts`). Phase 1
is the **first time we store venue-presence server-side** (user X near venue Y at
time Z, in `events`). This is a real data-sensitivity increase. It is acceptable
**only because it is opt-in and disclosed** — which keeps it inside ENDZ's locked
rule ("no covert location tracking — opt-in/consensual only"). Requirements:
- The toggle's opt-in copy MUST plainly state venue logging, e.g.
  *"Out tonight lets ENDZ see which venues you visit tonight to understand where
  people go — never shown to your friends. Turn it off anytime."*
- The Privacy Policy draft (`docs/plans/2026-07-15-privacy-terms-DRAFT.md`) MUST be
  updated to disclose server-side venue-presence logging before either ships.
- Raw coords still never persist — we store a resolved `venue_id` + coarse
  metadata (distance/accuracy buckets), not lat/lng.

## Architecture (small, isolated units)

### 1. `store/location.ts` — extend to continuous watch (client-only)
Add `watch()` / `stopWatch()` using `navigator.geolocation.watchPosition`, exposing
live `coords`, `accuracy` (m), and `status`. One-shot `request()` stays for the
existing you-are-here/distance features. Coords remain in-memory, never sent to a
server. Watch auto-pauses when the browser backgrounds the tab; resume on
`visibilitychange` → visible. This is the "make location perfect" foundation.

### 2. `lib/venueProximity.ts` — pure detector (new, unit-testable)
`nearestVenues(coords, accuracy, venues) → { venue, distanceM, confident }[]`.
- Haversine (reuse `lib/distance.ts`) to rank venues by distance.
- `confident` = nearest venue within `ARRIVAL_RADIUS_M` (proposed ~60m) AND
  clearly closer than the runner-up by a margin AND `accuracy` below a ceiling
  (proposed ≤ 40m). Dense-block guard.
- **Hysteresis:** caller holds the current "detected venue"; only switch when a new
  venue is confidently closer for N consecutive fixes (proposed 2) → no flip-flop
  between two bars 20m apart.
- Pure function of its inputs. No React, no I/O. Thresholds exported as named
  constants for tuning.

### 3. `store/outTonight.ts` — the mode orchestrator (new, client-only)
State: `active: boolean`, `detectedVenueId | null`, `promptVenue | null`,
`loggedVenueIds: Set` (dedupe presence logs per session).
- `enable()` → `logEvent("out_tonight_start")`, start `location.watch`.
- On each location fix → `nearestVenues` → apply hysteresis. On a newly-confident
  venue: (a) `logEvent("venue_presence", { venue_id, distance_bucket, accuracy_bucket, source:"out_tonight" })` once per venue/session; (b) set `promptVenue`
  if not already checked in there.
- `disable()` / app close → stop watch, clear prompt.
- Mode state is **session/local only** (no DB, no `intents` table) — keeps MVP
  DDL-free and PWA-clean.

### 4. UI
- **Toggle placement:** on the **Map screen** (primary going-out surface) as an
  "I'm out tonight" control — not buried in Profile. Exact affordance (pill button
  vs. switch in a sheet) is an implementation detail; the disclosure copy is not.
  *(Open for Colton: Map vs. Profile vs. both.)*
- **Confirm prompt:** a dismissible bottom prompt/toast — *"Looks like you're at
  {venue} — check in?"* with **Check in** (→ existing check-in action) and **Not
  here** (→ expands to pick from the 2–3 nearest, or dismiss). Reuses the check-in
  loop; adds no new check-in backend.

### 5. Metrics (no schema change)
All events ride the existing generic `events` table (`event_name` + `venue_id` +
`props`). New event names: `out_tonight_start`, `venue_presence`,
`out_tonight_checkin_confirmed`. **No DDL, no Supabase paste required for MVP.**

## Error handling
- **Permission denied / unsupported:** mode can't arm; explain why + link to
  re-enable; toggle reverts to off.
- **Poor accuracy (> ceiling):** don't prompt and don't log a venue; optionally log
  a coarse `accuracy_low` marker. Never guess.
- **No venue in range:** nothing happens (silent).
- **Backgrounded:** watch pauses (browser behavior) — honest limitation, documented
  in the opt-in copy ("works while ENDZ is open").
- **Analytics failures:** already fail-safe (`logEvent` never throws/blocks).

## Testing / verification (no test runner in repo)
- `venueProximity` is pure → verify with a temp harness of hand-built coord cases
  (at-venue, between-two-bars, low-accuracy, out-of-range), then remove.
- Runtime: dev server + Chrome DevTools geolocation override (`emulate`) to
  simulate standing at Grafton / between two bars / far away; confirm the prompt
  fires only when confident, logs once, and Check in creates a real check-in.
- tsc (`-p tsconfig.app.json`) + `npm run build` clean; 0 console errors.
- Independent review of the diff before anything reaches Colton or main.

## Explicitly out of scope (YAGNI / Phase 2)
- Background/native location, geofencing while closed (Phase 2).
- Declared-intent "I'm out" friend broadcast + `intents` table.
- Auto check-in without confirm (rejected — GPS false positives).
- Historical movement trails / per-user location history beyond presence events.

## Accepted risk
Dense-block GPS may still *name* the wrong neighboring bar in the prompt. Mitigated
by the confidence threshold + "Not here → pick nearest," but it won't be flawless
on day one. The real fix is Phase 2 native precision. Confirm-gating ensures a
wrong guess is never published to friends.

## Open questions for Colton's spec review
1. Toggle placement — Map screen (rec), Profile, or both?
2. `ARRIVAL_RADIUS_M` (~60m) and accuracy ceiling (~40m) — fine to tune during
   implementation, or a hard preference?
3. Confirm-prompt cadence — one prompt per venue per night, or re-prompt if you
   leave and return?
