# Tap a photo to expand it — design

**Date:** 2026-08-08
**Status:** design agreed with Colton 2026-08-08; **not yet approved for
implementation** — the tracker gate still applies to the build.
**Follows:** the curated venue photos feature, merged @ `42e02cc`. That build
put real photographs on five surfaces; none of them can be looked at closely.

## Purpose

Tap any photo in ENDZ and see it full-size.

Colton asked for this immediately after uploading the first venue photo, which
is the tell: a 112px thumbnail identifies a bar, it doesn't show you what the
room looks like. The photo is the whole point of the previous feature and it is
currently rendered too small to serve that purpose anywhere except the detail
sheet, where it is still only 176px tall.

## What is true today (verified 2026-08-08 on `42e02cc`)

- **A lightbox already exists, but only for night-feed photos.** It is inline in
  `src/components/night/PostCard.tsx:178` — a shadcn `Dialog` with a
  transparent panel, `max-h-[85vh] w-full object-contain`, an `sr-only`
  `DialogTitle`, opened by `setExpanded(url)` from a thumbnail's `onClick`.
- **No shared lightbox component exists.** `grep` for `Lightbox` returns
  nothing; the only other `setExpanded` uses are unrelated
  (`FriendsHereRow` toggles a list, `VenuePreview:44` toggles its own details
  section — a name collision to avoid inside that file).
- **Five surfaces render a venue photo, none of them expandable:**

| Surface | File | Size | Tap today |
|---|---|---|---|
| List card thumbnail | `BarCard.tsx:43` | 112px | row opens the venue |
| Saved spots row | `SavedSpotsList.tsx:64` | thumbnail | row navigates to `/venue/:id` |
| Detail sheet hero | `VenuePreview.tsx:71` | 176px tall | nothing |
| Admin edit preview | `VenueEditSheet.tsx` | 80px | nothing |
| Admin table thumbnail | `AdminVenues.tsx` | 40px | row opens the edit sheet |

- **0 of 56 venues currently have a photo**, so every one of these renders a
  category placeholder from `src/lib/venueImages.ts` right now.

## Design

### 1. One shared lightbox

Extract the night-feed implementation into `src/components/PhotoLightbox.tsx`
and have `PostCard` use it too. Props: the image URL to show (`null` = closed),
a close handler, and an `alt` string.

Behaviour is exactly what `PostCard` already ships, because it is already
right: transparent borderless panel, `max-h-[85vh] object-contain` so tall and
wide photos both fit without cropping, `sr-only` title for screen readers,
closes on overlay tap, Escape, or the Dialog's own close affordance.

**Why extract rather than copy:** this would otherwise be the third
copy-paste of the same pattern in a week — the canvas re-encoder was already
duplicated twice before the venue photos build merged it into
`src/lib/imageEncode.ts`. One component also means one place to add pinch-zoom
later, if it is ever wanted.

**Why not a route or a full-screen overlay of our own:** the app already uses
Radix `Dialog` for every modal surface, and it handles focus trapping, scroll
locking and Escape correctly. Hand-rolling that is how modals end up
un-closable on iOS.

### 2. Only a real photo is expandable

The load-bearing rule of this design.

A category placeholder is not a photograph — it is a grey card with the word
"Bar" on it. Expanding it full-screen shows the user a large grey rectangle,
which is worse than doing nothing.

So every surface expands **only when the venue has a real `image_url`**. When
it does not, the image is inert and the tap behaves exactly as it does today.

Two consequences worth stating plainly:

1. **Today, with 0 of 56 photographed, nothing changes anywhere.** The feature
   appears venue by venue as Colton adds photos. There is no flag day and no
   half-migrated state.
2. It resolves the tap-conflict question for the common case rather than
   papering over it — most rows will not be interceptable at all for a while.

A shared predicate `hasRealPhoto(venue)` lives in `src/lib/venueImages.ts`,
next to `venueImageSrc`, which is already the single place that decides
real-photo-versus-placeholder. It is a pure function and it is where the unit
tests go.

### 3. Tap conflicts on the three interactive rows

`BarCard`, `SavedSpotsList` and the `AdminVenues` table row are each tappable
as a whole. On those, the image becomes a real `<button type="button">` whose
handler calls `stopPropagation()` before opening the lightbox. Tap the photo →
it expands. Tap anywhere else on the row → the row does what it always did.

**Known tradeoff, stated rather than buried:** the admin table thumbnail is
40px — a small target nested inside a large one. Mis-taps will open the edit
sheet instead of the lightbox. That is recoverable in one tap, and the admin
table is single-user, so it ships as-is; if scanning 56 photos turns out to be
a real workflow, the fix is a bigger photo cell, not a cleverer tap handler.

**Accessibility note:** `BarCard`'s root is a `div` with `role="button"`, so
nesting a real `<button>` inside is tolerated by browsers and is not invalid
HTML (only `<button>` inside `<button>` is). It is still nested interactive
content. Accepted deliberately: restructuring `BarCard`'s root is a
visual-risk refactor of the app's most-used component, and it is not what this
change is for. The button carries an `aria-label` naming the venue so the two
controls are distinguishable by screen reader.

### 4. The two non-interactive surfaces

`VenuePreview`'s hero and the admin edit sheet's preview have no competing tap,
so their images become buttons with no `stopPropagation` needed.

In `VenuePreview`, the new state must NOT be called `expanded` — that name is
already taken at `:44` for the details section. Use `lightboxUrl`.

## Error handling

- **A photo that 404s** already falls back to the placeholder via each
  surface's `onError`. Since `hasRealPhoto` is true but the image failed, the
  lightbox would open on a broken URL. The lightbox therefore carries the same
  `onError` fallback: if the full-size image fails, it closes rather than
  showing a broken-image icon in a modal the user then has to dismiss.
- **No photo:** unreachable by construction — the button is not rendered.

## Testing

- **Unit (`node` Vitest, the only kind this repo can run on this code):**
  `hasRealPhoto` — true for a real URL, false for null, undefined and empty
  string. Empty string matters: `VenuePreview` currently passes
  `venue.image_url || ""` to its `<img>`.
- **Browser pass, which is the real gate** — `.tsx` files are not collected by
  this repo's Vitest, and this project has shipped a component that rendered
  nothing while every automated check passed. Verify on all five surfaces that
  a photographed venue expands, a placeholder does not, and the three
  interactive rows still open the venue when tapped anywhere else.

## Out of scope

- **Pinch-zoom or pan inside the lightbox.** The photo already renders at up to
  85% of viewport height.
- **Swiping between photos.** One photo per venue — there is nothing to swipe
  to.
- **Captions or attribution in the lightbox.** `image_source` is admin
  metadata, deliberately never shipped to the client.
- **Making the admin table's photo cell larger.** Revisit only if mis-taps
  prove to be a real problem in use.

## Open questions

None.
