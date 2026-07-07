/**
 * Venue trait detection shared by the map glyphs and vibe scoring.
 * Traits derive only from real fields (title, description, price, category).
 */
import { Venue } from "@/data/types";
import { normalize } from "@/lib/searchMatch";

/** Cocktail-forward spot: keyword match or upscale bar pricing. */
export function isCocktailSpot(v: Venue): boolean {
  const text = normalize(`${v.title} ${v.description ?? ""}`);
  if (text.includes("cocktail") || text.includes("speakeasy")) return true;
  return v.category === "bar" && (v.avg_price_level ?? 0) >= 3;
}

/** Pin glyph: 🍺 bars, 🍸 lounges + cocktail-forward bars, 🪩 clubs. */
export function pinGlyph(v: Venue): string {
  if (v.category === "club") return "🪩";
  if (v.category === "lounge") return "🍸";
  return isCocktailSpot(v) ? "🍸" : "🍺";
}
