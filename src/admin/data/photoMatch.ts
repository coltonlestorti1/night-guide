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

/** Strip the extension only. Leaves any trailing digits alone — they might
 *  be a download counter, or they might be part of the real venue name
 *  (e.g. "Nublu 151"), and we can't tell yet. */
function baseName(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "");
}

/** Strip a trailing download counter from an already-extension-stripped
 *  name: "x (1)", "x-2". Only applied as a fallback, after the full name
 *  has already failed to match anything. */
function stripCounter(name: string): string {
  return name
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
  const stripped = baseName(fileName);
  const matchAgainst = (target: string) =>
    venues.filter((v) => slugify(v.name) === target);

  // Try the full base name first — this is what lets "nublu-151.jpg" match
  // a venue literally named "Nublu 151". Only if that finds nothing do we
  // retry with a trailing counter stripped, which is what lets
  // "the-grafton (1).jpg" / "the-grafton-2.webp" still match "The Grafton".
  let hits = matchAgainst(slugify(stripped));
  if (hits.length === 0) {
    const withoutCounter = slugify(stripCounter(stripped));
    if (withoutCounter !== slugify(stripped)) {
      hits = matchAgainst(withoutCounter);
    }
  }

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
