# ENDZ — Premium UI Polish (Map-First) — Design

**Date:** 2026-07-07
**Status:** Draft for review
**Scope owner:** Colton
**Approach:** System/token pass + hand-built map chrome refinement (21st.dev held in reserve for ≤1 hero component). No new paid tools; everything free.

---

## Goal

Make ENDZ read as a premium, professional, "social-media-grade" nightlife app — without a rebuild. The current UI is ~80% there (dark violet theme, `.glass` blur, decent `BarCard`). The premium jump is **system cohesion** (typography, spacing, elevation, motion, consistent iconography), concentrated on the **map** — the hero surface — plus the **"Find the move" (VibeFinder)** flow.

## Non-goals (explicitly out of scope this round)

- No changes to MapLibre marker geo-anchoring / `addMarkers` positioning logic (handoff hard rule).
- No redesign of Discover, Profile, Social, VenueDetail (map-first this round).
- No copy or feature changes — visual only.
- Map **pin glyphs** (🍺 🍸 🪩) stay as-is (user decision).
- Pin *tier styling* (glow/scale) is stretch-only and marker-adjacent — treat carefully, cut if risky.

---

## Section A — Design system (shared tokens)

Edits to `src/index.css` (+ `tailwind.config.*` where tokens must be referable as utilities). This is the highest-leverage, lowest-risk work — it lifts every surface at once.

1. **Elevation ladder.** Replace the single `--card` surface with a 3-step scale: base (`--background`) → card → raised-sheet, each progressively lighter, so drawers/dropdowns visibly float instead of blending in.
2. **Glass, upgraded.** Extend the `.glass` utility with a 1px inset top highlight (`border-t` at ~`white/8`) + `backdrop-saturate`. The faint top edge is the single biggest "expensive UI" cue.
3. **Elevation + glow tokens.** Introduce named `--shadow-float`, `--shadow-sheet`, and `--glow-live` (violet halo), replacing ad-hoc `shadow-md shadow-primary/30` usages so active/live states are consistent.
4. **Motion tokens.** Standard durations + easing (≈150ms ease-out for taps, spring-ish for sheet entrance). Confirm/define the `animate-fade-in` keyframe already referenced in code.

## Section A2 — Typography

Currently **no font is configured** — the app renders in the OS system stack (SF/Roboto/Segoe), which reads generic and differs per device. Fix:

- **Body / UI → Inter**, self-hosted via `@fontsource/inter`. Engineered for small text on dark; this is the "social app" workhorse.
- **Display (ENDZ wordmark + section titles / venue names) → Clash Display**, self-hosted (Fontshare files). Default pick; swappable in one place if disliked (Space Grotesk / General Sans are the alternates considered).
- Define a **type scale**: display / h1 / h2 / body / caption / overline, each with set weight, tracking, line-height. Replace ad-hoc `text-sm`/`text-xs` sprinkling with scale classes.
- Self-hosted for device consistency, PWA offline support, and no Google-Fonts CDN call. ~30–40kb per weight; load only the weights used.
- Wire fonts into tailwind `fontFamily` (`font-sans` = Inter, `font-display` = Clash Display) so usage is `font-display` on the wordmark/titles.

## Section B — Icon system (de-emoji the chrome)

One shared icon map, all **lucide** line icons at a consistent size (`h-4 w-4`), replacing emoji **everywhere in the chrome**. Map pins are the only place emoji stay.

Replacements:

| Location | Emoji → lucide |
|---|---|
| VibeFinder title | `✨` → `Sparkles` (or drop) |
| VibeFinder vibe | Chill→`Sofa`, Lively→`TrendingUp`, Packed→`Flame` |
| VibeFinder drinks | Cheap beers→`Beer`, Cocktails→`Martini`, Whatever→`Shuffle` |
| VibeFinder when | Right now→`Zap`, Later tonight→`Moon` |
| Map filter chips | Hot→`Flame`, Music→`Music`, Find the move→`Sparkles`/`Compass`, Happy hour→`Wine` |
| VenueQuickInfo | `🥂`→`Wine`; open-state `●` stays as a colored status dot (not emoji) |

Map pins keep 🍺/🍸/🪩 — untouched (user decision).

## Section C — Map chrome (priority surface)

All hand-built with existing shadcn primitives + lucide. No marker code touched. Files: `src/pages/MapPage.tsx` (`TopHeader`, `FilterChips`, Map/List toggle, venue bottom-sheet drawer), `src/components/VenueQuickInfo.tsx`, `src/components/VibeFinder.tsx`.

1. **Search (`TopHeader`).** Upgraded glass, focus glow ring, larger tap target, elevated dropdown rows using the new elevation ladder.
2. **Filter chips (`FilterChips`).** Icon + label, refined active glow (`--glow-live`), edge scroll-fade masks so the row looks designed rather than cut off.
3. **Map/List toggle.** True segmented control with an animated sliding active indicator instead of an instant color flip.
4. **Venue bottom sheet (drawer in `MapPage`).** Legibility gradient over the hero image, tighter spacing rhythm on the type scale, refined badges + drawer grab-handle, smooth entrance motion. **Also fix the known DrawerTitle a11y warning** (from Known Debt) while in here.
5. **VibeFinder.** Apply the icon system + type scale + refined chip/CTA styling (matches the polished filter chips). Keep the 3-tap flow intact.
6. **Legibility scrim.** Ensure floating controls/text always have contrast over bright map areas (top gradient exists; verify bottom).

## Section D — 21st.dev reserve

Approach 1 is hand-built. If — and only if — a single surface (likely the animated bottom-sheet or the segmented search) is clearly better served by a premium prebuilt component, spend **one** of the 2 daily free `get_component` pulls on it and adapt to tokens. Do not spend pulls before the cheap system lift is done.

## Section E — Verification

1. `npx tsc --noEmit -p tsconfig.app.json` (the real typecheck — bare `npx tsc` is a silent no-op here).
2. `npm run build`.
3. Playwright browser pass on the map screen (search, chips, toggle, open a venue sheet, open VibeFinder).
4. Before/after screenshots of each touched surface for eyeball review.

## Risks / mitigations

- **Marker breakage:** mitigated by not touching `addMarkers`/positioning; only overlay DOM + CSS.
- **Font weight bloat:** load only used weights; measure bundle after.
- **Token refactor regressions:** the elevation/glass changes touch shared utilities — verify every surface visually via screenshots, not just the map.
- **Scope creep into other screens:** hard-stop at map + VibeFinder + shared tokens this round.

## Rollout

Single feature branch (`polish/map-premium` suggested), spec committed first, then implementation per the plan produced by the writing-plans step. Merge strategy (main-line vs PR) TBD with user — CodeRabbit was declined, so no PR is required.
