/**
 * night_posts data layer.
 *
 * RLS is the boundary, and it is proved rather than assumed — see
 * scripts/2026-08-07-night-posts-rls-test.sql. listFeed() asks for everything
 * and renders what comes back; there is deliberately NO client-side audience
 * filtering, because a filter here would be a second, weaker copy of the policy
 * that can silently disagree with it. Same rule as src/lib/saves.ts.
 *
 * Nothing in this module can reach a check-in timestamp: night_posts carries a
 * DATE and has no foreign key to check_ins.
 */
import { getSupabase } from "@/lib/supabase";
import type { Audience } from "@/lib/night/audience";
import type { FriendProfile } from "@/lib/friends";
import type { TagState } from "@/lib/night/tags";
import { listPhotoPathsForPost, removeStoredPhotos } from "@/lib/night/photos";

const AUTHOR_COLS = "id, username, display_name, avatar_url";

/** The embedded author join, shared so the two feed reads cannot drift apart. */
const POST_SELECT = `id, venue_id, night_date, note, visibility, score, created_at,
   author:profiles!night_posts_user_id_fkey(${AUTHOR_COLS})`;

/**
 * The same columns as POST_SELECT plus the tag join, written out rather than
 * composed from it.
 *
 * This duplication is deliberate and load-bearing. The schema drift guard
 * resolves ONE level of interpolation, so `${AUTHOR_COLS}` is fine but
 * `${POST_SELECT}` — which itself contains an interpolation — comes back as
 * "unresolved interpolation" and the whole query is silently DROPPED from
 * drift checking. A query the guard skips is exactly the one that breaks in
 * production after a column rename.
 *
 * If you add a column to POST_SELECT, add it here too.
 */
const PROFILE_TAGGED_SELECT = `id, venue_id, night_date, note, visibility, score, created_at,
   author:profiles!night_posts_user_id_fkey(${AUTHOR_COLS}),
   tag:night_post_tags!inner(tagged_user_id, state, score)`;

export type FeedPost = {
  id: string;
  venueId: string;
  nightDate: string;
  note: string | null;
  visibility: Audience;
  /** The rating as it stood when this was published. Null if never rated. */
  score: number | null;
  createdAt: string;
  /**
   * Set only on posts from the Tagged tab: the caller's tag state on this
   * post, which the overflow menu needs to render the right choice. Undefined
   * on authored posts, where the concept does not apply.
   */
  tagState?: TagState;
  author: FriendProfile;
};

type DbPost = {
  id: string;
  venue_id: string;
  night_date: string;
  note: string | null;
  visibility: Audience;
  score: number | string | null;
  created_at: string;
  author: FriendProfile;
};

/**
 * A post row carrying the tag embed, for the Tagged tab.
 *
 * `night_post_tags` is to-many off `night_posts` (a night can name several
 * people), so PostgREST returns the embed as an ARRAY even though the
 * `tagged_user_id` filter narrows it to one row. Typed as both because a
 * single-object embed would silently become `undefined` under `[0]` and every
 * tagged card would lose its score.
 */
export type DbTaggedPost = DbPost & {
  tag: DbTagEmbed | DbTagEmbed[] | null;
};

type DbTagEmbed = {
  tagged_user_id: string;
  state: TagState;
  score: number | string | null;
};

const firstTag = (t: DbTaggedPost["tag"]): DbTagEmbed | undefined =>
  Array.isArray(t) ? t[0] : (t ?? undefined);

const toFeedPost = (r: DbPost): FeedPost => ({
  id: r.id,
  venueId: r.venue_id,
  nightDate: r.night_date,
  note: r.note,
  visibility: r.visibility,
  // Postgres numeric arrives as a string through PostgREST.
  score: r.score === null || r.score === undefined ? null : Number(r.score),
  createdAt: r.created_at,
  author: r.author,
});

/**
 * Same mapping, except the score is the TAGGED person's off the tag row.
 *
 * The post's own `score` column is the author's and is deliberately discarded
 * here: on your profile, a night shows what YOU thought of the place. A tag
 * accepted but never rated has a null score, which PostCard already renders as
 * "went to" with no ring.
 */
export const toTaggedFeedPost = (r: DbTaggedPost): FeedPost => {
  const tag = firstTag(r.tag);
  const raw = tag?.score;
  return {
    ...toFeedPost(r),
    score: raw === null || raw === undefined ? null : Number(raw),
    tagState: tag?.state,
  };
};

/** Everything the caller is allowed to see, newest first. */
export async function listFeed(limit = 50): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as DbPost[]).map(toFeedPost);
}

/** The caller's own posts for one night, so the recap can show what is live. */
export async function listMyPostsForNight(
  userId: string,
  nightDate: string,
): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .eq("night_date", nightDate);
  if (error) throw error;
  return ((data ?? []) as unknown as DbPost[]).map(toFeedPost);
}

/** The caller's own posts, newest first — the profile Activity tab. Includes
 *  `nobody` posts: a private entry is still your activity. */
export async function listMyPosts(userId: string, limit = 20): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .order("night_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as DbPost[]).map(toFeedPost);
}

/**
 * Publish, or update an existing post for the same venue and night.
 *
 * Upsert rather than insert: reopening the sheet to change a note or narrow the
 * audience is the same act as publishing, and the unique constraint makes a
 * second insert an error the user did not cause.
 */
export async function publishPost(input: {
  userId: string;
  venueId: string;
  nightDate: string;
  note: string | null;
  visibility: Audience;
  /** Snapshot of the author's rating. venue_ratings stays owner-only. */
  score: number | null;
}): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("night_posts")
    .upsert(
      {
        user_id: input.userId,
        venue_id: input.venueId,
        night_date: input.nightDate,
        note: input.note?.trim() || null,
        visibility: input.visibility,
        score: input.score,
      },
      { onConflict: "user_id,venue_id,night_date" },
    )
    .select("id");
  if (error) throw error;
  // Zero rows with no error means RLS refused the write — the same silence that
  // hid the 2026-07-14 vibe bug for weeks. Read it back and fail loudly.
  if (!data?.length) throw new Error("Post write matched no rows");
  return (data[0] as { id: string }).id;
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");

  // Read the paths BEFORE deleting. night_post_photos cascades off night_posts,
  // so the moment the post is gone there is no record of which files belonged
  // to it and they are stranded in the bucket permanently.
  const paths = await listPhotoPathsForPost(postId);

  // `.select()` so the delete reports what it actually removed. Without it a
  // delete RLS refuses returns no rows AND no error, and the caller reports
  // success — the same silence that hid the 2026-07-14 vibe bug for weeks, and
  // that publishPost immediately above already guards against. The DELETE
  // policy currently permits this, so today it is defence rather than a fix;
  // the point is that a future policy change must fail loudly, not quietly.
  const { data, error } = await supabase
    .from("night_posts")
    .delete()
    .eq("id", postId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Post delete matched no rows");

  // Files last, and a failure here does not fail the delete: a retained file
  // with no row is invisible and the admin sweep collects it, whereas a
  // deleted file with a live row is a broken image for everyone who can see
  // the post.
  if (paths.length) await removeStoredPhotos(paths);
}


/**
 * Posts someone AUTHORED — the Activity tab on their profile.
 *
 * RLS does the filtering. Every row returned is one the CALLER is allowed to
 * see, so this shows a different set to different viewers by design — a
 * friends-only post is simply absent for a stranger. There is deliberately no
 * client-side audience check to disagree with the policy.
 */
export async function listAuthoredPosts(profileUserId: string, limit = 20): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_posts")
    .select(POST_SELECT)
    .eq("user_id", profileUserId)
    .order("night_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as DbPost[]).map(toFeedPost);
}

/**
 * Posts someone was TAGGED in and accepted — the Tagged tab.
 *
 * The score shown is the TAGGED person's, read off the tag row, not the
 * author's off the post. Both are denormalized snapshots for the same reason:
 * `venue_ratings` is owner-only, so a viewer can never read either party's
 * rating directly. Whose profile you are on decides whose opinion you see.
 *
 * 'pending' is excluded — an undecided tag is an item of business in Activity,
 * not a night on a profile.
 */
export async function listTaggedPosts(profileUserId: string, limit = 20): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  // !inner so the join FILTERS. Without it every post comes back with a null
  // tag embed rather than only the tagged ones.
  const { data, error } = await supabase
    .from("night_posts")
    .select(PROFILE_TAGGED_SELECT)
    .eq("tag.tagged_user_id", profileUserId)
    .in("tag.state", ["tag", "collab"])
    .order("night_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as DbTaggedPost[]).map(toTaggedFeedPost);
}
