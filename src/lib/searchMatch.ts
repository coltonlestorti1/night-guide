/**
 * Forgiving venue search: case-, punctuation-, and diacritic-insensitive
 * ("mcsorleys" matches McSorley's Old Ale House). Single normalize path used
 * by both the filter pipeline and the search dropdown.
 */
import { Venue } from "@/data/types";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function venueMatches(v: Venue, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  // Amenity words are searchable too, so "rooftop" or "backyard" finds the
  // venue even though neither appears in its name.
  const amenities = [
    v.has_rooftop ? "rooftop roof" : "",
    v.has_outdoor ? "outdoor outside backyard patio" : "",
    v.is_college_scene ? "college" : "",
  ].join(" ");
  const hay = normalize(
    `${v.title} ${v.neighborhood ?? ""} ${v.music_type ?? ""} ${v.category} ${amenities}`,
  );
  return hay.includes(q);
}
