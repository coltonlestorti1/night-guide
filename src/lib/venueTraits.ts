/**
 * Venue trait detection shared by the map glyphs and vibe scoring.
 * Traits derive only from real fields (title, description, price, category).
 */
import { Venue } from "@/data/types";
import { normalize } from "@/lib/normalize";
import { getEnrichment } from "@/data/enrichment";

/** Cocktail-forward spot: keyword match or upscale bar pricing. */
export function isCocktailSpot(v: Venue): boolean {
  const text = normalize(`${v.title} ${v.description ?? ""}`);
  if (text.includes("cocktail") || text.includes("speakeasy")) return true;
  return v.category === "bar" && (v.avg_price_level ?? 0) >= 3;
}

/**
 * Outdoor seating — the ONE definition. Every surface (tiles, cards, filters,
 * search, scoring) must go through this rather than reading `has_outdoor`,
 * or they drift apart.
 *
 * Google's `outdoorSeating` is the primary source: it covers far more venues
 * than our hand-curated flag did (22 vs 2) and it is verified. Only `true`
 * counts — Google's `false`/absent means "not recorded", not "definitely none",
 * so it is never treated as a denial.
 *
 * `venue.has_outdoor` stays as a manual override for venues Google has nothing
 * on (the West / Meatpacking dataset carries backyard info Google lacks).
 *
 * Enrichment expiring (>30d) makes this go quiet rather than keep asserting a
 * stale amenity — which is exactly what §20 asks for: never present outdoor
 * seating as available when it is unverified.
 */
export function hasOutdoorSeating(v: Venue): boolean {
  return getEnrichment(v.title)?.outdoorSeating === true || v.has_outdoor === true;
}

/** Rooftops have no Google equivalent, so they stay curated-only — and stay
 *  deliberately separate from general outdoor seating (§20 hard rule). */
export function hasRooftop(v: Venue): boolean {
  return v.has_rooftop === true;
}

/** Pin glyph: 🍺 bars, 🍸 lounges + cocktail-forward bars, 🪩 clubs. */
export function pinGlyph(v: Venue): string {
  if (v.category === "club") return "🪩";
  if (v.category === "lounge") return "🍸";
  return isCocktailSpot(v) ? "🍸" : "🍺";
}
