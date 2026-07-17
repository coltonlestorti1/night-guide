# Fable brief — design pass on Discover / Social / Profile

**For:** a Fable 5 build agent. **From:** Colton (via Opus, his engineer).
**Status:** brief only — not approved to merge. Build on a branch; Opus reviews
+ independently verifies before anything reaches Colton or `main`.

## Goal
Give **Discover**, **Social**, and **Profile** an individual visual design pass.
In the July 2026 light social-app redesign (PR #1) these three routes received
the token flip but **no per-page design attention** — they're functional but
plain. Make them feel intentional and on-brand, matching the polish of the map
screen and `/join`. **Visual only. No behavior, data, routing, or schema changes.**

## Current state (audited 2026-07-16, accurate — don't re-fabricate)
- `src/pages/Discover.tsx` (64 ln): header + segmented Happy Hours | Weekend
  Favorites toggle (`bg-secondary` pill) → renders `HappyHourRail` or
  `WeekendFavorites`. Skeletons on load, `glass` empty state.
- `src/pages/Social.tsx` (141 ln): header → Requests → Out tonight → Find friends
  → Your friends → Blocked (collapsible). Thin composition over
  `src/components/social/*`. Signed-out shows a `glass` prompt. `SectionCard` =
  `rounded-3xl border border-border bg-card p-4`.
- `src/pages/Profile.tsx` (118 ln): header + one `glass rounded-3xl` card
  (loading / signed-out / signed-in states) + a collapsible "Developer settings".

## Design language (already in the repo — reuse, don't reinvent)
- Tokens live in `src/index.css` `:root`: light/warm/neutral palette,
  `--primary`, `--primary-soft`, `--hot`, `--trending`, `--friends`, plus
  `.glass` (frosted white), `shadow-glow`, `animate-fade-in`.
- Fonts: `font-display` = Space Grotesk (headings), Inter (body). Tailwind config
  `tailwind.config.ts`. Icons: lucide. Rounding trends `rounded-2xl`/`3xl`.
- Nightlife activity supplies the color; chrome stays light/neutral. Pin activity
  colors (gray/orange/pink/purple) are a real system — echo them if useful, don't
  fight them.

## Hard rules (non-negotiable)
1. **No feature, data, route, schema, package, or store changes.** No new deps.
   Presentation only — JSX/className/tokens. If a change tempts you beyond
   styling, stop and note it for Colton instead.
2. Don't touch the check-in loop, auth, RLS, or any `src/lib`/`src/hooks`/`store`
   logic. Components under `src/components/social/*` may get styling love but keep
   their props + behavior identical.
3. Keep it accessible: the July redesign did a WCAG contrast pass (amber→amber-700,
   status→emerald-700). Don't regress contrast. Preserve `aria-pressed`, labels,
   focus states.
4. **Verify, then stop.** tsc + build clean, 0 console errors, and you must
   **actually load** `/discover`, `/social`, `/profile` in a browser and confirm
   they render — these are non-map routes, so screenshots DO work here (unlike the
   MapLibre map route). Verify signed-out AND signed-in states where relevant.
5. Branch only (e.g. `feat/design-pass-social`). **Do not merge, do not push, do
   not touch Supabase.** Small, reviewable commits.

## Acceptance criteria
- Each of the 3 pages reads as deliberately designed, consistent with the map
  screen / `/join`, using existing tokens.
- Zero behavioral diff: same sections, same data, same interactions.
- tsc (`npx tsc --noEmit -p tsconfig.app.json`) + `npm run build` clean.
- Browser-loaded proof for all 3 routes, 0 console errors, both auth states.
- A short notes file: what changed per page + before/after screenshots.

## What to hand back
Branch name, commit list, the notes file, and any "I wanted to change X but it's
behavior not styling — flagging for Colton" items. Opus will check out the branch,
read the real diff, re-run tsc/build, and re-verify before green-lighting.
