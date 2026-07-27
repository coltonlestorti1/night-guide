# Venue Surface Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "View Details" navigation hop so a venue is one card — the map sheet gains an in-place "More info" expander holding everything `/venue/:id` used to add, and the page becomes a thin container around the same component.

**Architecture:** `VenuePreview` becomes the single venue surface. A new `VenueMoreInfo` component holds the deeper layer (About, info card, popular times, specials, plan button). `VenuePreview` gains two props — `defaultExpanded` and `closeIcon` — which are the only differences between the three containers (mobile drawer, desktop panel, full page). `VenueDetail` shrinks from 201 lines to a fetch + skeleton + not-found shell.

**Tech Stack:** React 18, TypeScript, Vite, react-router-dom, vaul 0.9.9 (mobile drawer), Radix Sheet (desktop panel), Tailwind, Zustand, lucide-react.

## Global Constraints

- **No test framework exists in this repo.** No vitest/jest, no `*.test.*` files, no test dependency. The only committed test is `node scripts/enrich-venues.mjs test` (Places transform fixture, unrelated). Do **not** add a test runner — out of scope. Behavior is verified by the live browser matrix in Task 6.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`. **Bare `npx tsc` is a silent no-op** (CLAUDE.md).
- **Popular Times and Specials are carried over verbatim.** Both render for 0/56 venues today. Do not delete, revive, restyle, or gate them differently. Colton is giving separate direction.
- No schema change, no Supabase change, no new data source, no new npm dependency.
- No visual redesign of tiles, cards, hero, or typography. This is a structural merge.
- Do **not** modify `src/components/ui/drawer.tsx` — the shared primitive is used by other sheets. Scope drawer changes to the venue `DrawerContent` in `MapPage.tsx`.
- `store/mapState.ts` **stays** — Discover / Saved / Plans still navigate away from the map and back.
- Google attribution lines are required wherever enrichment renders (Google ToS) — preserve them verbatim when moving code.
- Commit after each task. Branch is `feat/venue-surface-merge`, already cut, spec already committed at `996395e`.

---

### Task 1: `hasMoreInfo` — the dead-end guard

The expander row must not render when it would open onto nothing. This mirrors the rule §27 established for filter chips: never offer an affordance that leads to an empty result.

**Files:**
- Modify: `src/lib/venueTraits.ts` (append; keep existing exports untouched)

**Interfaces:**
- Consumes: `getEnrichment`, `getSpecials` from `@/data/enrichment` (`getEnrichment` is already imported at line 7; `getSpecials` is not — add it to that import).
- Produces: `hasMoreInfo(v: Venue, signedIn: boolean): boolean` — consumed by Task 3.

- [ ] **Step 1: Add `getSpecials` to the existing enrichment import**

Line 7 of `src/lib/venueTraits.ts` currently reads:

```ts
import { getEnrichment } from "@/data/enrichment";
```

Change to:

```ts
import { getEnrichment, getSpecials } from "@/data/enrichment";
```

- [ ] **Step 2: Append `hasMoreInfo` to the end of the file**

```ts
/**
 * Does this venue have anything behind "More info"?
 *
 * Must stay in lockstep with what VenueMoreInfo actually renders — if this
 * returns false the expander row does not render at all. Same dead-end rule
 * §27 applies to filter chips: never offer an affordance that opens onto
 * nothing.
 *
 * Signed-in users always have "Plan a night here", so the section always has
 * at least one row for them.
 *
 * getEnrichment() returns undefined for expired (>30d) records, so a venue
 * whose data has gone stale loses the expander rather than showing an empty
 * shell — the same "go quiet rather than assert" rule as hasOutdoorSeating.
 */
export function hasMoreInfo(v: Venue, signedIn: boolean): boolean {
  if (signedIn) return true;
  return Boolean(
    v.description || getEnrichment(v.title) || getSpecials(v.title).length > 0,
  );
}
```

Note: `getEnrichment(v.title)` truthy is sufficient for the enrichment branch — `VenueInfoCard` renders content for *any* enrichment record, and both the About fallback (`editorialSummary`) and `popularTimes` live inside that same record.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no output (clean exit).

- [ ] **Step 4: Commit**

```bash
git add src/lib/venueTraits.ts
git commit -m "feat(venue): add hasMoreInfo dead-end guard for the More info expander"
```

---

### Task 2: `VenueMoreInfo` — the deeper layer, extracted

Everything that lived only on `/venue/:id` moves into one component so both containers share an implementation.

**Files:**
- Create: `src/components/VenueMoreInfo.tsx`
- Reference (read, do not modify): `src/pages/VenueDetail.tsx:111-153` — the source of the JSX being moved

**Interfaces:**
- Consumes: `hasMoreInfo` is *not* used here (the caller guards). Uses `getEnrichment`, `getSpecials`, `useAuthStore`, `VenueInfoCard`, `PopularTimesChart`, `CreatePlanSheet`.
- Produces: `default export VenueMoreInfo({ venue }: { venue: Venue })` — consumed by Task 3.

- [ ] **Step 1: Create the component**

```tsx
/**
 * The deeper venue layer — everything that used to live only on /venue/:id.
 * Rendered inside VenuePreview behind the "More info" expander, so the map
 * sheet, the desktop panel and the standalone page all share one
 * implementation instead of three near-duplicate renders.
 *
 * Render guard lives in the caller (hasMoreInfo) so the expander row itself
 * can be hidden — this component assumes it has something to show.
 */
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Venue } from "@/data/types";
import { Button } from "@/components/ui/button";
import { getEnrichment, getSpecials } from "@/data/enrichment";
import { useAuthStore } from "@/store/auth";
import VenueInfoCard from "@/components/VenueInfoCard";
import PopularTimesChart from "@/components/PopularTimesChart";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";

export default function VenueMoreInfo({ venue }: { venue: Venue }) {
  const status = useAuthStore((s) => s.status);
  const [planOpen, setPlanOpen] = useState(false);

  const e = getEnrichment(venue.title);
  const specials = getSpecials(venue.title);
  const about = venue.description ?? e?.editorialSummary;

  return (
    <div className="space-y-4 pt-3">
      {about && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            About
          </h3>
          <p className="text-sm leading-relaxed text-foreground/90">{about}</p>
          {!venue.description && (
            <p className="text-[10px] text-muted-foreground/70 mt-1">Description: Google</p>
          )}
        </div>
      )}

      <VenueInfoCard venue={venue} />

      {/* Carried over unchanged — renders for 0/56 venues today (the serpapi
          popular-times source was never run). Kept, not deleted, pending
          Colton's direction. */}
      {e?.popularTimes && <PopularTimesChart data={e.popularTimes} />}

      {/* Carried over unchanged — specials.json is currently {} for all
          venues. Kept, not deleted, pending Colton's direction. */}
      {specials.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Specials
          </h3>
          <ul className="space-y-2">
            {specials.map((s) => (
              <li key={s.title} className="rounded-xl bg-secondary/60 p-3">
                <p className="text-sm font-medium">{s.title}</p>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "signedIn" && (
        <>
          <Button
            variant="secondary"
            className="w-full h-11 rounded-xl"
            onClick={() => setPlanOpen(true)}
          >
            <CalendarClock className="h-4 w-4 mr-2" /> Plan a night here
          </Button>
          <CreatePlanSheet
            open={planOpen}
            onOpenChange={setPlanOpen}
            initialVenueId={venue.id}
            surface="venue"
          />
        </>
      )}
    </div>
  );
}
```

Three deliberate changes from the `VenueDetail` original:

1. `<h2>` → `<h3>`. `VenuePreview` already owns an `<h2>` for the venue title; these are subsections of it, and the drawer's `DrawerTitle` is the `<h1>`-equivalent landmark.
2. Order is About → Info → Popular Times → Specials (was Popular Times → Specials → About → Info). The reference info a user actually wants — hours, phone, website — now sits directly under About instead of below two sections that render for nobody.
3. `CreatePlanSheet` moved *inside* the `signedIn` guard. `VenueDetail` mounted it unconditionally; a signed-out user has no way to open it, so mounting it was dead weight.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no output.

If `CreatePlanSheet`'s prop names differ from the above, read `src/components/social/CreatePlanSheet.tsx` and match its actual signature — do not change the component, change this call.

- [ ] **Step 3: Commit**

```bash
git add src/components/VenueMoreInfo.tsx
git commit -m "feat(venue): extract VenueMoreInfo — the deeper layer, shared by sheet and page"
```

---

### Task 3: Wire the expander into `VenuePreview`, drop "View Details"

**Files:**
- Modify: `src/components/VenuePreview.tsx`

**Interfaces:**
- Consumes: `hasMoreInfo` (Task 1), `VenueMoreInfo` (Task 2).
- Produces: `VenuePreview({ venue, onClose, defaultExpanded, closeIcon })` where
  `defaultExpanded?: boolean` (default `false`) and
  `closeIcon?: "close" | "back"` (default `"close"`) — consumed by Tasks 4 and 5.

Two independent props rather than one `variant`, because the three containers need three different combinations:

| Container | `defaultExpanded` | `closeIcon` |
|---|---|---|
| Mobile drawer | `false` | `close` |
| Desktop panel | `true` | `close` |
| Full page | `true` | `back` |

- [ ] **Step 1: Update imports**

Replace the import block at lines 7-20 with:

```tsx
import { useEffect, useState } from "react";
import { MapPin, X, ArrowLeft, ChevronDown, Bookmark, Flame, Star } from "lucide-react";
import { Venue } from "@/data/types";
import { logEvent } from "@/lib/analytics";
import { useSavedStore } from "@/store/saved";
import { useAuthStore } from "@/store/auth";
import { hasMoreInfo } from "@/lib/venueTraits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import VenueStatTiles from "@/components/VenueStatTiles";
import CheckInCard from "@/components/CheckInCard";
import DirectionsButton from "@/components/DirectionsButton";
import VenueQuickInfo from "@/components/VenueQuickInfo";
import VenueMoreInfo from "@/components/VenueMoreInfo";
import FriendsHereRow from "@/components/FriendsHereRow";
import PlansHereRow from "@/components/PlansHereRow";
```

`useNavigate` and its `react-router-dom` import are **removed** — the only navigation this component did was the View Details hop.

- [ ] **Step 2: Update the signature and add state**

Replace lines 22-25:

```tsx
export default function VenuePreview({
  venue,
  onClose,
  defaultExpanded = false,
  closeIcon = "close",
}: {
  venue: Venue;
  onClose: () => void;
  /** Desktop panel and the full page open expanded — they have the room, and
      on the page the user navigated here deliberately. */
  defaultExpanded?: boolean;
  /** The page reuses onClose as "go back", so the glyph has to follow. */
  closeIcon?: "close" | "back";
}) {
  const { ids: savedIds, toggle: toggleSaved } = useSavedStore();
  const saved = savedIds.includes(venue.id);
  const signedIn = useAuthStore((s) => s.status) === "signedIn";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showMore = hasMoreInfo(venue, signedIn);
```

- [ ] **Step 3: Swap the hero corner glyph**

At line 54, replace:

```tsx
          <X className="h-4 w-4 text-white" />
```

with:

```tsx
          {closeIcon === "back" ? (
            <ArrowLeft className="h-4 w-4 text-white" />
          ) : (
            <X className="h-4 w-4 text-white" />
          )}
```

And update that button's `aria-label` (line 52) from `"Close"` to:

```tsx
          aria-label={closeIcon === "back" ? "Back" : "Close"}
```

- [ ] **Step 4: Replace the two-button action grid with Directions + expander**

Replace lines 107-122 (the `{/* Actions */}` block, from `<div className="grid grid-cols-2 gap-2 mt-4">` through its closing `</div>`) with:

```tsx
      {/* Actions */}
      <div className="mt-4">
        <DirectionsButton
          title={venue.title}
          venueId={venue.id}
          latitude={venue.latitude}
          longitude={venue.longitude}
          className="h-11 rounded-xl w-full"
        />
      </div>

      {/* The deeper layer, in place — this replaced a "View Details" button
          that navigated to /venue/:id and re-rendered most of this component.
          Hidden entirely when there is nothing behind it (hasMoreInfo). */}
      {showMore && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="w-full h-11 rounded-xl bg-secondary/60 hover:bg-secondary flex items-center justify-between px-4 text-sm font-medium transition-colors"
          >
            <span>{expanded ? "Less info" : "More info"}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
          {expanded && <VenueMoreInfo venue={venue} />}
        </div>
      )}
```

`DirectionsButton` goes full-width now that it no longer shares a row.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: **one error**, in `src/pages/VenueDetail.tsx` — it still passes the now-removed `fromMap` state / references the old layout. That is expected and Task 5 fixes it. No errors in `VenuePreview.tsx` itself.

If `VenuePreview.tsx` itself errors, fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/components/VenuePreview.tsx
git commit -m "feat(venue): replace View Details hop with an in-place More info expander"
```

---

### Task 4: Bound and scroll the mobile drawer; expand the desktop panel

`DrawerContent` is `h-auto` with no `overflow-y`. Content taller than the viewport clips off the top and is unreachable — today's sheet fits on most phones, the expanded one will not.

**Files:**
- Modify: `src/pages/MapPage.tsx:501-528`

**Interfaces:**
- Consumes: `VenuePreview`'s `defaultExpanded` prop (Task 3).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Bound and scroll the mobile drawer**

Replace lines 502-512:

```tsx
        <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          {/* max-h + an inner scroll region: DrawerContent is h-auto with no
              overflow, so an expanded card would otherwise clip off the top of
              the screen with no way to reach it. svh (not vh) so mobile browser
              chrome doesn't eat the bottom action row. The grabber handle lives
              in DrawerContent above this div, so it stays pinned while the body
              scrolls — and keeps its single meaning, drag down to dismiss. */}
          <DrawerContent className="bg-card border-border max-h-[85svh]">
            <DrawerTitle className="sr-only">{selected?.title ?? "Venue details"}</DrawerTitle>
            <DrawerDescription className="sr-only">Venue activity, hours, and actions.</DrawerDescription>
            {selected && (
              <div className="max-w-lg mx-auto w-full min-h-0 overflow-y-auto">
                <VenuePreview venue={selected} onClose={() => setSelected(null)} />
              </div>
            )}
          </DrawerContent>
        </Drawer>
```

`min-h-0` is required: `DrawerContent` is `flex flex-col`, and a flex child defaults to `min-height: auto`, which refuses to shrink below its content and defeats `overflow-y-auto`.

- [ ] **Step 2: Open the desktop panel expanded**

At line 523, replace:

```tsx
                <VenuePreview venue={selected} onClose={() => setSelected(null)} />
```

with:

```tsx
                <VenuePreview venue={selected} onClose={() => setSelected(null)} defaultExpanded />
```

The desktop `SheetContent` is already `overflow-y-auto` and full-height, so it needs no scroll fix.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: the same single pre-existing `VenueDetail.tsx` error from Task 3. Nothing new in `MapPage.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MapPage.tsx
git commit -m "fix(map): bound and scroll the venue drawer; desktop panel opens expanded"
```

---

### Task 5: Shrink `VenueDetail` to a shell; delete `fromMap`

**Files:**
- Modify: `src/pages/VenueDetail.tsx` (201 lines → ~45)

**Interfaces:**
- Consumes: `VenuePreview`'s `defaultExpanded` and `closeIcon` props (Task 3).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Replace the entire file**

```tsx
/**
 * Standalone venue page. A thin container around VenuePreview — the same
 * component the map sheet uses, opened expanded with a back glyph.
 *
 * It deliberately renders no hero, no stat tiles and no action bar of its own:
 * VenuePreview already owns all three, and this page previously duplicated
 * them, which is the duplication the §19 slice-1 merge removed.
 *
 * Reached from Discover (happy hours, weekend favorites), Saved spots, and
 * plan links. The map no longer navigates here at all — its sheet expands in
 * place — so the old `fromMap` back-button special case is gone.
 */
import { useNavigate, useParams } from "react-router-dom";
import { useVenue } from "@/hooks/useVenue";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import VenuePreview from "@/components/VenuePreview";

const VenueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useVenue(id);

  return (
    <section aria-label="Venue" className="pb-24">
      {isLoading ? (
        <div className="container pt-4 space-y-3 max-w-2xl">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data ? (
        <div className="max-w-2xl mx-auto w-full">
          <VenuePreview
            venue={data}
            onClose={() => navigate(-1)}
            defaultExpanded
            closeIcon="back"
          />
        </div>
      ) : (
        <div className="container pt-10">
          <div className="text-center bg-card border rounded-xl p-8">
            <p className="text-muted-foreground">Venue not found.</p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate("/")}>
              Back to map
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default VenueDetail;
```

Deleted with it: the 288px hero (VenuePreview has one), the duplicate badge row, the duplicate title/category/neighborhood block, the duplicate `VenueStatTiles`, the duplicate `CheckInCard`, the sticky Save/Directions bar (VenuePreview owns both), the `goBack` `fromMap` branch, and the local `CreatePlanSheet` (now inside `VenueMoreInfo`).

The skeleton changes shape to match what now loads — a card, not a full-bleed page hero.

- [ ] **Step 2: Verify `fromMap` is fully gone**

Run: `grep -rn "fromMap" src`
Expected: **no output.** If anything matches, remove it — the flag has no remaining producer.

- [ ] **Step 3: Verify `mapState` still has consumers**

Run: `grep -rn "mapState\|useMapState" src | grep -v "store/mapState.ts"`
Expected: **at least one match.** The store must stay — Discover / Saved / Plans still navigate away from the map and back. If this returns nothing, stop and report rather than deleting the store.

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no output — the Task 3/4 error is now resolved.

Run: `npm run build`
Expected: `✓ built in …`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/VenueDetail.tsx
git commit -m "refactor(venue): VenueDetail becomes a shell around VenuePreview; drop fromMap"
```

---

### Task 6: Live verification matrix

No test framework exists, so the acceptance criteria are verified in a real browser. **Unregister the service worker first** — `/sw.js` serves stale JS and has burned two previous sessions (logged 2026-07-21).

**Files:** none modified unless a check fails.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: `Local: http://localhost:8080/`. Use port 8080 — Google OAuth redirects target it (CLAUDE.md).

- [ ] **Step 2: Unregister the service worker**

In the browser console at `localhost:8080`:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
```

Then hard-reload.

- [ ] **Step 3: Run the matrix**

Check each against the spec's numbered acceptance criteria. Record actual observed result, not expected.

| # | Check | Criterion |
|---|---|---|
| 1 | Mobile viewport (390×844). Tap a pin → sheet shows hero, header, quick info, tiles, check-in, Directions, and a collapsed "More info" row. No "View Details" button anywhere. | 1, 2 |
| 2 | Tap "More info" → expands in place, no navigation, URL stays `/`. Shows About, hours/phone/website info card. Label reads "Less info", chevron rotated. | 3 |
| 3 | Tap "Less info" → collapses back. | 3 |
| 4 | iPhone SE viewport (375×667). Expand a venue with a long About. Sheet is capped, body scrolls, **the Directions button is reachable by scrolling**. | 5 |
| 5 | Drag the grabber handle **down** → sheet dismisses. Drag **up** → nothing expands (no snap point). | 6 |
| 6 | With the sheet expanded, scroll the body — the drag-to-dismiss must not fire mid-scroll. | 6, risk |
| 7 | **Signed out**, open a venue with no description and no enrichment → **no "More info" row at all**. All 56 venues currently have enrichment, so this needs a forced case: temporarily stub `hasMoreInfo` to `return false` for one title, confirm the row disappears, then revert the stub. Do not commit the stub. | 4 |
| 7b | **Signed in**, open that same venue → the row **is** present (the plan button always gives it content). | 4 |
| 8 | Desktop viewport (1440×900). Click a pin → right panel opens with the section **already expanded**, and scrolls. | 7 |
| 9 | Discover → tap a happy-hour venue → `/venue/:id` loads, section already open, hero shows a **back arrow** not an X. Tap it → returns to Discover with scroll position intact. | 8 |
| 10 | Profile → Saved spots → tap a venue → same, back returns to Saved spots. | 8 |
| 11 | On `/venue/:id`, confirm friends-here and plans-here rows are present (they were absent before this merge). Requires a venue with a friend checked in or a plan — otherwise confirm the components mount by their absence-of-error. | 9 |
| 12 | Count on every container: exactly **one** Directions button, exactly **one** Save affordance. Check mobile sheet, desktop panel, and `/venue/:id`. | 10 |
| 13 | Browser console shows **no React errors or warnings** across all of the above. | — |

- [ ] **Step 4: Report**

Write the observed result of each row. **Do not claim a row passed without having actually observed it.** If a row fails, stop and report rather than patching silently — the fix may change the design.

- [ ] **Step 5: Final verification and commit any fixes**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
grep -rn "fromMap" src
git status
```

Expected: typecheck silent, build succeeds, grep empty, working tree clean (or containing only deliberate fixes from Step 4, which get their own commit).

---

## Post-plan: what Colton decides

Not part of this plan — surface these when the work is done:

1. **Popular Times and Specials** — carried over untouched, still 0/56. Colton's direction pending.
2. **Merge and push** — his call, per standing practice.
3. **Tracker + Decision Log** — record §19 slice 1, and correct the "37-assertion harness" citations, which reference a script that was never committed.
4. **Test framework** — recommended, deliberately out of scope here.
