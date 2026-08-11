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
 *
 * The bands were re-cut 2026-08-10 (Colton). They used to run 0-10 end to end,
 * which put a lone "Good" at 5.0 and a lone "Not great" at 1.7 — the scale read
 * as far harsher than the words did, and a 1.7 looks like a place burned down.
 * A lone "Great" now starts at 8.5, "Good" at 6.0, "Not great" at 4.0, and
 * nothing scores below 3.0.
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
  great: { lo: 7.0, hi: 10.0 },
  good: { lo: 5.0, hi: 6.9 },
  not_great: { lo: 3.0, hi: 4.9 },
};

/**
 * How many venues must sit in "Great" before its #1 is awarded a flat 10.0.
 *
 * Below this the top of the band is approached but never reached, which is
 * correct while a ranking is thin: a 10 should mean "the best of a set I have
 * actually compared", and one or two entries have survived at most a single
 * head-to-head. At five, #1 has won enough comparisons for the claim to hold.
 */
export const TOP_SCORE_MIN = 5;

/**
 * Score for the entry at `rankPosition` (0 = best) among `bucketSize` entries.
 * A lone entry lands on the band midpoint; larger buckets spread evenly across
 * the band. Rounded to one decimal, which is also how it is displayed.
 *
 * One exception: the top of a Great list with TOP_SCORE_MIN or more entries
 * scores a flat 10.0. The even spread only ever approaches the band ceiling, so
 * without this a favourite place could never actually be a 10 — and "my number
 * one is a 10" is the whole reward for keeping the list honest.
 */
export function scoreFor(bucket: Bucket, rankPosition: number, bucketSize: number): number {
  const { lo, hi } = BANDS[bucket];
  const n = Math.max(bucketSize, 1); // a caller passing 0 means "just this one"
  if (bucket === "great" && rankPosition === 0 && n >= TOP_SCORE_MIN) return hi;
  const raw = hi - ((rankPosition + 0.5) * (hi - lo)) / n;
  return Math.round(raw * 10) / 10;
}

/**
 * The bucket a stored score belongs to. For rendering a score that arrived
 * without its bucket — night_posts carries the number but not the bucket.
 * Reads the bands rather than repeating their edges, which is how PostCard's
 * copy of 6.7/3.4 quietly became wrong when the bands moved.
 */
export function bucketForScore(score: number): Bucket {
  if (score >= BANDS.great.lo) return "great";
  if (score >= BANDS.good.lo) return "good";
  return "not_great";
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
