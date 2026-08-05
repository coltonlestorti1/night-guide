/**
 * Forgiving venue search: case-, punctuation-, and diacritic-insensitive
 * ("mcsorleys" matches McSorley's Old Ale House). Single normalize path used
 * by both the filter pipeline and the search dropdown.
 */
import { Venue } from "@/data/types";
import { normalize } from "@/lib/normalize";
import { areaTerms } from "@/lib/neighborhoodAreas";
import { hasOutdoorSeating, hasRooftop } from "@/lib/venueTraits";

export { normalize };

export function venueMatches(v: Venue, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  // Amenity words are searchable too, so "rooftop" or "backyard" finds the
  // venue even though neither appears in its name.
  const amenities = [
    hasRooftop(v) ? "rooftop roof" : "",
    hasOutdoorSeating(v) ? "outdoor outside backyard patio" : "",
    v.is_college_scene ? "college" : "",
  ].join(" ");
  // Area names ("alphabet city") are searchable but deliberately not rendered —
  // the card shows the street. See src/lib/neighborhoodAreas.ts.
  const hay = normalize(
    `${v.title} ${v.neighborhood ?? ""} ${areaTerms(v.neighborhood)} ${v.music_type ?? ""} ${v.category} ${amenities}`,
  );
  return hay.includes(q);
}
