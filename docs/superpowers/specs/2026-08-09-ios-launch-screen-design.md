# iOS launch screen — design

**Status:** shipped 2026-08-09 (`86e0c74`), tests and speedup 2026-08-10.
**Approved by:** Colton, in conversation.

## The problem

Launched from the iPhone home screen, ENDZ showed roughly two seconds of blank
white before anything appeared. Colton reported it as "when I load the app
there is a white screen."

The cause was not slowness. `index.html` already carried a splash — painted
from HTML before any JavaScript runs — added on 2026-08-08 after a cold 5G load
left a blank white screen on video. But that splash cannot cover this window,
because **it is the document**. Between tapping the icon and the HTML arriving,
the page does not exist yet.

The only thing iOS will draw in that window is an `apple-touch-startup-image`,
and there were **none**. So iOS drew white.

## What ships

Thirteen static PNGs in `public/splash/`, one per distinct portrait
`(device-width, device-height, device-pixel-ratio)` an iPhone presents, linked
from `index.html`. iOS paints one the instant the icon is tapped — no network,
no JavaScript, no fonts. 271 KB for the set, because a flat background
compresses to almost nothing.

**Cross-check the device table against a second source before adding to it.**
It was first built from iosref.com/res, which **omits the iPhone Air** — that
row was added later and, without it, Air owners would have seen exactly the
white launch screen this work removes.

The mark, used by both the PNG and the live splash: the app icon's gradient
**E** inside a still ring, with one `#6C45FF` dot orbiting it, above the `ENDZ`
wordmark.

## The governing rule

**The static PNG is frame 0 of the live animation.**

iOS paints the PNG, then hands the screen to the HTML splash. Anything that
differs between the two appears as the mark jumping — a new visible defect
exactly where the white screen used to be. So:

- Only the orbiting dot moves. Nothing fades in, scales up, or slides.
- The dot is drawn at 12 o'clock, which is frame 0, and is also where
  `prefers-reduced-motion` parks it.
- `scripts/lib/splash-art.mjs` is the single source of truth. The PNG renderer
  imports it; `index.html` mirrors it and cannot be imported into, so
  `make-splash-image.mjs --check` asserts the markup still carries the same
  geometry. That runs in `postbuild` and in the test suite.

## Why it looks the way it does

- **Gradient E over a solid one.** Colton's call. The stops are sampled from
  `public/icon-512.png` and shared with `make-app-icon.mjs`, so the launch
  screen and the App Store icon are the same artwork.
- **A ring plus one orbiting dot.** Asked for as "an E with a circle spinning
  around it." The dot reuses the map's live "someone is out" language, so the
  first thing you see is the app's own vocabulary.
- **The wordmark stays.** An E-with-orbit plus the word ENDZ says the name
  twice, but without it the screen reads as a generic spinner rather than this
  app loading.
- **The orbit is linear, 1400ms.** An eased orbit has a slow moment at each end
  that reads as the app having stalled.

## Constraints that shaped the geometry

- **`centerYFraction` must be exactly 0.5.** The startup image is full-screen,
  but with `apple-mobile-web-app-status-bar-style: default` the standalone web
  view renders *below* the status bar (Apple's Supported Meta Tags reference).
  The two therefore measure from different origins. At 0.5 the error largely
  cancels — the web view's centre sits `(topInset - bottomInset) / 2` below the
  screen's centre, and those insets are close on every iPhone (59 vs 34 on
  Dynamic Island, 44 vs 34 notched, 20 vs 0 on the SE). Worst case ~12pt.
  Moving off 0.5 makes the mark jump.
- **`MARK_BOX = 2 * (ringRadius + dotRadius)`.** The dot rides *on* the ring,
  so a box sized to the ring clips it in half — and only at 12 o'clock, the one
  frame the PNG shows.
- **The E is one `<path>`, not four `<rect>`s.** `objectBoundingBox` gradient
  units resolve against each individual shape, so four rects gave every bar its
  own full purple-to-pink sweep.
- **The wordmark is outlines, not text.** The old splash asked for
  `"Space Grotesk Variable"`, which is imported in `src/main.tsx` and has not
  loaded when the splash paints — it had always silently rendered in system
  sans. The outlines are extracted once from the upstream OFL variable TTF at
  `wght=700` and committed as path data.
- **No image library.** Deliberate, per `make-app-icon.mjs`: the PNG encoder is
  zlib plus a CRC table from node stdlib, now shared in `scripts/lib/png.mjs`.

## Also corrected

`manifest.webmanifest`'s `background_color`/`theme_color` and the iOS status-bar
style were still `#09090b`/`black`, left from a dark theme the app no longer
has (`src/index.css` has no `.dark` block). The OS-level launch colour flashed
dark into an off-white splash.

## Verification

- Live splash matches the generator to **0.006 CSS px** (DOM measurement vs
  computed layout).
- Browser-vs-generator **pixel diff**: 0.039% of pixels differ, all 1px
  anti-aliasing edges. This is what caught the gradient bug, when the diff map
  lit up the E solid rather than its outline.
- Orbit rides the ring at 0/90/180/270° in **Chromium and WebKit** — WebKit
  being the engine iOS Safari uses — never clipped at any angle.
- `prefers-reduced-motion` parks the dot at 12 o'clock.
- All 12 configurations asserted in `scripts/splash-art.test.mjs`.
- The App Store icon generator is byte-identical (same SHA-256) after its
  encoder was extracted.
- The drift guard was proved to fail by injecting a 2px change.

## Known, not fixed

**The safe-area offset**, described above. The residual is ~12pt if the
standalone web view stops above the home indicator, or ~29pt if it extends
under it — **which of those is true is unverified.** Apple documents the top
behaviour and not the bottom, and it cannot be measured from a desktop
browser. `0.5` is the minimum for both cases, so it is right either way;
correcting further needs per-device inset values a real device would settle in
one launch. A wrong correction is worse than the known one.

**Landscape launches.** The media queries are portrait-only and carry no
`(orientation: portrait)` qualifier. If iOS swaps `device-width`/
`device-height` on rotation, launching while holding the phone in landscape
matches nothing and shows white. Adding the qualifier would not fix that — it
needs a landscape image set — and if iOS does *not* swap them, adding it would
break landscape launches that currently work. Left alone rather than guessed
at.

**Safari tabs still show white briefly.** `apple-touch-startup-image` applies
only to the home-screen icon. Nothing can paint before the document arrives in
a normal tab; the inline splash — no network, no fonts — is already as early as
that can be.

## Testing it

**The home-screen icon must be deleted and re-added.** iOS caches startup
images at install time, so an existing icon keeps showing white regardless of
what ships. This is the most likely reason a correct fix looks broken.
