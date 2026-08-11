/**
 * Another user's ranked list, read through SECURITY DEFINER functions rather
 * than by widening venue_ratings' RLS.
 *
 * The table stays owner-only. Putting a friendships subquery inside its policy
 * would be the same shape that took the night feed down with 42P17 recursion on
 * 2026-08-09 — friendships' own policies are read by other policies, and the
 * cycle is not obvious until it deadlocks in production.
 *
 * The functions enforce the friendship themselves and return zero rows to
 * anyone else, so there is no client-side privacy filtering here: what comes
 * back is exactly what the caller is allowed to see.
 *
 * MISSING-FUNCTION TOLERANCE. The app deploys before the SQL is pasted, so a
 * missing function must degrade to "no data" rather than an error boundary.
 * PostgREST answers PGRST202 for an unknown RPC; that one code is swallowed and
 * everything else still throws.
 */
import { getSupabase } from "@/lib/supabase";
import type { RatingRow } from "@/lib/night/ratings";
import type { Bucket } from "@/lib/night/ranking";

/** PostgREST's "no function matches that name and signature". */
const UNKNOWN_FUNCTION = "PGRST202";

export type FriendStats = { beenCount: number; friendCount: number };

type ListRow = {
  venue_id: string;
  bucket: Bucket;
  rank_position: number;
  score: number | string;
};

/**
 * The target's ranked list, best first — or an empty list if the caller is not
 * an accepted friend. "Not a friend" and "has rated nothing" are deliberately
 * the same answer: distinguishing them would leak whether a stranger has any
 * ratings at all.
 */
export async function friendRankedList(targetUserId: string): Promise<RatingRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("friend_ranked_list", { p_user: targetUserId });
  if (error) {
    if (error.code === UNKNOWN_FUNCTION) return [];
    throw error;
  }

  // numeric comes back as a string through PostgREST — coerce, or every score
  // comparison downstream is a string comparison.
  return ((data ?? []) as ListRow[]).map((r) => ({
    venueId: r.venue_id,
    bucket: r.bucket,
    rankPosition: r.rank_position,
    score: Number(r.score),
  }));
}

/**
 * Been and friend counts for the target, or null when the caller may not see
 * them. Null rather than zeroes: "0 spots" is a claim about someone, and it
 * would be a false one for a friend's list you simply cannot read.
 */
export async function friendProfileStats(targetUserId: string): Promise<FriendStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("friend_profile_stats", { p_user: targetUserId });
  if (error) {
    if (error.code === UNKNOWN_FUNCTION) return null;
    throw error;
  }

  const row = (data as { been_count: number; friend_count: number }[] | null)?.[0];
  if (!row) return null; // the function's WHERE gate returned no row: not allowed
  return { beenCount: row.been_count, friendCount: row.friend_count };
}
