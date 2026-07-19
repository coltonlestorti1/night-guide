# ENDZ — Session Handoff (2026-07-18)

Supersedes the 2026-07-17 handoff. Tracker: `docs/ENDZ_MASTER_TASKS.md`.

## TL;DR
**Everything is pushed and deployed.** Main is fully synced with origin; Vercel
has the live location dot, the ultrareview watcher-guard fix, and the new
**accuracy halo**. No unpushed work, no open branches, working tree clean.
Launch to random sign-in remains deliberately ON HOLD — **Google OAuth publish
is the only launch gate and Colton is intentionally not doing it yet.**

## Shipped this session (all on origin/main, deployed)
- **Ultrareview watcher-guard fix** (`Map.tsx`): auto-show effect now gates its
  permission-promise callbacks on a `cancelled` flag + `!document.hidden` —
  closed a permanent watcher-leak race and a hidden-tab battery hole.
- **Accuracy halo** (item 9 follow-up, full gate flow — spec + plan in
  `docs/superpowers/`): translucent GeoJSON circle under the user dot at the
  fix's reported accuracy in real meters. Always-on, no threshold/cap (Colton's
  call — 10% opacity is the safety valve), `#3b82f6`. Pre-style-load fixes are
  buffered and flushed on map load; halo clears with the watcher; `request()`
  now records accuracy so Locate-me paints a halo immediately.
  Live-verified with mocked geo (coarse/tight/moving fixes, zoom scaling,
  remount, no-prompt rule). Live verify caught + fixed **2 real bugs**: an
  unmount crash (map removed before the halo clear ran — fixed by nulling the
  map ref on remove) and a locate-me post-await null-map race.
- **`@types/geojson`** declared as explicit devDependency (was transitive).
- Big-halo-on-desktop is **expected** (WiFi/IP accuracy is genuinely ~200-500m);
  Colton asked, answer confirmed: not a bug, phone GPS tucks it under the dot.
- **Location-denied dialog** (item 8 denial-UX slice, full gate flow): Colton
  hit the dead-end "unavailable" toast on his iPhone (iOS had location blocked
  for Safari — root-caused live, fixed via Settings). Now explicit taps
  (Locate-me, "around me") route TRUE denials to platform-specific enable
  steps; dismissed prompts and timeouts keep honest toasts. Deep-link to OS
  settings from web = impossible (verified); Capacitor-phase upgrade noted in
  the component. Final review caught dismissed-prompt≠denied + iOS Chrome/FF
  copy; both fixed + live-verified under emulated UAs.

## Next steps (in rough priority)
1. **Colton: re-test on his iPhone** against the production deploy — location
   now enabled in iOS Settings, so expect: dot + tight GPS halo on Locate-me.
   (Optional: temporarily re-block location in Settings to see the new denial
   dialog's iOS copy in the wild.)
2. **Google OAuth publish** — still the only launch gate, still Colton's click,
   **explicitly deferred by Colton (2026-07-18: "I don't want to OAuth yet")**.
   Do not nag; wait for him to raise it.
3. **Gated discussion candidates** (product gate applies, none approved):
   items 11 (sign-up demographics), 12 (group check-in & party size),
   13 (heat map layer), plus the remaining item-8 timing/denial-UX work and
   the item-10 polish bucket.
4. **4 new venues** (Drop Off Service, Copper Still, Hidden Tiger, Chloe 81 —
   Chloe 81 dormant): Google lookups still paused. Do NOT run bulk
   `enrich resolve`.

## State facts
- 31 active venues. Supabase untouched this session. No schema changes.
- `.superpowers/sdd/` holds this session's build ledger, reports, and halo
  verification screenshots (git-ignored scratch).
- Known pre-existing console warning on the map page ("Expected value to be of
  type number, but found null" ×3): NOT from the halo — reproduced with the
  feature fully inactive; likely a venue-layer paint expression fed a null.
  Untriaged, cosmetic, logged here so nobody re-blames the halo.

## Working rules (unchanged)
Engineer/partner — lead with recommendations + honest pushback; simple numbered
steps; product-discussion gate before building anything new; verify everything
yourself (never relay a subagent's self-report). Nothing merges, pushes, or
touches Supabase without Colton's explicit OK.
