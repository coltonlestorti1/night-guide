/**
 * Collab tags — who you were out with.
 *
 * RLS is the boundary. The states and who may set them are enforced by the
 * database (proved by scripts/2026-08-09-collab-tags-rls-test.sql), so nothing
 * here re-checks them; this module only decides what to render.
 *
 * The one rule worth restating because it is the point of the feature: only
 * the TAGGED person can move a tag to 'collab'. The author cannot, and the
 * INSERT policy refuses a tag that does not start 'pending'.
 */
import { getSupabase } from "@/lib/supabase";
import type { FriendProfile } from "@/lib/friends";

export type TagState = "pending" | "tag" | "collab" | "private";

export type PostTag = {
  postId: string;
  state: TagState;
  person: FriendProfile;
};

/** A tag awaiting the caller's decision, with enough context to decide. */
export type PendingTag = {
  postId: string;
  venueId: string;
  nightDate: string;
  author: FriendProfile;
  createdAt: string;
};

const PERSON = "id, username, display_name, avatar_url";

type DbTag = { post_id: string; state: TagState; person: FriendProfile };

/**
 * Accepted tags on the given posts, for the "with Sam" line.
 *
 * RLS already hides 'pending' and 'private' from third parties, but the filter
 * is here too because the AUTHOR can see their own pending tags and must not
 * see them rendered as though the person had agreed.
 */
export async function listTagsForPosts(postIds: string[]): Promise<PostTag[]> {
  const supabase = getSupabase();
  if (!supabase || postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("night_post_tags")
    .select(`post_id, state, person:profiles!night_post_tags_tagged_user_id_fkey(${PERSON})`)
    .in("post_id", postIds)
    .in("state", ["tag", "collab"]);
  if (error) throw error;
  return ((data ?? []) as unknown as DbTag[]).map((r) => ({
    postId: r.post_id,
    state: r.state,
    person: r.person,
  }));
}

/** Tags waiting on the caller. Drives the actionable rows in Activity. */
export async function listMyPendingTags(userId: string): Promise<PendingTag[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_post_tags")
    .select(
      `post_id, created_at,
       post:night_posts!inner(venue_id, night_date, user_id,
         author:profiles!night_posts_user_id_fkey(${PERSON}))`,
    )
    .eq("tagged_user_id", userId)
    .eq("state", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    post_id: string;
    created_at: string;
    post: { venue_id: string; night_date: string; author: FriendProfile } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.post !== null)
    .map((r) => ({
      postId: r.post_id,
      venueId: r.post!.venue_id,
      nightDate: r.post!.night_date,
      author: r.post!.author,
      createdAt: r.created_at,
    }));
}

/** Tag someone. Always lands as 'pending' (or 'private' on a nobody post) —
 *  the policy refuses anything else, so the state is not a parameter. */
export async function addTag(postId: string, taggedUserId: string, isPrivatePost: boolean): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("night_post_tags").insert({
    post_id: postId,
    tagged_user_id: taggedUserId,
    state: isPrivatePost ? "private" : "pending",
  });
  // 23505 = already tagged. Tapping twice is not an error the user caused.
  if (error && error.code !== "23505") throw error;
}

/** The tagged person's decision. Only 'tag' or 'collab' are reachable. */
export async function setTagState(
  postId: string,
  userId: string,
  state: "tag" | "collab",
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("night_post_tags")
    .update({ state })
    .eq("post_id", postId)
    .eq("tagged_user_id", userId)
    .select("post_id");
  if (error) throw error;
  // Zero rows with no error means RLS refused it — the same silence that hid
  // the 2026-07-14 vibe bug for weeks.
  if (!data?.length) throw new Error("Tag update matched no rows");
}

/** Either party may remove. This NEVER removes the post. */
export async function removeTag(postId: string, taggedUserId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("night_post_tags")
    .delete()
    .eq("post_id", postId)
    .eq("tagged_user_id", taggedUserId);
  if (error) throw error;
}

/** Group accepted tags by post for rendering. Pure — the only thing here that
 *  can be wrong without a network. */
export function tagsByPost(tags: PostTag[]): Map<string, PostTag[]> {
  const out = new Map<string, PostTag[]>();
  for (const t of tags) out.set(t.postId, [...(out.get(t.postId) ?? []), t]);
  return out;
}

/** "with Sam", "with Sam and Alex", "with Sam and 3 others". */
export function withLine(tags: PostTag[] | undefined): string | null {
  if (!tags?.length) return null;
  const names = tags.map((t) => t.person.display_name || t.person.username);
  if (names.length === 1) return `with ${names[0]}`;
  if (names.length === 2) return `with ${names[0]} and ${names[1]}`;
  return `with ${names[0]} and ${names.length - 1} others`;
}
