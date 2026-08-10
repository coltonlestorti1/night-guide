/**
 * The ENDZ splash artwork, as data.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the launch screen. Two very
 * different consumers read it:
 *
 *   1. `scripts/make-splash-image.mjs`, which rasterises it to the static
 *      `apple-touch-startup-image` PNGs iOS paints the instant the app is
 *      tapped from the home screen.
 *   2. The inline `#endz-splash` markup in `index.html`, which is the live
 *      splash React tears down once it has painted.
 *
 * **The static PNG is frame 0 of the live animation.** iOS shows the PNG, then
 * hands off to the HTML — so if the two disagree by even a few pixels you get a
 * visible jump exactly where the white screen used to be. That is why nothing
 * on this screen animates except the orbiting dot, and why every dimension
 * below is stated once, here, in CSS pixels.
 *
 * `make-splash-image.mjs` asserts that index.html still contains the geometry
 * this file describes, so the two cannot silently drift.
 */

/** Warm off-white. The app's own `--background` (src/index.css), NOT the
 *  manifest's old dark `#09090b` — matching the app means no colour flash when
 *  the real UI takes over. */
export const BG = [0xf7, 0xf7, 0xf4];

/** ENDZ purple, `--primary`. The orbiting dot and the ring track. */
export const PURPLE = [0x6c, 0x45, 0xff];

/** Wordmark grey, carried over unchanged from the splash this replaces. */
export const WORDMARK = [0x70, 0x70, 0x70];

/**
 * Gradient stops sampled from public/icon-512.png, copied from
 * `make-app-icon.mjs` — three stops rather than two because a straight 2-stop
 * lerp lands on #C260BA where the real art is #BC56B9. Applied across the E's
 * own bounding box on the anti-diagonal, so the letter carries the full
 * purple-to-pink sweep of the app icon.
 */
export const E_STOPS = [
  [0.0, [0x8c, 0x51, 0xed]],
  [0.5, [0xbc, 0x56, 0xb9]],
  [1.0, [0xf9, 0x70, 0x87]],
];

/**
 * The E, as fractions of its OWN bounding box.
 *
 * `make-app-icon.mjs` states these as fractions of a 1024 square canvas
 * (barH 86, stemW 88, width 326, midW 304, height 510). Re-expressed here
 * relative to the letter itself so the mark can be placed at any size without
 * dragging the icon's canvas along with it. Same proportions, same letter.
 */
const BAR_H = 86 / 510;
const STEM_W = 88 / 326;
const MID_W = 304 / 326;

/** Width ÷ height of the E. */
export const E_ASPECT = 326 / 510;

/** [x0, y0, x1, y1] in 0..1 of the E's bounding box. Axis-aligned by design:
 *  the icon script's trick is that a rectangle is exact at every size, so the
 *  letter never needs anti-aliasing and never resamples. */
export const E_RECTS = [
  [0, 0, 1, BAR_H], // top bar
  [0, 0.5 - BAR_H / 2, MID_W, 0.5 + BAR_H / 2], // middle bar
  [0, 1 - BAR_H, 1, 1], // bottom bar
  [0, 0, STEM_W, 1], // stem
];

/**
 * "ENDZ" in Space Grotesk Bold (wght 700), as one SVG path.
 *
 * Extracted once from the upstream variable TTF (google/fonts, OFL) at
 * wght=700 with 0.34em tracking, then normalised so the path's own ink bounds
 * are 1000 wide. Committed as data because the repo has no font parser and no
 * rasteriser, and because a path cannot fail to load.
 *
 * This also FIXES a live bug: the splash it replaces asked for
 * "Space Grotesk Variable", but that font is imported in src/main.tsx and has
 * not loaded when the splash paints — so the wordmark has always silently
 * rendered in system sans. These outlines are the real typeface.
 */
export const WORDMARK_PATH =
  "M0 207.35L0 0L133.29 0L133.29 35.55L39.1 35.55L39.1 85.01L125 85.01L125 120.56L39.1 120.56L39.1 171.8L135.07 171.8L135.07 207.35ZM264.81 207.35L264.81 0L339.16 0L380.33 180.69L385.66 180.69L385.66 0L424.17 0L424.17 207.35L349.82 207.35L308.65 26.66L303.32 26.66L303.32 207.35ZM558.06 207.35L558.06 172.99L585.31 172.99L585.31 34.36L558.06 34.36L558.06 0L643.36 0Q685.13 0 706.9 21.18Q728.67 42.36 728.67 84.12L728.67 123.22Q728.67 164.99 706.9 186.17Q685.13 207.35 643.36 207.35ZM624.41 171.8L643.96 171.8Q667.65 171.8 678.61 159.36Q689.57 146.92 689.57 124.41L689.57 82.94Q689.57 60.13 678.61 47.84Q667.65 35.55 643.96 35.55L624.41 35.55ZM856.04 207.35L856.04 157.58L958.53 39.69L958.53 34.95L859 34.95L859 0L999.41 0L999.41 49.76L896.92 167.65L896.92 172.39L1000 172.39L1000 207.35Z";

/** The wordmark path's own coordinate box. */
export const WORDMARK_VIEWBOX = { w: 1000, h: 207.35 };

/**
 * Layout, in CSS pixels.
 *
 * CSS pixels rather than device pixels on purpose: the live splash uses these
 * numbers directly, and the PNG renderer multiplies them by the device's pixel
 * ratio. That is what makes the static image and the live splash line up on a
 * 2x phone and a 3x phone alike, from one set of numbers.
 */
export const LAYOUT = {
  ringRadius: 46,
  ringStroke: 1.5,
  /** The ring track, purple at low alpha over the background. */
  ringAlpha: 0.18,
  dotRadius: 5.5,
  /** Height of the E; width follows from E_ASPECT. Sized so the letter clears
   *  the orbiting dot on every side — its half-diagonal is ~28.5px against
   *  40.5px of inner clearance. */
  eHeight: 46,
  /** Baseline gap from the bottom of the ring to the top of the wordmark. */
  wordmarkGap: 26,
  /** Ink width of the wordmark; height follows from WORDMARK_VIEWBOX. */
  wordmarkWidth: 68,
  /**
   * Vertical centre of the group, as a fraction of height.
   *
   * MUST be exactly 0.5, and not for taste — for alignment. The startup PNG
   * covers the FULL screen, but the standalone web view is inset below the
   * status bar (the viewport meta has no `viewport-fit=cover`), so the HTML
   * splash and the PNG measure from different origins.
   *
   * At 0.5 the error cancels almost entirely: the web view's centre sits
   * (topInset - bottomInset) / 2 below the screen's centre, and those insets
   * are close on every iPhone — 59 vs 34 on Dynamic Island, 44 vs 34 notched,
   * 20 vs 0 on the SE. Worst case ~12pt. Move this off 0.5 and the mark visibly
   * jumps when iOS hands the screen over, which is a new defect exactly where
   * the white screen used to be.
   */
  centerYFraction: 0.5,
};

/** One full revolution, in ms. Linear, so there is no eased "rest" that could
 *  read as the app having stalled. */
export const ORBIT_PERIOD_MS = 1400;

/**
 * Side of the square box the ring + orbiting dot occupy, in CSS px.
 *
 * The ring's diameter alone is NOT enough: the dot rides ON the ring, so it
 * sticks out by its own radius in every direction. Sizing the box to the ring
 * clips the dot in half at 12 o'clock — and only at 12 o'clock, which is
 * precisely the frame the static startup PNG shows.
 */
export const MARK_BOX = 2 * (LAYOUT.ringRadius + LAYOUT.dotRadius);

/** Total height of the composed mark (mark box + gap + wordmark), in CSS px. */
export function markHeight() {
  return MARK_BOX + LAYOUT.wordmarkGap + wordmarkHeight();
}

/** Ink height of the wordmark at LAYOUT.wordmarkWidth, in CSS px. */
export function wordmarkHeight() {
  return (LAYOUT.wordmarkWidth * WORDMARK_VIEWBOX.h) / WORDMARK_VIEWBOX.w;
}

/**
 * The E as one SVG path, centred on (cx, cy) in the mark box's user units.
 *
 * Emitted from the same fractions the rasteriser uses, so index.html's copy
 * can be asserted against this rather than maintained by hand. One path rather
 * than four rects on purpose — see the note in index.html about
 * objectBoundingBox gradients resolving per shape.
 */
export function ePath(cx, cy) {
  const h = LAYOUT.eHeight;
  const w = h * E_ASPECT;
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const x1 = x0 + w, y1 = y0 + h;
  const barH = h * BAR_H;
  const midX = x0 + w * MID_W;
  const stemX = x0 + w * STEM_W;
  const r = (n) => String(Math.round(n * 100) / 100);
  const bar = (bx0, by0, bx1, by1) =>
    `M${r(bx0)} ${r(by0)}H${r(bx1)}V${r(by1)}H${r(bx0)}Z`;
  return (
    bar(x0, y0, x1, y0 + barH) +
    bar(x0, cy - barH / 2, midX, cy + barH / 2) +
    bar(x0, y1 - barH, x1, y1) +
    bar(x0, y0, stemX, y1)
  );
}

/** Colour of the E's gradient at `t` (0..1 along the anti-diagonal). */
export function gradientAt(t) {
  const lerp = (a, b, k) => Math.round(a + (b - a) * k);
  for (let i = 1; i < E_STOPS.length; i++) {
    const [t1, c1] = E_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = E_STOPS[i - 1];
      const k = (t - t0) / (t1 - t0);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return E_STOPS[E_STOPS.length - 1][1];
}

/**
 * `#RRGGBB` for embedding in markup. Uppercase, matching the convention in
 * index.html and src/index.css — the drift guard compares these strings
 * literally, so the case has to agree.
 */
export const hex = ([r, g, b]) =>
  "#" +
  [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
