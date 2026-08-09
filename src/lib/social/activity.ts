/**
 * Activity: reactions to YOUR posts.
 *
 * DERIVED, not stored. There is no notifications table and no trigger — likes
 * and comments on your own posts are already queryable, and RLS already lets
 * you read them because you can always see your own posts. Storing a
 * notification row per like would be a write on the hottest path in the app
 * for information that can simply be asked for.
 *
 * Reactions only, deliberately (Colton, 2026-08-09). Friend requests and plan
 * invites stay on their own surfaces, because a like clears when you SEE it
 * and a request must not — one list with two clearing rules is the thing this
 * split avoids.
 */
import { getSupabase } from "@/lib/supabase";
import type { FriendProfile } from "@/lib/friends";

const ACTOR = "id, username, display_name, avatar_url";

export type ActivityItem = {
  /** Stable per row so React keys never collide across the two sources. */
  id: string;
  kind: "like" | "comment";
  actor: FriendProfile;
  postId: string;
  venueId: string;
  nightDate: string;
  /** Comment text. Absent on likes. */
  body?: string;
  createdAt: string;
};

type DbComment = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author: FriendProfile;
  post: { venue_id: string; night_date: string } | null;
};

type DbLike = {
  post_id: string;
  created_at: string;
  liker: FriendProfile;
  post: { venue_id: string; night_date: string } | null;
};

/**
 * Newest first, both sources merged.
 *
 * Pure so the merge and the self-filter are testable without a network — those
 * are the two things that can actually be wrong here.
 */
export function mergeActivity(
  comments: ActivityItem[],
  likes: ActivityItem[],
  myId: string,
): ActivityItem[] {
  return [...comments, ...likes]
    // You are not news to yourself. Liking or commenting on your own post must
    // not appear in your own activity.
    .filter((i) => i.actor.id !== myId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Whether an item landed after the caller last opened Social. */
export function isNew(item: ActivityItem, lastSeen: string | null): boolean {
  return !!lastSeen && item.createdAt > lastSeen;
}

export async function listActivity(myId: string, limit = 40): Promise<ActivityItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // !inner so the join FILTERS rather than returning nulls — without it every
  // comment in the app comes back and only the post embed is null.
  const [c, l] = await Promise.all([
    supabase
      .from("night_comments")
      .select(
        `id, post_id, body, created_at,
         author:profiles!night_comments_user_id_fkey(${ACTOR}),
         post:night_posts!inner(venue_id, night_date, user_id)`,
      )
      .eq("post.user_id", myId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("night_post_likes")
      .select(
        `post_id, created_at,
         liker:profiles!night_post_likes_user_id_fkey(${ACTOR}),
         post:night_posts!inner(venue_id, night_date, user_id)`,
      )
      .eq("post.user_id", myId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  if (c.error) throw c.error;
  if (l.error) throw l.error;

  const comments: ActivityItem[] = ((c.data ?? []) as unknown as DbComment[]).map((r) => ({
    id: `c_${r.id}`,
    kind: "comment",
    actor: r.author,
    postId: r.post_id,
    venueId: r.post?.venue_id ?? "",
    nightDate: r.post?.night_date ?? "",
    body: r.body,
    createdAt: r.created_at,
  }));

  const likes: ActivityItem[] = ((l.data ?? []) as unknown as DbLike[]).map((r) => ({
    // Likes have no id of their own — the primary key is (post_id, user_id).
    id: `l_${r.post_id}_${r.liker.id}`,
    kind: "like",
    actor: r.liker,
    postId: r.post_id,
    venueId: r.post?.venue_id ?? "",
    nightDate: r.post?.night_date ?? "",
    createdAt: r.created_at,
  }));

  return mergeActivity(comments, likes, myId).slice(0, limit);
}
