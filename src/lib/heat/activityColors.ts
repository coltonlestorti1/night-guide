/**
 * The live-activity palette, defined once.
 *
 * Quiet -> Trending -> Hot is the app's colour language for "how busy is it",
 * and it is spoken on two surfaces: the map pin rings and the crowd meter on
 * venue detail. They were separate copies until 2026-08-11, and they had
 * already drifted — the meter used green for Quiet, which appears nowhere in
 * the map legend.
 *
 * Hex rather than CSS variables because maplibre paint expressions cannot read
 * a custom property, and Tailwind's JIT cannot build a class from a runtime
 * value. One representation both consumers can use is worth more than either
 * convention here.
 *
 * TRENDING and HOT are the same values as --trending and --hot in index.css.
 */
export const ACTIVITY_QUIET = "#9CA3AF";
export const ACTIVITY_TRENDING = "#FF8A3D";
export const ACTIVITY_HOT = "#FF4D67";

/**
 * The crowd meter's unlit track.
 *
 * Light enough to recede, dark enough to be seen: an earlier version used the
 * border token and measured 1.17:1 against the Activity card, which made the
 * meter read as one floating block instead of a five-step scale.
 */
export const ACTIVITY_TRACK = "#D2D2CF";
