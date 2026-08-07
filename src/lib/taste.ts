/**
 * Personal taste signals for Find the Move.
 *
 * Two deliberately separate effects, agreed with Colton 2026-08-07:
 *
 *   directBoost — from rating #1. A venue you rated great ranks up, not_great
 *   ranks down. It only ever touches venues you have already been to, so it
 *   cannot be wrong about somewhere you have not seen.
 *
 *   tasteBoost — from rating #3 (TASTE_MIN_RATINGS). Infers which traits ENDZ
 *   actually holds — category, price level, cocktail-ness, rooftop/outdoor —
 *   and nudges UNVISITED venues that match. Below the floor it returns null and
 *   does nothing: extrapolating a person's taste from one opinion is how a
 *   recommender becomes confidently wrong.
 *
 * Both are capped (MAX_TASTE_DELTA) so personalization can only ever reorder
 * venues that already qualify. It must never outweigh "open now" or a filter
 * the user picked — a closed bar surfaced by an algorithm reads as broken, and
 * that is the fastest way to lose trust in the whole feature.
 *
 * Pure and dependency-free so it is unit-testable without a database.
 */
import type { Venue } from "@/data/types";
import type { RatingRow } from "@/lib/night/ratings";
import { isCocktailSpot, hasOutdoorSeating, hasRooftop } from "@/lib/venueTraits";

/** Ratings needed before any inference happens. Below this, taste is noise. */
export const TASTE_MIN_RATINGS = 3;

/** Ceiling on the inferred nudge. Open-now is +1 and a filter miss is -2. */
const MAX_TASTE_DELTA = 1.5;

const GREAT_BOOST = 1.25;
const NOT_GREAT_SINK = -1.25;

export type TasteProfile = {
  /** Net weight per venue category — great counts up, not_great counts down. */
  categories: Record<string, number>;
  /** Weighted mean price level of the venues they liked. */
  priceLevel: number;
  cocktail: number;
  outdoor: number;
  rooftop: number;
  /** How many resolvable ratings produced this profile. */
  sampleSize: number;
};

/**
 * Direct effect for a venue the user has rated. `good` is deliberately neutral:
 * it means "fine", and treating fine as an endorsement inflates everything.
 */
export function directBoost(venueId: string, ratings: RatingRow[] | undefined): number {
  const row = ratings?.find((r) => r.venueId === venueId);
  if (!row) return 0;
  if (row.bucket === "great") return GREAT_BOOST;
  if (row.bucket === "not_great") return NOT_GREAT_SINK;
  return 0;
}

const weightOf = (bucket: RatingRow["bucket"]): number =>
  bucket === "great" ? 1 : bucket === "not_great" ? -1 : 0;

/**
 * Build a taste profile, or null if there is not enough signal. Ratings whose
 * venue is no longer in the set are dropped BEFORE the floor is applied, so a
 * deleted venue cannot prop the sample size up.
 */
export function inferTaste(
  ratings: RatingRow[] | undefined,
  venues: Venue[]
): TasteProfile | null {
  if (!ratings?.length) return null;

  const byId = new Map(venues.map((v) => [v.id, v]));
  const resolved = ratings
    .map((r) => ({ row: r, venue: byId.get(r.venueId) }))
    .filter((x): x is { row: RatingRow; venue: Venue } => !!x.venue);

  if (resolved.length < TASTE_MIN_RATINGS) return null;

  const categories: Record<string, number> = {};
  let cocktail = 0;
  let outdoor = 0;
  let rooftop = 0;
  let priceSum = 0;
  let priceWeight = 0;

  for (const { row, venue } of resolved) {
    const w = weightOf(row.bucket);
    if (w === 0) continue;
    if (venue.category) categories[venue.category] = (categories[venue.category] ?? 0) + w;
    if (isCocktailSpot(venue)) cocktail += w;
    if (hasOutdoorSeating(venue)) outdoor += w;
    if (hasRooftop(venue)) rooftop += w;
    // Price is only meaningful for venues they LIKED — averaging in a place
    // they disliked would drag the mean toward it.
    if (w > 0 && venue.avg_price_level != null) {
      priceSum += venue.avg_price_level * w;
      priceWeight += w;
    }
  }

  return {
    categories,
    priceLevel: priceWeight > 0 ? priceSum / priceWeight : 0,
    cocktail,
    outdoor,
    rooftop,
    sampleSize: resolved.length,
  };
}

/**
 * Nudge for an unvisited venue, with the reason string the UI shows. Returns a
 * null reason when the delta is zero or negative — the app never explains a
 * demotion, only a promotion.
 */
export function tasteBoost(
  venue: Venue,
  taste: TasteProfile | null
): { delta: number; reason: string | null } {
  if (!taste) return { delta: 0, reason: null };

  let delta = 0;
  let why: string | null = null;

  const cat = venue.category ? (taste.categories[venue.category] ?? 0) : 0;
  if (cat > 0) {
    delta += Math.min(0.75, cat * 0.25);
    why = "Like the spots you rated";
  } else if (cat < 0) {
    delta -= Math.min(0.75, Math.abs(cat) * 0.25);
  }

  if (taste.priceLevel > 0 && venue.avg_price_level != null) {
    const gap = Math.abs(venue.avg_price_level - taste.priceLevel);
    if (gap <= 0.5) {
      delta += 0.4;
      why ??= "Your usual price range";
    } else if (gap >= 2) {
      delta -= 0.3;
    }
  }

  if (taste.cocktail > 0 && isCocktailSpot(venue)) {
    delta += 0.35;
    why ??= "Cocktail spots keep landing for you";
  }
  if (taste.rooftop > 0 && hasRooftop(venue)) {
    delta += 0.3;
    why ??= "You rate rooftops well";
  } else if (taste.outdoor > 0 && hasOutdoorSeating(venue)) {
    delta += 0.3;
    why ??= "You rate outdoor spots well";
  }

  const capped = Math.max(-MAX_TASTE_DELTA, Math.min(MAX_TASTE_DELTA, delta));
  return { delta: capped, reason: capped > 0 ? why : null };
}
