# Design pass: Discover / Social / Profile (2026-07-16)

Visual-only pass on the three non-map tab routes. Direction: **elevate with
personality** — real hierarchy and nightlife energy without a layout teardown.
No feature, data, route, hook, store, or dependency changes; components keep
identical props and behavior.

## The system

One shared signature ties the three pages together and back to `/join`:
a **marquee header** — tiny letter-spaced eyebrow in a page accent, a
`font-display` (Space Grotesk) title, and a soft radial "light spill" behind
the header (the same ambient-glow device `/join` uses). Each page pulls its
accent from the existing activity palette, so chrome stays light/neutral and
nightlife activity supplies the color:

| Page | Eyebrow | Accent |
|---|---|---|
| Discover | `TONIGHT'S LINEUP` | `--trending` orange (text amber-700 for contrast) |
| Social | `YOUR CREW` | `--friends` emerald (text emerald-700) |
| Profile | `YOU ON THE MAP` | `--primary` ENDZ purple |

## Per page

### Discover (`src/pages/Discover.tsx`, `HappyHourRail.tsx`, `WeekendFavorites.tsx`)
- Marquee header + orange light spill.
- Segmented toggle: glass container, icons (Wine / MoonStar), taller active
  pill keeps `bg-primary + shadow-glow`. `aria-pressed` preserved, added a
  visible focus ring.
- Day chips in both rails: black **marquee pills** for the active day
  (`bg-foreground text-background`) — a distinct control level below the
  purple toggle. `role=tab` / `aria-selected` untouched.
- Active happy-hour line ("🥂 til 1 AM") is now an amber chip; inactive lines
  unchanged muted text.
- Weekend anchor slot label `text-amber-500 → text-amber-700` (matches the
  earlier WCAG amber fix); other slot labels `text-primary/80 → text-primary`.
- Tab content cross-fades on switch (`key={tab}` + `animate-fade-in`).
- Designed empty state (amber icon circle + directive copy).

**Before / after**
- `assets/design-pass-2026-07-16/before-discover-happy.png` → `after-discover-happy.png`
- `assets/design-pass-2026-07-16/before-discover-weekend.png` → `after-discover-weekend.png`

### Social (`src/pages/Social.tsx`, `social/ShareHandleCard.tsx`)
- Marquee header + emerald light spill; subtitle now "See who's out tonight —
  and where." (was a duplicate of the Profile signed-out headline).
- `SectionCard` (page-local layout helper) grew an icon chip + optional badge:
  - **Requests** — purple UserPlus chip, `{n} new` badge for incoming.
  - **Out tonight** — emerald MapPin chip; when friends are out, a pulsing
    live dot + `{n} out now` (`motion-reduce:animate-none`).
  - **Find friends** — purple Search chip.
  - **Your friends** — neutral Users chip.
- Share-handle card tinted `primary-soft` (was plain gray).
- Signed-out card: icon circle + `font-display` headline + glow CTA.
- Row components, section order, Blocked collapsible, and all behavior
  unchanged.

**Before / after**
- `assets/design-pass-2026-07-16/before-social-signedout.png` → `after-social-signedout.png`
- `assets/design-pass-2026-07-16/before-social-signedin.png` → `after-social-signedin.png`

### Profile (`src/pages/Profile.tsx`)
- Marquee header + purple light spill.
- Signed-in card: **cover band** in the ENDZ wordmark gradient
  (`from-primary to-rose-400`) with a faint ENDZ watermark; avatar overlaps
  the band (`-mt-10 ring-4 ring-card`); name set in `font-display`.
- **Ghost mode** block: now an inset `bg-secondary/60` panel with a Ghost
  icon chip that tints purple when ghost mode is ON and neutral when OFF —
  purely presentational read of `profile.ghost_mode`. The `Switch`, its
  `aria-label="Ghost mode"`, copy, and `setGhostMode` call are untouched.
- Signed-out card: MapPin icon circle, `font-display` headline, `shadow-glow`
  Google CTA (mirrors `/join`'s form CTA).
- Loading skeleton mirrors the new card shape (band + overlapped circle).
- DevSettings untouched.

**Before / after**
- `assets/design-pass-2026-07-16/before-profile-signedout.png` → `after-profile-signedout.png`
- `assets/design-pass-2026-07-16/before-profile-signedin.png` → `after-profile-signedin-ghost-on.png`, `after-profile-signedin-ghost-off.png`, `after-profile-loading.png`

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — exit 0.
- `npm run build` — clean (pre-existing chunk-size warning only).
- Loaded `/discover`, `/social`, `/profile` on the dev server at 390×844.
  Signed-out and loading states exercised directly. Signed-in states
  exercised by injecting auth-store state and stubbing the friendships /
  active_check_ins / suggested-profiles responses in the browser console
  (no code changes) — all Social sections and both ghost-mode states were
  rendered and screenshotted. 0 console errors (only the two pre-existing
  React Router v7 future-flag warnings). No horizontal overflow from the
  header glows.
- Not verified live: real Google OAuth sign-in (no credentials in this
  environment) and real friend data — signed-in rendering was verified with
  injected state as above.

## Flagged, not changed (behavior, not styling)

- **BarCard placeholder art** — venues without `image_url` show the flat
  "Bar/Club/Lounge" SVG placeholder, which is the plainest thing on Discover
  now. The placeholder is a data-URI constant inside `BarCard.tsx`; swapping
  it for category-gradient art would touch a component shared with the map
  flow, so left alone.
- **Emoji metadata glyphs in BarCard** (📍 🎵 ⚡ ●) read slightly
  off-system next to the lucide icon language; replacing them is shared-
  component surface beyond this brief.
- **Social "Out tonight" placement** — spec order puts Requests above the
  payoff section; a product call, not a styling one.
