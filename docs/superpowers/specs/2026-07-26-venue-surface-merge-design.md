# Venue Surface Merge — one card, no "View Details" hop

**Date:** 2026-07-26
**Tracker item:** §19 Map Product Review — slice 1
**Status:** SPEC — awaiting Colton's review
**Raised by:** Colton ("get rid of the view details and make it one bar card")

---

## Problem

Tapping a pin opens a venue sheet. The sheet ends in a **View Details** button that
navigates to `/venue/:id` — a full page that re-renders most of the sheet.

Audit of the two surfaces:

| Element | Sheet (`VenuePreview`) | Detail page (`VenueDetail`) |
|---|---|---|
| Hero image + hot/editor badges | ✅ | ✅ (taller) |
| Title / category / neighborhood | ✅ | ✅ |
| Save | ✅ (icon) | ✅ (sticky bar) |
| Quick info (open · rating · price · HH) | ✅ | partial (open-now pill) |
| **Friends here** | ✅ | ❌ |
| **Plans here** | ✅ | ❌ |
| Stat tiles | ✅ | ✅ (same component) |
| Check-in card | ✅ | ✅ (same component) |
| Directions | ✅ | ✅ |
| Popular Times chart | ❌ | ✅ |
| Specials | ❌ | ✅ |
| About (description / Google summary) | ❌ | ✅ |
| Info card (weekly hours, phone, website, reviews) | ❌ | ✅ |
| Plan a night here | ❌ | ✅ (signed-in) |

The page is a near-duplicate render whose genuine additions are a paragraph, a
phone number, a website link, the full week's hours, and a plan button.

Two of its five unique sections **render for zero venues**:

| Detail-only section | Venues with data (of 56) |
|---|---|
| Popular Times chart | **0** — serpapi source never ran |
| Specials | **0** — `specials.json` is `{}` |
| About (description or `editorialSummary`) | 41 |
| Phone | 39 |
| Website | 50 |
| Weekly hours | 56 |

The hop also costs: a navigation transition, a scroll-position restore, the
`mapState` viewport-persistence store, and the `fromMap` location-state flag
added on 2026-07-26 purely to make the back button return to the sheet.

And the deeper surface has **less** social signal than the shallow one — no
friends-here, no plans-here.

---

## Decision

**One venue component, three containers, one tap to go deeper.**

Everything the detail page shows moves into `VenuePreview`, behind a single
inline expandable section. The route survives as a container, not a second
implementation.

### 1. Collapsed state — unchanged

The sheet opens at the same height with the same content it has today. Tapping a
pin must stay a glance; nothing about the first impression regresses.

### 2. "More info" expander

Below the Directions / primary action row, a full-width row:

```
┌─────────────────────────────────────────┐
│  More info                            ⌄ │
└─────────────────────────────────────────┘
```

Tap → expands **in place** (no navigation, no nested sheet), revealing in order:

1. About (`venue.description` ?? Google `editorialSummary`, with the existing
   "Description: Google" attribution when it falls back)
2. `VenueInfoCard` — weekly hours (its own existing collapsible), happy hour
   schedule, price, rating + review count, phone, website, Google attribution
3. Popular Times chart — **carried over unchanged, still gated on data**
4. Specials — **carried over unchanged, still gated on data**
5. "Plan a night here" (signed-in only)

The chevron rotates. Label toggles to "Less info" when open.

**Renders nothing if there is nothing to show.** If a venue has no description,
no enrichment, no specials and the user is signed out, the expander row itself
does not render — same dead-end rule the filter chips follow (§27).

### 3. Rejected: drag-to-expand snap points

vaul 0.9.9 supports `snapPoints`, and a two-stop drag sheet is the Google/Apple
Maps idiom. Not doing it:

- **Gesture collision.** The sheet contains buttons, friend rows, and plan rows
  that open nested dialogs. This repo has already shipped two vaul drag-capture
  bugs from exactly that surface (2026-07-20 datetime-local input, fixed with
  `data-vaul-no-drag`, then retired by converting the sheet to a Dialog).
- **Discoverability.** A labeled tap target is findable by everyone. A second
  snap point is findable only by users who try dragging up, and it competes with
  the map's own pan gesture at the sheet edge.
- **Reversible.** If the tap row proves wrong, snap points can be added later on
  top of this structure. The reverse — unpicking a gesture from a merged
  component — is harder.

Drag keeps its current single meaning: **drag the handle to dismiss.**

### 4. Drawer scroll fix (required, not optional)

`DrawerContent` is currently:

```
fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col
```

`h-auto` with no `overflow-y`. Content taller than the viewport clips off the
top and is unreachable. Today's sheet fits on most phones; the expanded one will
not.

Fix, scoped to the venue drawer (not the shared `drawer.tsx` primitive, which
other sheets depend on):

- `max-h-[85svh]` on the venue `DrawerContent`
- the `VenuePreview` body wrapped in an `overflow-y-auto` region
- grabber handle and header stay pinned outside the scroll region

`svh` (not `vh`) so mobile browser chrome doesn't cut the bottom action row off.

### 5. Container matrix

| Container | Expander default | Notes |
|---|---|---|
| Mobile drawer (map) | **collapsed** | glance-first |
| Desktop right panel (map) | **open** | already full-height + `overflow-y-auto`; vertical room to spare |
| `/venue/:id` full page | **open** | user navigated deliberately — don't make them tap twice |

### 6. Route: kept

`/venue/:id` stays and renders `VenuePreview` inside a full-screen container.

Three surfaces link to it and are not being rewired:
- `SavedSpotsList.tsx:61`
- `Discover.tsx:64,66` (HappyHourRail + WeekendFavorites picks)
- `social/PlanDetailSheet.tsx:305`

`VenueDetail.tsx` shrinks to a thin shell around `VenuePreview`.

**It keeps no hero of its own.** `VenuePreview` already renders a hero with
badges and a corner button; on the page that corner button becomes Back instead
of Close (same `onClose` prop, different handler). Two heroes stacked would be
the same duplication this merge exists to remove.

Its sticky bottom Save/Directions bar is also removed — both actions live in the
component now, and two Directions buttons on one screen is precisely the bug
being killed.

What remains in `VenueDetail.tsx`: the `useVenue` fetch, the loading skeleton,
the not-found state, and `<VenuePreview venue={data} onClose={goBack}
defaultExpanded />` in a page-width container.

### 7. `fromMap` deleted

The 2026-07-26 `fromMap` flag and the `goBack()` special case in
`VenueDetail.tsx:28-34` exist only to make the back button return to the map
sheet after the hop. With no hop from the map, the flag has no callers.

`VenuePreview.tsx:119` (the only site that sets it) is the button being removed.
Back becomes plain `navigate(-1)` for the remaining entry points, which is what
Discover / Saved / Plans already got.

`store/mapState.ts` (viewport persistence) **stays** — those three entry points
still navigate away from and back to the map.

---

## Out of scope (deliberate)

- **Popular Times and Specials are carried over verbatim.** Both render for 0/56
  venues. Colton is giving direction on them separately; this spec does not
  delete, revive, or restyle them.
- The rest of §19 (pin crowding, icon clarity, activity rings, legend, list-view
  images, neighborhood zones) — this is slice 1 only.
- No schema change, no Supabase change, no new data source.
- No visual redesign of the tiles, cards, or hero. This is a structural merge;
  restyling is §10/§19 later slices.

---

## Acceptance criteria

1. Tapping a map pin opens a sheet showing **the same content as today** above
   the fold — hero, header, quick info, friends, plans, tiles, check-in,
   Directions — with only the collapsed "More info" row added below it.
2. The sheet has **no "View Details" button**.
3. A "More info" row expands in place to reveal About, hours, phone, website,
   and (signed-in) "Plan a night here" — without navigating.
4. A venue with no description, no enrichment and no specials shows **no
   expander row at all** when signed out.
5. The expanded sheet **scrolls** and its bottom action row remains reachable on
   a 667px-tall viewport (iPhone SE).
6. Dragging the sheet handle down still dismisses it; no drag gesture expands it.
7. Desktop right panel shows the section **already open** and scrolls.
8. `/venue/:id` still loads from Discover, Saved spots, and a plan link, shows
   the section open, and its back button returns to the originating surface.
9. Friends-here and plans-here rows now appear on `/venue/:id` (they did not
   before).
10. Exactly **one** Directions button and **one** Save affordance per screen, in
    every container.
11. `grep -rn "fromMap" src` returns zero hits.
12. `npx tsc --noEmit -p tsconfig.app.json` clean; production build clean; the
    37-assertion behavior harness green.

---

## Files touched

| File | Change |
|---|---|
| `src/components/VenuePreview.tsx` | absorbs About / InfoCard / PopularTimes / Specials / Plan button behind a new expander; `View Details` button + `fromMap` navigate removed; `defaultExpanded` prop |
| `src/pages/VenueDetail.tsx` | shrinks to hero + back + `VenuePreview defaultExpanded`; sticky Save/Directions bar and `goBack` `fromMap` branch deleted |
| `src/pages/MapPage.tsx` | venue `DrawerContent` gains `max-h-[85svh]`; desktop panel passes `defaultExpanded` |

New: a small `VenueMoreInfo` section component if `VenuePreview` grows past
readable size — decided during planning, not pre-committed here.

---

## Risks

- **Sheet feels heavier than it is.** Mitigated by the collapsed state being
  byte-identical to today's and by rule 4 (no expander when there's nothing).
- **Scroll region vs. vaul drag.** The internal `overflow-y-auto` must not
  swallow the handle's dismiss drag. vaul handles nested scroll natively, but
  this is the repo's known-fragile area and gets an explicit live test on a real
  phone viewport, not just a desktop emulation.
- **Stale service worker.** `/sw.js` serves stale JS — unregister before live
  testing (standing gotcha, logged 2026-07-21).
