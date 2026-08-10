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
 * on this screen animates except the spinning arc, and why every dimension
 * below is stated once, here, in CSS pixels.
 *
 * `make-splash-image.mjs --check` asserts that index.html still contains the
 * geometry this file describes, and that the committed PNGs are what this
 * source renders, so neither can silently drift.
 */

/** Warm off-white. The app's own `--background` (src/index.css), NOT the
 *  manifest's old dark `#09090b` — matching the app means no colour flash when
 *  the real UI takes over. */
export const BG = [0xf7, 0xf7, 0xf4];

/** ENDZ purple, `--primary`. The arc. */
export const PURPLE = [0x6c, 0x45, 0xff];

/** Wordmark grey, carried over unchanged from the splash this replaces. */
export const WORDMARK = [0x70, 0x70, 0x70];

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
 * not loaded when the splash paints — so the wordmark had always silently
 * rendered in system sans. These outlines are the real typeface.
 *
 * With the E gone from the mark, this is the ONLY thing naming the app on the
 * launch screen. It is not decoration.
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
  /** Radius of the arc's centreline. */
  ringRadius: 46,
  /**
   * A single thin arc, spinning, with NOTHING inside it and no track behind it
   * (Colton, 2026-08-10). Both were removed deliberately:
   *
   *   - the track was most of what made the earlier ring-plus-dot mark busy;
   *   - the gradient E that sat in the centre put a second, different purple
   *     next to this one, so they read as two accents rather than one, and at
   *     46px inside a 92px circle the arc visibly hugged the letter.
   *
   * The wordmark below carries the brand, so nothing is lost by the centre
   * being empty — that emptiness is what makes it read calm.
   */
  arcStroke: 2,
  /** Degrees of circle the arc covers. 270 leaves a quarter open, which is what
   *  reads as a spinner rather than a ring with a nick in it. */
  arcSweepDeg: 270,
  /** Where the arc begins, in degrees clockwise from 12 o'clock. 0 puts the
   *  leading cap at 12 o'clock in frame 0 — the frame the startup PNG paints. */
  arcStartDeg: 0,
  /** Baseline gap from the bottom of the mark box to the top of the wordmark. */
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
   * The web view's centre sits (topInset - bottomInset) / 2 below the screen's
   * centre, so 0.5 is the choice that minimises the gap without knowing either
   * inset. How big the residual is depends on whether the standalone web view
   * is inset at the BOTTOM as well as the top:
   *
   *   - if it stops above the home indicator (bottom 34pt), the residual is
   *     ~12pt on a Dynamic Island phone;
   *   - if it extends under the home indicator (bottom 0), it is ~29pt.
   *
   * WHICH ONE IS TRUE IS UNVERIFIED. Apple documents the top behaviour and not
   * the bottom, and it cannot be measured from a desktop browser — this repo
   * has already paid for guessing at iOS from Chrome (see CLAUDE.md, "Mobile
   * bugs: ask for a screen recording FIRST"). One launch on a real iPhone
   * settles it; until then 0.5 is right either way, because it is the minimum
   * for BOTH cases. Move it off 0.5 and the mark visibly jumps when iOS hands
   * the screen over — a new defect exactly where the white screen used to be.
   */
  centerYFraction: 0.5,
};

/** One full revolution, in ms. Linear, so there is no eased "rest" that could
 *  read as the app having stalled. Faster than the 1400ms the older, heavier
 *  mark used: a thin line has less to track, so it can move quicker without
 *  looking frantic. */
export const ORBIT_PERIOD_MS = 1000;

/**
 * Side of the square box the arc occupies, in CSS px.
 *
 * The arc's centreline is at ringRadius, so its ink reaches half a stroke
 * beyond that — and the round caps reach exactly as far, no further. Sizing
 * this to the centreline alone would shave the outer edge of the line off.
 */
export const MARK_BOX = 2 * (LAYOUT.ringRadius + LAYOUT.arcStroke / 2);

/**
 * The arc as an SVG path, centred on (cx, cy).
 *
 * Emitted from the same constants the rasteriser uses so index.html's copy can
 * be asserted against it. Round caps; the sweep runs clockwise.
 */
export function arcPath(cx, cy) {
  const r = LAYOUT.ringRadius;
  const rad = (deg) => ((deg - 90) * Math.PI) / 180;
  const a0 = rad(LAYOUT.arcStartDeg);
  const a1 = rad(LAYOUT.arcStartDeg + LAYOUT.arcSweepDeg);
  const round = (n) => Math.round(n * 100) / 100;
  const x0 = round(cx + r * Math.cos(a0));
  const y0 = round(cy + r * Math.sin(a0));
  const x1 = round(cx + r * Math.cos(a1));
  const y1 = round(cy + r * Math.sin(a1));
  const largeArc = LAYOUT.arcSweepDeg > 180 ? 1 : 0;
  return `M${x0} ${y0}A${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
}

/** Ink height of the wordmark at LAYOUT.wordmarkWidth, in CSS px. */
export function wordmarkHeight() {
  return (LAYOUT.wordmarkWidth * WORDMARK_VIEWBOX.h) / WORDMARK_VIEWBOX.w;
}

/** Total height of the composed mark (mark box + gap + wordmark), in CSS px. */
export function markHeight() {
  return MARK_BOX + LAYOUT.wordmarkGap + wordmarkHeight();
}

/**
 * `#RRGGBB` for embedding in markup. Uppercase, matching the convention in
 * index.html and src/index.css — the drift guard compares these strings
 * literally, so the case has to agree.
 */
export const hex = ([r, g, b]) =>
  "#" +
  [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
