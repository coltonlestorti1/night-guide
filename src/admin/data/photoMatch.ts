/**
 * Matching dropped photo files to venues by filename.
 *
 * Exact-or-nothing, deliberately. Fuzzy matching would let "bar.jpg" land on
 * "Bar Nine", and a photo on the wrong venue is invisible in every test,
 * looks perfectly fine in the admin table, and is discovered by a user
 * standing outside a different bar. Anything not certain is handed back to
 * Colton to resolve with a dropdown.
 */
import type { AdminVenueRow } from "./venues";

/** Lowercase, strip punctuation, collapse separators to single spaces. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Strip the extension and any trailing download counter: "x (1)", "x-2". */
function baseName(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[-_\s]+\d+$/, "");
}

export type PhotoMatch = {
  fileName: string;
  venueId: string | null;
  confidence: "exact" | "ambiguous" | "none";
  candidates: string[];
};

export function matchFileToVenues(
  fileName: string,
  venues: AdminVenueRow[],
): PhotoMatch {
  const target = slugify(baseName(fileName));
  const hits = venues.filter((v) => slugify(v.name) === target);

  if (hits.length === 1) {
    return { fileName, venueId: hits[0].id, confidence: "exact", candidates: [hits[0].id] };
  }
  if (hits.length > 1) {
    return {
      fileName, venueId: null, confidence: "ambiguous",
      candidates: hits.map((v) => v.id),
    };
  }
  return { fileName, venueId: null, confidence: "none", candidates: [] };
}
