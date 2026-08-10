/**
 * The user's ranked list, rendered from their ratings.
 *
 * One function, read by both /lists and the venue card, so "#3 on your list"
 * and the third row of the list can never disagree.
 *
 * Ordering is a flat sort by score. That IS the bucket order: the bands in
 * ranking.ts do not overlap, so every `great` outranks every `good`. Ties are
 * possible WITHIN a bucket because scores round to one decimal, so the stored
 * rank_position breaks them — the ranking is the truth, the score is a
 * rendering of it.
 *
 * Pure and dependency-free, so it is testable without a database.
 */
import type { Venue } from "@/data/types";
import type { RatingRow } from "@/lib/night/ratings";
import type { Bucket } from "@/lib/night/ranking";

export type ListEntry = {
  venue: Venue;
  bucket: Bucket;
  score: number;
  /** 1-based rank across the whole list, not within the bucket. */
  position: number;
};

export function beenList(ratings: RatingRow[] | undefined, venues: Venue[]): ListEntry[] {
  if (!ratings?.length) return [];

  const byId = new Map(venues.map((v) => [v.id, v]));

  return ratings
    // A rating whose venue was deactivated must not hold a rank, the same way
    // inferTaste drops it before counting toward the taste floor. flatMap also
    // copies, so the caller's array is never sorted in place.
    .flatMap((row) => {
      const venue = byId.get(row.venueId);
      return venue ? [{ row, venue }] : [];
    })
    .sort((a, b) => b.row.score - a.row.score || a.row.rankPosition - b.row.rankPosition)
    .map(({ row, venue }, i) => ({
      venue,
      bucket: row.bucket,
      score: row.score,
      position: i + 1,
    }));
}
