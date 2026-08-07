/**
 * night_comments data layer.
 *
 * Same boundary rule as posts.ts: RLS decides who sees what, and there is
 * deliberately NO client-side audience filtering here. A filter in this file
 * would be a second, weaker copy of the policy that can silently disagree
 * with it.
 *
 * canCommentOn() below is NOT that filter. It decides whether to render a
 * composer, and the database refuses the insert regardless of what it returns
 * — it exists so a non-friend sees an explanation instead of a submit button
 * that fails.
 */
import { getSupabase } from "@/lib/supabase";
import type { FriendProfile } from "@/lib/friends";

const AUTHOR_COLS = "id, username, display_name, avatar_url";

/** Shared so the thread read and the preview read cannot drift apart. */
const COMMENT_SELECT = `id, post_id, body, created_at,
   author:profiles!night_comments_user_id_fkey(${AUTHOR_COLS})`;

export const COMMENT_MAX = 280;

export type NightComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: FriendProfile;
};

export type CommentPreview = {
  count: number;
  /** The newest comment — what the feed row shows. */
  latest: NightComment;
};

type DbComment = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author: FriendProfile;
};

const toComment = (r: DbComment): NightComment => ({
  id: r.id,
  postId: r.post_id,
  body: r.body,
  createdAt: r.created_at,
  author: r.author,
});

/**
 * Count + newest comment per post. Pure, so it is testable without a network:
 * the ordering guarantee lives here rather than depending on the query's ORDER
 * BY, because a caller that re-sorts should not change what the feed shows.
 */
export function reduceCommentPreviews(comments: NightComment[]): Map<string, CommentPreview> {
  const out = new Map<string, CommentPreview>();
  for (const c of comments) {
    const existing = out.get(c.postId);
    if (!existing) {
      out.set(c.postId, { count: 1, latest: c });
      continue;
    }
    existing.count += 1;
    if (c.createdAt > existing.latest.createdAt) existing.latest = c;
  }
  return out;
}

/**
 * Whether to show a composer. Friends of the author, or the author themselves.
 * Deliberately does NOT consult the post's visibility — a friend commenting on
 * an 'everyone' post is still a friend.
 */
export function canCommentOn(
  authorId: string,
  myId: string | undefined,
  friendIds: Set<string>,
): boolean {
  if (!myId) return false;
  return authorId === myId || friendIds.has(authorId);
}

/**
 * Every comment on the given posts, in one round trip. The feed reduces these
 * with reduceCommentPreviews(). Batched rather than per-card: one query for
 * the whole feed instead of one per post.
 */
export async function listCommentPreviews(postIds: string[]): Promise<NightComment[]> {
  const supabase = getSupabase();
  if (!supabase || postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("night_comments")
    .select(COMMENT_SELECT)
    .in("post_id", postIds);
  if (error) throw error;
  return ((data ?? []) as unknown as DbComment[]).map(toComment);
}

/** One thread, oldest first — a conversation reads top to bottom. */
export async function listComments(postId: string): Promise<NightComment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as DbComment[]).map(toComment);
}

export async function addComment(input: {
  postId: string;
  userId: string;
  body: string;
}): Promise<NightComment> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const body = input.body.trim();
  if (!body) throw new Error("Comment is empty");
  const { data, error } = await supabase
    .from("night_comments")
    .insert({ post_id: input.postId, user_id: input.userId, body })
    .select(COMMENT_SELECT);
  if (error) throw error;
  // Zero rows with no error means RLS refused the write — the same silence
  // that hid the 2026-07-14 vibe bug for weeks. Fail loudly.
  if (!data?.length) throw new Error("Comment write matched no rows");
  return toComment(data[0] as unknown as DbComment);
}

export async function deleteComment(commentId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("night_comments").delete().eq("id", commentId);
  if (error) throw error;
}
