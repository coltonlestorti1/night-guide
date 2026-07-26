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
  // Rooftops are excluded on purpose, so the two mean genuinely different
  // things: Outdoor = ground-level backyard / patio / beer garden, Rooftop =
  // up top. Google flags rooftops as outdoorSeating:true (technically true —
  // a roof is outdoors), which would otherwise make "Outdoor" return rooftop
  // bars to someone looking for a backyard.
  if (hasRooftop(v)) return false;
  return getEnrichment(v.title)?.outdoorSeating === true || v.has_outdoor === true;
}

/** Rooftops have no Google equivalent, so they stay curated-only — and stay
 *  deliberately separate from general outdoor seating (§20 hard rule). */
export function hasRooftop(v: Venue): boolean {
  return v.has_rooftop === true;
}

/** Outdoor kinds we'll repeat, only when a real source says the word. */
const OUTDOOR_KINDS = ["backyard", "beer garden", "patio", "terrace", "courtyard", "garden"] as const;

/**
 * What KIND of outdoor space it is ("Backyard", "Patio"), read out of Google's
 * editorial summary — never guessed. Returns null when no source says, and the
 * caller falls back to a plain yes.
 *
 * Deliberately narrow: only 3 of 23 outdoor venues currently have a summary
 * that names the space. Inventing "patio" for the other 20 would be making up
 * a detail about a real business.
 */
export function outdoorKind(v: Venue): string | null {
  if (!hasOutdoorSeating(v)) return null;
  const summary = getEnrichment(v.title)?.editorialSummary?.toLowerCase();
  if (!summary) return null;
  // Longest first, so "beer garden" wins over "garden".
  const hit = [...OUTDOOR_KINDS].sort((a, b) => b.length - a.length).find((k) => summary.includes(k));
  return hit ? hit.charAt(0).toUpperCase() + hit.slice(1) : null;
}

/** Pin glyph: 🍺 bars, 🍸 lounges + cocktail-forward bars, 🪩 clubs. */
export function pinGlyph(v: Venue): string {
  if (v.category === "club") return "🪩";
  if (v.category === "lounge") return "🍸";
  return isCocktailSpot(v) ? "🍸" : "🍺";
}
