/**
 * Likes on night posts.
 *
 * Same boundary rule as posts.ts and comments.ts: RLS decides who sees what,
 * and there is deliberately NO client-side audience filtering here.
 *
 * Counts come from one batched read over the posts on screen, reduced
 * client-side — no denormalized counter. A counter is a second source of truth
 * that drifts, and the tracker entry for this feature explicitly promised to
 * copy the comment-preview approach rather than invent a new one.
 */
import { getSupabase } from "@/lib/supabase";

export type LikeRow = { postId: string; userId: string };

export type LikeSummary = {
  count: number;
  /** Whether the signed-in caller is one of them. Drives the filled heart. */
  likedByMe: boolean;
};

type DbLike = { post_id: string; user_id: string };

/**
 * Every like on the given posts. RLS already removed the ones the caller may
 * not see — including likes from anyone they have blocked.
 */
export async function listLikesForPosts(postIds: string[]): Promise<LikeRow[]> {
  const supabase = getSupabase();
  if (!supabase || postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("night_post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);
  if (error) throw error;
  return ((data ?? []) as DbLike[]).map((r) => ({ postId: r.post_id, userId: r.user_id }));
}

/** Pure, so the grouping is testable without a network. */
export function summarizeLikes(rows: LikeRow[], myId: string | undefined): Map<string, LikeSummary> {
  const out = new Map<string, LikeSummary>();
  for (const r of rows) {
    const cur = out.get(r.postId) ?? { count: 0, likedByMe: false };
    cur.count += 1;
    if (myId && r.userId === myId) cur.likedByMe = true;
    out.set(r.postId, cur);
  }
  return out;
}

export async function likePost(postId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("night_post_likes")
    .insert({ post_id: postId, user_id: userId });
  // 23505 = the (post_id, user_id) primary key. Liking twice is not an error
  // the user caused — a double tap, or an optimistic update racing itself.
  if (error && error.code !== "23505") throw error;
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("night_post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}
