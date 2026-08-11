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
 *
 * Every rank change goes through rewriteBucket(), which reconciles the caller's
 * idea of the bucket against the server's before writing. See mergeBucketOrder
 * for why: these writes are upserts, so an order carrying a venue that has
 * since been deleted would re-insert it.
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

type DbWriteRow = {
  user_id: string;
  venue_id: string;
  bucket: Bucket;
  rank_position: number;
  score: number;
};

/**
 * The full rewrite of one bucket, best first. Pure, and exported so the
 * reindex arithmetic is testable without a database — it was written inline at
 * every call site before this, and all of them had to stay identical.
 */
export function bucketRows(userId: string, bucket: Bucket, order: string[]): DbWriteRow[] {
  return order.map((id, i) => ({
    user_id: userId,
    venue_id: id,
    bucket,
    rank_position: i,
    score: scoreFor(bucket, i, order.length),
  }));
}

/**
 * Reconcile the order a caller believes a bucket has with the order the server
 * actually holds.
 *
 * Every write in this module is an upsert keyed on (user_id, venue_id), which
 * means it INSERTS anything it is given that does not already exist. A caller's
 * order comes from a React Query cache, so it can name a venue that was deleted
 * since — and upserting that ghost brings a deleted rating back from the dead.
 * This is the same defect that was fixed inside deleteRating; it lives on every
 * write path, not just that one.
 *
 * Three rules:
 *   - a venue the caller lists that the server no longer has is dropped,
 *   - `adding` is kept even though the server has never seen it (it is the
 *     rating being written),
 *   - a venue the server has that the caller never knew about is appended, so
 *     that every row in the bucket is part of the rewrite. Leaving it out would
 *     strand it on a rank_position this rewrite is about to hand to something
 *     else. Last is the only position defensible for it: nothing in this flow
 *     was ever compared against it, and re-rating it puts it right.
 *
 * Pure, so the reconciliation is testable without a database.
 */
export function mergeBucketOrder(
  desired: string[],
  live: string[],
  adding?: string,
): string[] {
  const liveSet = new Set(live);
  const kept = desired.filter((id) => liveSet.has(id) || id === adding);
  const keptSet = new Set(kept);
  return [...kept, ...live.filter((id) => !keptSet.has(id))];
}

/** The bucket as the server currently holds it, best first. */
async function liveBucketOrder(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  bucket: Bucket,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("venue_ratings")
    .select("venue_id")
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .order("rank_position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { venue_id: string }[]).map((r) => r.venue_id);
}

/**
 * Rewrite a whole bucket from `desired`, reconciled against the server first.
 * The single write path for every rank change — one place to get the upsert
 * semantics right rather than three.
 */
async function rewriteBucket(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  bucket: Bucket,
  desired: string[],
  adding?: string,
): Promise<void> {
  const live = await liveBucketOrder(supabase, userId, bucket);
  const order = mergeBucketOrder(desired, live, adding);
  if (order.length === 0) return; // nothing left to reindex

  const { data, error } = await supabase
    .from("venue_ratings")
    .upsert(bucketRows(userId, bucket, order), { onConflict: "user_id,venue_id" })
    .select("venue_id");
  if (error) throw error;
  // Same zero-row silence as setVibe(): an RLS-blocked write returns no error,
  // so a dropped write is indistinguishable from a successful one unless the
  // rows are read back.
  if (!data?.length) throw new Error("Rating write matched no rows");
}

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
 *
 * `currentOrder` is a snapshot from the client's cache, so it is reconciled
 * against the server before anything is written — it can name venues that no
 * longer exist, and miss ones that now do.
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

  const desired = insertAt(
    currentOrder.filter((id) => id !== venueId),
    venueId,
    index,
  );
  await rewriteBucket(supabase, userId, bucket, desired, venueId);
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

  await rewriteBucket(
    supabase,
    userId,
    bucket,
    currentOrder.filter((id) => id !== venueId),
  );
}

/**
 * Remove a rating entirely, then close the ranks behind it.
 *
 * The delete goes first on purpose. If the reindex then fails, the survivors
 * carry stale SCORES but their ORDER is still correct, and the next write to
 * this bucket repairs them. The other order would leave the deleted venue
 * holding a live rank, which is a wrong list rather than a slightly stale one.
 *
 * The reindex takes its order entirely from the server (see rewriteBucket):
 * after a delete there is no caller-supplied order worth trusting, and the
 * survivors are exactly the set that should be rewritten.
 */
export async function deleteRating(
  userId: string,
  venueId: string,
  bucket: Bucket,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");

  const { data, error } = await supabase
    .from("venue_ratings")
    .delete()
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .select("venue_id");
  if (error) throw error;
  // Same zero-row silence as saveRating(): an RLS-blocked delete reports no
  // error, and the row would appear to vanish from a list it is still in.
  if (!data?.length) throw new Error("Rating delete matched no rows");

  // Empty `desired`: the survivors ARE the order, straight from the server.
  await rewriteBucket(supabase, userId, bucket, []);
}
