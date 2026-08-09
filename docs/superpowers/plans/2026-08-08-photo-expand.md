# Tap-to-Expand Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping any venue photo in ENDZ opens it full-size, on all five surfaces that render one.

**Architecture:** Extract the night-feed lightbox into a shared `PhotoLightbox` component and wire it to five call sites. A single predicate, `hasRealPhoto`, gates every one of them: a category placeholder is never expandable, which both avoids showing a full-screen grey rectangle and disarms the tap conflict on rows that are already tappable.

**Tech Stack:** React 18 + TypeScript, Vite, Radix/shadcn `Dialog`, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-08-photo-expand-design.md`

## Global Constraints

- **Work only in the worktree** `/Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand` on branch `feat/photo-expand`. Never `cd` into `~/Documents/night-guide` — several sessions share it. Pass absolute paths to file tools and `cd <abs-path> &&` inside every Bash call.
- **Never `git add -A`.** Stage explicit paths only.
- **Typecheck with** `npx tsc --noEmit -p tsconfig.app.json`. Bare `npx tsc` is a silent no-op.
- **Tests:** `npm test` (`vitest run`). The environment is **`node`** and only `src/**/*.test.ts` is collected — **`.tsx` component tests do not run and must not be written.** Baseline on this branch is **334 tests**. Every task must leave the suite green.
- **`tsconfig.app.json` sets `strict: false`.** The typecheck will not catch null dereferences. This repo has already shipped one that crashed a whole page.
- **Only a real photo is expandable.** Every call site gates on `hasRealPhoto`. A venue showing a category placeholder must behave exactly as it does today.
- **Never break an existing tap.** On rows that are already tappable, tapping anywhere except the photo must still do what it does now.
- **No new dependencies.** The lightbox is the `Dialog` already in `src/components/ui/dialog.tsx`.

---

### Task 1: `hasRealPhoto` predicate

**Files:**
- Modify: `src/lib/venueImages.ts`
- Test: `src/lib/venueImages.test.ts` (create if absent — check first)

**Interfaces:**
- Consumes: nothing.
- Produces: `hasRealPhoto(v: { image_url?: string | null }): boolean` — used by every later task. The parameter type is deliberately structural, not `Venue`, so the admin's `AdminVenueRow` (which has `image_url` but no `category`) satisfies it too.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { hasRealPhoto } from "./venueImages";

describe("hasRealPhoto", () => {
  it("is true for a stored photo URL", () => {
    expect(hasRealPhoto({ image_url: "https://x.supabase.co/a.jpg" })).toBe(true);
  });

  it("is false when there is no photo", () => {
    expect(hasRealPhoto({ image_url: null })).toBe(false);
    expect(hasRealPhoto({ image_url: undefined })).toBe(false);
    expect(hasRealPhoto({})).toBe(false);
  });

  it("is false for an empty string", () => {
    // VenuePreview passes `venue.image_url || ""` to its <img>, so the empty
    // string is a real value that reaches this predicate.
    expect(hasRealPhoto({ image_url: "" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx vitest run src/lib/venueImages.test.ts
```

Expected: FAIL — `hasRealPhoto` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/venueImages.ts`, below `venueImageSrc`:

```ts
/**
 * Does this venue have a real photograph, as opposed to a category placeholder?
 *
 * Gates every tap-to-expand affordance. Expanding a placeholder would show a
 * large grey rectangle, and refusing to expand it is also what keeps the photo
 * from stealing taps on rows that are already tappable.
 *
 * Structurally typed rather than taking a `Venue`, so the admin's
 * `AdminVenueRow` satisfies it too.
 */
export function hasRealPhoto(v: { image_url?: string | null }): boolean {
  return Boolean(v.image_url);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx vitest run src/lib/venueImages.test.ts && npm test
```

Expected: 3 new tests pass; full suite green (337).

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
git add src/lib/venueImages.ts src/lib/venueImages.test.ts && \
git commit -m "feat(photos): hasRealPhoto — a placeholder is not a photograph"
```

---

### Task 2: Shared `PhotoLightbox`, and migrate the night feed onto it

**Files:**
- Create: `src/components/PhotoLightbox.tsx`
- Modify: `src/components/night/PostCard.tsx` (replace its inline Dialog, lines ~178-185)

**Interfaces:**
- Consumes: nothing.
- Produces: `<PhotoLightbox url={string | null} onClose={() => void} alt?={string} />` — `url` non-null means open. Tasks 3-6 all render exactly this.

**No unit test.** `.tsx` is not collected by this repo's Vitest. Verification is the typecheck, the existing suite staying green, and the browser pass in Task 7.

- [ ] **Step 1: Create the component**

```tsx
/**
 * Full-size photo overlay. One implementation for night-post photos and venue
 * photos — this pattern was inline in PostCard first, and copying it a second
 * and third time is how the canvas re-encoder ended up duplicated twice before
 * it was pulled into src/lib/imageEncode.ts.
 *
 * Built on the app's Dialog rather than a hand-rolled overlay: focus trapping,
 * scroll locking and Escape-to-close are the parts people get wrong, and Radix
 * already has them right.
 */
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  /** The image to show. `null` means closed. */
  url: string | null;
  onClose: () => void;
  alt?: string;
};

const PhotoLightbox = ({ url, onClose, alt = "" }: Props) => (
  <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
      <DialogTitle className="sr-only">Photo</DialogTitle>
      {url && (
        <img
          src={url}
          alt={alt}
          className="max-h-[85vh] w-full rounded-2xl object-contain"
          // If the full-size image fails, close rather than leaving a broken
          // image inside a modal the user then has to dismiss.
          onError={onClose}
        />
      )}
    </DialogContent>
  </Dialog>
);

export default PhotoLightbox;
```

- [ ] **Step 2: Point `PostCard` at it**

Add the import:

```tsx
import PhotoLightbox from "@/components/PhotoLightbox";
```

Replace the whole inline block (the comment beginning "Tap to expand." through the closing `</Dialog>`, around lines 176-185) with:

```tsx
      <PhotoLightbox url={expanded} onClose={() => setExpanded(null)} />
```

Leave `const [expanded, setExpanded] = useState<string | null>(null);` and the thumbnail `onClick={() => setExpanded(ph.url)}` exactly as they are — the state and the trigger are unchanged, only the overlay moves.

Then remove `Dialog`, `DialogContent` and `DialogTitle` from PostCard's imports **only if nothing else in the file still uses them** — grep before deleting; PostCard also renders a delete-confirmation and a report dialog.

- [ ] **Step 3: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 type errors, 337 tests green. A dropped-but-still-used import shows up here as a type error.

- [ ] **Step 4: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
git add src/components/PhotoLightbox.tsx src/components/night/PostCard.tsx && \
git commit -m "refactor(photos): one lightbox for night posts and venues"
```

---

### Task 3: The detail-sheet hero

The easiest surface: nothing competes for the tap. Do it first among the call sites so the shared component is proven before the trickier ones.

**Files:**
- Modify: `src/components/VenuePreview.tsx` (hero at lines ~70-82)

**Interfaces:**
- Consumes: `PhotoLightbox` (Task 2), `hasRealPhoto` (Task 1).
- Produces: nothing.

- [ ] **Step 1: Add the imports and state**

```tsx
import PhotoLightbox from "@/components/PhotoLightbox";
import { hasRealPhoto } from "@/lib/venueImages";
```

Beside the component's other `useState` calls:

```tsx
  // NOT `expanded` — that name is already taken in this file for the details
  // section toggle (see the useState around line 44).
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Make the hero image tappable**

The hero is an `<img>` inside `<div className="relative w-full h-44 rounded-2xl overflow-hidden mb-4 bg-secondary">`. Wrap the `<img>` — and only the `<img>`, not the gradient overlay or the close button — in a button:

```tsx
        {hasRealPhoto(venue) ? (
          <button
            type="button"
            onClick={() => setLightboxUrl(venue.image_url!)}
            className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View photo of ${venue.title}`}
          >
            <img
              src={venue.image_url || ""}
              alt={venue.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                t.style.display = "none";
                (t.parentElement as HTMLElement).style.background =
                  "linear-gradient(135deg, hsl(var(--primary)/0.25), hsl(var(--primary-soft)))";
              }}
            />
          </button>
        ) : (
          <img
            src={venue.image_url || ""}
            alt={venue.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              t.style.display = "none";
              (t.parentElement as HTMLElement).style.background =
                "linear-gradient(135deg, hsl(var(--primary)/0.25), hsl(var(--primary-soft)))";
            }}
          />
        )}
```

Note the `onError` handler walks to `parentElement` to paint the gradient. In the button branch the parent is now the button, not the rounded container — so the gradient would paint on the button instead. The button is `h-full w-full` inside that container, so it covers the same area and the visual result is identical. Do not "simplify" the duplication away by hoisting the button outside the container; that would change the layout.

- [ ] **Step 3: Render the lightbox**

At the end of the component's returned JSX, as the last child of the outermost `<div className="px-4 pt-2 pb-6 w-full animate-slide-up">`:

```tsx
      <PhotoLightbox
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        alt={venue.title}
      />
```

- [ ] **Step 4: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, 337 green.

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
git add src/components/VenuePreview.tsx && \
git commit -m "feat(photos): expand the venue detail hero"
```

---

### Task 4: The list card thumbnail

**Files:**
- Modify: `src/components/BarCard.tsx` (image block at lines ~40-48)

**Interfaces:**
- Consumes: `PhotoLightbox` (Task 2), `hasRealPhoto` (Task 1).
- Produces: nothing.

`BarCard`'s root is a `<div role="button">` with an `onClick` that opens the venue. A real `<button>` nested inside a `div[role="button"]` is valid HTML — only `<button>` inside `<button>` is not. Task 5 covers the case where the parent *is* a real button, and it is handled differently there for exactly this reason.

- [ ] **Step 1: Add imports and state**

```tsx
import { useState } from "react";
import PhotoLightbox from "@/components/PhotoLightbox";
import { PLACEHOLDER, venueImageSrc, hasRealPhoto } from "@/lib/venueImages";
```

(The `venueImages` import already exists — extend it rather than adding a second import line.)

Inside the component, beside the existing hooks:

```tsx
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Wrap the thumbnail when there is a real photo**

Inside `<div className="relative w-28 h-28 flex-shrink-0 bg-secondary">`, replace the bare `<img>` with:

```tsx
        {hasRealPhoto(venue) ? (
          <button
            type="button"
            onClick={(e) => {
              // Without this the tap bubbles to the card root and opens the
              // venue instead of the photo.
              e.stopPropagation();
              setLightboxUrl(venue.image_url!);
            }}
            className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View photo of ${venue.title}`}
          >
            <img
              src={imgSrc}
              alt={venue.title}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar; }}
            />
          </button>
        ) : (
          <img
            src={imgSrc}
            alt={venue.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar; }}
          />
        )}
```

Leave the `hot_tonight` badge exactly where it is — it is a sibling of the image inside the same relative container, and it must stay outside the button so it is not part of the tap target.

- [ ] **Step 3: Render the lightbox**

As the last child of the card's root `<div>`:

```tsx
      <PhotoLightbox
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        alt={venue.title}
      />
```

The lightbox lives inside the card root, which has an `onClick`. Radix renders `DialogContent` in a portal at the document body, so clicks inside the overlay do not bubble back through this card. The trigger button's `stopPropagation` is what matters here.

- [ ] **Step 4: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, 337 green.

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
git add src/components/BarCard.tsx && \
git commit -m "feat(photos): expand the list card thumbnail"
```

---

### Task 5: Saved spots — restructure, because the row is a real button

**Files:**
- Modify: `src/components/SavedSpotsList.tsx` (list item at lines ~58-75)

**Interfaces:**
- Consumes: `PhotoLightbox` (Task 2), `hasRealPhoto` (Task 1).
- Produces: nothing.

**Why this one differs from Task 4.** Here the row itself is a real `<button type="button" onClick={() => navigate(...)}>` wrapping the image and the text. Nesting a `<button>` inside a `<button>` is invalid HTML — the browser's parser closes the outer button early, and the result is a broken row, not merely an accessibility complaint. So the structure changes: the photo button becomes a **sibling** of the row button, not a child.

- [ ] **Step 1: Add imports and state**

```tsx
import { useState } from "react";
import PhotoLightbox from "@/components/PhotoLightbox";
import { venueImageSrc, PLACEHOLDER, hasRealPhoto } from "@/lib/venueImages";
```

(Extend the existing `venueImages` import rather than adding a second line.)

In the component:

```tsx
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Split the row into two sibling buttons**

Replace the whole `<li>` body. The `<li>` becomes the flex container that used to be the button, so the row looks identical:

```tsx
        <li
          key={venue.id}
          className="flex w-full items-center gap-3 p-3 transition-colors hover:bg-secondary/40"
        >
          {hasRealPhoto(venue) ? (
            <button
              type="button"
              onClick={() => setLightboxUrl(venue.image_url!)}
              className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`View photo of ${venue.title}`}
            >
              <img
                src={venueImageSrc(venue)}
                alt=""
                className="h-11 w-11 rounded-xl object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar;
                }}
              />
            </button>
          ) : (
            <img
              src={venueImageSrc(venue)}
              alt=""
              className="h-11 w-11 rounded-xl object-cover shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar;
              }}
            />
          )}

          <button
            type="button"
            onClick={() => navigate(`/venue/${venue.id}`)}
            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block truncate text-sm font-semibold">{venue.title}</span>
            {/* keep every remaining child of the original text <span> here,
                unchanged — neighborhood line and anything below it */}
          </button>
        </li>
```

**Read the current file and carry over the full contents of the original text `<span>`.** The snippet above shows the title line and marks where the rest goes; do not drop the neighbourhood line or anything after it.

- [ ] **Step 3: Render the lightbox**

Outside the `.map()`, as a sibling of the `<ul>` (rendering one lightbox per list, not one per row):

```tsx
      <PhotoLightbox
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />
```

- [ ] **Step 4: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, 337 green.

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
git add src/components/SavedSpotsList.tsx && \
git commit -m "feat(photos): expand saved spots thumbnails, row split into two buttons"
```

---

### Task 6: Both admin surfaces

Grouped because they are one screen, one reviewer's concern, and neither is user-facing.

**Files:**
- Modify: `src/admin/components/VenueEditSheet.tsx` (photo preview at lines ~194-199)
- Modify: `src/admin/pages/AdminVenues.tsx` (thumbnail cell at lines ~160-166)

**Interfaces:**
- Consumes: `PhotoLightbox` (Task 2), `hasRealPhoto` (Task 1).
- Produces: nothing.

Both files hold `AdminVenueRow` values, which carry `image_url` but no `category` — `hasRealPhoto`'s structural parameter type accepts them. The admin table row is a `<TableRow onClick={...}>`, i.e. a `<tr>`, so a nested `<button>` is valid; it still needs `stopPropagation` so the tap does not also open the edit sheet.

- [ ] **Step 1: The edit sheet preview**

Add to `VenueEditSheet.tsx`:

```tsx
import PhotoLightbox from "@/components/PhotoLightbox";
import { PLACEHOLDER, hasRealPhoto } from "@/lib/venueImages";
```

(Extend the existing `venueImages` import.) Add state beside the others:

```tsx
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
```

Replace the preview `<img>` inside `<div className="flex gap-3">`:

```tsx
              {hasRealPhoto(draft) ? (
                <button
                  type="button"
                  onClick={() => setLightboxUrl(draft.image_url!)}
                  className="flex-shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View photo of ${draft.name}`}
                >
                  <img
                    src={draft.image_url || PLACEHOLDER[draft.type] || PLACEHOLDER.bar}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
                </button>
              ) : (
                <img
                  src={draft.image_url || PLACEHOLDER[draft.type] || PLACEHOLDER.bar}
                  alt=""
                  className="h-20 w-20 flex-shrink-0 rounded-lg border border-border object-cover"
                />
              )}
```

Render the lightbox as the last child of the sheet's scrolling body `<div className="flex-1 space-y-4 pb-4">`:

```tsx
          <PhotoLightbox
            url={lightboxUrl}
            onClose={() => setLightboxUrl(null)}
            alt={draft.name}
          />
```

- [ ] **Step 2: The venues table thumbnail**

Add to `AdminVenues.tsx`:

```tsx
import PhotoLightbox from "@/components/PhotoLightbox";
import { PLACEHOLDER, hasRealPhoto } from "@/lib/venueImages";
```

(Extend the existing `venueImages` import.) Add state beside `editing` and `bulkOpen`:

```tsx
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
```

Replace the thumbnail `<TableCell>` body:

```tsx
                      <TableCell>
                        {hasRealPhoto(v) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              // The row's onClick opens the edit sheet.
                              e.stopPropagation();
                              setLightboxUrl(v.image_url!);
                            }}
                            className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`View photo of ${v.name}`}
                          >
                            <img
                              src={v.image_url!}
                              alt=""
                              className="h-10 w-10 rounded object-cover"
                            />
                          </button>
                        ) : (
                          <img
                            src={PLACEHOLDER[v.type] || PLACEHOLDER.bar}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                      </TableCell>
```

Render one lightbox for the page, next to the existing `<VenueEditSheet ... />`:

```tsx
      <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
```

- [ ] **Step 3: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, 337 green.

- [ ] **Step 4: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
git add src/admin/components/VenueEditSheet.tsx src/admin/pages/AdminVenues.tsx && \
git commit -m "feat(admin): expand venue photos in the editor and the table"
```

---

### Task 7: Browser verification and docs

Nothing in Tasks 2-6 is covered by a unit test — the Vitest environment is `node` and collects only `.ts`. **This task is the real gate.** This repo shipped a component that rendered nothing while every automated check passed, and the venue-photos branch shipped a null dereference that crashed a whole page and was caught only by review.

**Files:**
- Modify: `docs/ENDZ_MASTER_TASKS.md`

**Prerequisite:** at least one venue must have a real photo. If none does, add one from `/admin/venues` first — the whole feature is invisible without it.

- [ ] **Step 1: Full check suite**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build
```

Expected: 0 type errors, 337 tests green, build clean.

Note: `npm run check:schema` reads `.env.local`, which is gitignored and therefore absent from this worktree — it exits 2 and skips silently. Copy `.env.local` in from the main checkout first if you want it to actually run. This change touches no queries, so drift is not expected either way.

- [ ] **Step 2: Verify in the browser**

`npm run dev`, then with a photographed venue:

1. **List card** — tap the photo: it expands. Tap the card anywhere else: the venue opens. Both, on the same card.
2. **Detail sheet hero** — tap it: expands. The close (X) button still closes the sheet and does not open the lightbox.
3. **Saved spots** — save that venue, then from Profile tap its photo (expands) and its name (navigates). Confirm the row still looks unchanged — same spacing, same hover.
4. **Admin table** — tap the thumbnail: expands. Tap the row elsewhere: the edit sheet opens.
5. **Admin edit sheet** — tap the 80px preview: expands.
6. **A venue with NO photo** — tapping its placeholder must do nothing on the hero and edit sheet, and must open the venue / edit sheet on the three rows. This is the rule the whole design rests on.
7. **Close paths** — Escape, tapping the backdrop, and the Dialog's own close all dismiss the lightbox.
8. **Night feed** — Task 2 moved its lightbox. Open a post photo and confirm it still expands.

- [ ] **Step 3: Delete any verification data**

If you added a photo or a saved spot purely to test, remove it. Every prior session on this repo cleaned up after itself.

- [ ] **Step 4: Update the tracker**

In `docs/ENDZ_MASTER_TASKS.md`, add a Decision Log entry for 2026-08-08 recording that tap-to-expand shipped on all five venue surfaces plus night posts, that the lightbox is now one shared component, and that only venues with a real photo are expandable. Match the file's existing house style.

- [ ] **Step 5: Commit and report**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/photo-expand && \
git add docs/ENDZ_MASTER_TASKS.md && \
git commit -m "docs(tracker): tap-to-expand shipped"
```

Report which checks were verified **in the browser** versus which only passed automated checks, and hand the merge decision to Colton.

---

## Self-Review

**Spec coverage:** Shared component → Task 2. `hasRealPhoto` gate → Task 1, applied in Tasks 3-6. Five surfaces → Tasks 3 (hero), 4 (list card), 5 (saved spots), 6 (both admin). Tap conflicts → Tasks 4, 5, 6. `lightboxUrl` naming collision in `VenuePreview` → Task 3, Step 1. Lightbox `onError` closes → Task 2. Unit test of the predicate → Task 1. Browser pass → Task 7. Out-of-scope items appear nowhere, as intended.

**One thing the spec got wrong, corrected here:** the spec said the tappable rows could take a nested `<button>` because their parents are `div[role="button"]`. That is true of `BarCard` and the admin `<tr>`, but **`SavedSpotsList`'s row is a real `<button>`**, where nesting is invalid HTML that breaks the row. Task 5 restructures it into two sibling buttons instead. Found by reading the file rather than trusting the spec.

**Type consistency:** `hasRealPhoto(v: { image_url?: string | null })` (Task 1) is called with `Venue` in Tasks 3-5 and `AdminVenueRow` in Task 6 — both satisfy the structural type. `<PhotoLightbox url onClose alt?>` (Task 2) is rendered with exactly those props in Tasks 3-6. State is named `lightboxUrl` in every call site, never `expanded`.
