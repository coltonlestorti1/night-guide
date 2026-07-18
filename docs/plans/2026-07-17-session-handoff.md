# ENDZ — Session Handoff (updated 2026-07-17, late)

Supersedes the earlier 2026-07-17 handoff. Full detail also in Colton's
auto-memory (`endz-state-2026-07-17`) and the tracker (`docs/ENDZ_MASTER_TASKS.md`).

## TL;DR
**Live location dot (tracker items 9+8) is BUILT, reviewed, live-verified, and
MERGED to local `main` — but NOT pushed/deployed.** `main` is **13 commits ahead
of origin**, unpushed (Colton's push). Launch to random sign-in is still
deliberately ON HOLD (Colton's call); Google OAuth publish remains the launch
gate and is untouched.

## Shipped this session → merged to local main (unpushed)
- **Live user location dot** (`Map.tsx` + `store/location.ts`): Google-Maps-style
  own-dot. Auto-shows for users who ALREADY granted location (via
  `navigator.permissions.query` — never prompts on load), follows via a
  **reference-counted** `watchPosition` shared with out-tonight, pulsing halo
  (reuses `endz-pulse`). Pauses while tab hidden. No DB, client-only, coords never
  leave device, zero API cost.
- Built subagent-driven (impl + task review per task), whole-branch reviewed,
  and **live-verified in-browser with mocked geolocation** (auto-show paints on
  first fix, pulse animates, dot follows position changes). Live testing caught +
  fixed two real bugs: a visibilitychange race and a first-fix paint miss.
  tsc + build clean on `main`.

## Immediate next actions (Colton)
1. **Push `main`** (13 commits) → auto-deploys Vercel. Only then is the dot live
   in production. Nothing else is blocking the push.
2. Merged feature branch `feat/live-location-dot` still exists locally — safe to
   delete on request (fully merged).

## Recommended next build (needs Colton's go — gate)
- **Accuracy halo for the dot** (the one deferred piece of the item-9 MVP).
  Promoted to *recommended* after Colton saw a desktop dot land a block off:
  laptop browser geolocation is WiFi/IP (coarse), phone GPS is tight — NOT a bug.
  A translucent accuracy-radius around the dot communicates "approximate." Cheap.

## New tracker items added this session (NOT DISCUSSED — gate applies)
- **#11 Sign-up demographics** (gender, age, …) — needs `profiles` schema change +
  privacy disclosure; ties to onboarding #7 + age personalization.
- **#12 Group check-in & party size** — check in with friends; "how many in your
  party?"; party size feeds the live crowd count (touches the protected check-in
  loop + `activity` aggregation — careful gate).
- **#13 Heat map layer** — first decide what "heat" means (live crowd vs
  historical vs friends); MapLibre has a native heatmap layer, meaning/scope is
  the work.

## Still on hold / unchanged
- **Google OAuth publish** = launch gate (Colton's click). Random sign-in HELD.
- **4 new venues** (Drop Off Service, Copper Still, Hidden Tiger, Chloe 81 —
  Chloe 81 dormant): Google lookups still paused. Do NOT run bulk `enrich resolve`.
- 31 active venues.

## Working rules (unchanged)
Engineer/partner — lead with recommendations + honest pushback; simple numbered
steps; product-discussion gate before building anything new; verify everything
yourself (never relay a subagent's self-report). Nothing merges, pushes, or
touches Supabase without Colton's explicit OK.
