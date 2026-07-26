/**
 * Case-, punctuation-, and diacritic-insensitive text normalisation
 * ("mcsorleys" matches McSorley's Old Ale House).
 *
 * Lives in its own module so both searchMatch and venueTraits can use it
 * without importing each other — venueTraits needs it for trait keywords,
 * and searchMatch needs venueTraits for the amenity terms.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
