/**
 * venue_ratings data layer — the user's own ranked list.
 *
 * PRIVATE in slice 1: RLS grants the owner and nobody else. Slice 2 shares
 * scores through night_posts, NOT by widening this table's policies.
 *
 * A write rewrites the whole bucket's rank_position/score, because a score is a
 * rendering of the ranking: inserting one venue shifts every sibling below it.
 * Buckets are small (a user's "Great" list is tens of venues at most), so a
 * full rewrite is cheaper and far less error-prone than a partial reindex.
 */
import { getSupabase } from "@/lib/supabase";
import { Bucket, insertAt, scoreFor } from "@/lib/night/ranking";

export type RatingRow = {
  venueId: string;
  bucket: Bucket;
  rankPosition: number;
  score: number;
};

type DbRow = { venue_id: string; bucket: Bucket; rank_position: number; score: number | string };

/** The signed-in user's full ranked list, best first within each bucket. */
export async function listMyRatings(userId: string): Promise<RatingRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("venue_ratings")
    .select("venue_id, bucket, rank_position, score")
    .eq("user_id", userId)
    .order("rank_position", { ascending: true });
  if (error) throw error;

  // Postgres numeric comes back as a string through PostgREST — coerce, or
  // every score comparison downstream is a string comparison.
  return ((data ?? []) as DbRow[]).map((r) => ({
    venueId: r.venue_id,
    bucket: r.bucket,
    rankPosition: r.rank_position,
    score: Number(r.score),
  }));
}

/** The venue ids in one bucket, best first. Convenience over listMyRatings. */
export function orderOf(rows: RatingRow[], bucket: Bucket): string[] {
  return rows
    .filter((r) => r.bucket === bucket)
    .sort((a, b) => a.rankPosition - b.rankPosition)
    .map((r) => r.venueId);
}

/**
 * Place `venueId` into `bucket` at `index` within `currentOrder` (that bucket's
 * existing venue ids, best first), then rewrite the bucket.
 *
 * `venueId` is stripped from currentOrder first so re-rating a venue already in
 * this bucket moves it rather than duplicating it.
 */
export async function saveRating(
  userId: string,
  venueId: string,
  bucket: Bucket,
  index: number,
  currentOrder: string[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");

  const order = insertAt(
    currentOrder.filter((id) => id !== venueId),
    venueId,
    index,
  );
  const rows = order.map((id, i) => ({
    user_id: userId,
    venue_id: id,
    bucket,
    rank_position: i,
    score: scoreFor(bucket, i, order.length),
  }));

  const { data, error } = await supabase
    .from("venue_ratings")
    .upsert(rows, { onConflict: "user_id,venue_id" })
    .select("venue_id");
  if (error) throw error;
  // Same zero-row silence as setVibe(): an RLS-blocked write returns no error,
  // so a dropped save is indistinguishable from a successful one unless the
  // rows are read back.
  if (!data?.length) throw new Error("Rating write matched no rows");
}

/**
 * Move a venue out of whatever bucket it is in. Needed when a re-rate changes
 * the bucket: the old bucket's ranks must close up behind it.
 */
export async function removeFromBucket(
  userId: string,
  venueId: string,
  bucket: Bucket,
  currentOrder: string[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");

  const order = currentOrder.filter((id) => id !== venueId);
  if (order.length === 0) return; // nothing left to reindex

  const rows = order.map((id, i) => ({
    user_id: userId,
    venue_id: id,
    bucket,
    rank_position: i,
    score: scoreFor(bucket, i, order.length),
  }));

  const { error } = await supabase
    .from("venue_ratings")
    .upsert(rows, { onConflict: "user_id,venue_id" });
  if (error) throw error;
}
