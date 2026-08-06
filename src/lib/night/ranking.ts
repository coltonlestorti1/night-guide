/**
 * Rating buckets, in-bucket ranking, and the 0-10 score derived from them.
 *
 * The RANKING is the truth; the score is a rendering of it. Scores therefore
 * move as a bucket grows, which is expected — nothing persists a score as an
 * independent fact, and nothing should compare two users' scores as if they
 * were an absolute scale.
 *
 * Bands are fixed per bucket so a score can never migrate across a boundary
 * when a list is re-ranked: the worst "Great" always outranks the best "Good".
 * Comparisons only ever run inside one bucket, so a venue you loved is never
 * weighed against one you disliked — that is the whole reason for asking for a
 * bucket before asking for a comparison.
 */
export type Bucket = "great" | "good" | "not_great";

export const BUCKET_LABELS: Record<Bucket, string> = {
  great: "Great",
  good: "Good",
  not_great: "Not great",
};

export const BANDS: Record<Bucket, { lo: number; hi: number }> = {
  great: { lo: 6.7, hi: 10.0 },
  good: { lo: 3.4, hi: 6.6 },
  not_great: { lo: 0.0, hi: 3.3 },
};

/**
 * Score for the entry at `rankPosition` (0 = best) among `bucketSize` entries.
 * A lone entry lands on the band midpoint; larger buckets spread evenly across
 * the band. Rounded to one decimal, which is also how it is displayed.
 */
export function scoreFor(bucket: Bucket, rankPosition: number, bucketSize: number): number {
  const { lo, hi } = BANDS[bucket];
  const n = Math.max(bucketSize, 1); // a caller passing 0 means "just this one"
  const raw = hi - ((rankPosition + 0.5) * (hi - lo)) / n;
  return Math.round(raw * 10) / 10;
}

/**
 * The next head-to-head question for a binary insertion into `sorted`
 * (best first), over the half-open range [lo, hi).
 *
 * Returns null when the position is settled, or when the bucket is empty and
 * there is nothing to compare against — that null is what makes a user's first
 * rating in a bucket a single tap.
 *
 * The caller answers by narrowing the range: "the new one is better" sets
 * hi = indexOf(venueId); "worse" sets lo = indexOf(venueId) + 1. When this
 * returns null, `lo` is the insertion index.
 */
export function nextComparison(
  sorted: string[],
  lo: number,
  hi: number,
): { venueId: string; lo: number; hi: number } | null {
  if (sorted.length === 0 || lo >= hi) return null;
  const mid = Math.floor((lo + hi) / 2);
  return { venueId: sorted[mid], lo, hi };
}

/** Insert `venueId` at `index`, leaving the rest of the order intact. Pure. */
export function insertAt(sorted: string[], venueId: string, index: number): string[] {
  const next = sorted.slice();
  next.splice(index, 0, venueId);
  return next;
}
