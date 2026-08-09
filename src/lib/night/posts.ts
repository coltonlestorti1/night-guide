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
   tag:night_post_tags!inner(tagged_user_id, state)`;

export type FeedPost = {
  id: string;
  venueId: string;
  nightDate: string;
  note: string | null;
  visibility: Audience;
  /** The rating as it stood when this was published. Null if never rated. */
  score: number | null;
  createdAt: string;
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

/**
 * Publish, or update an existing post for the same venue and night.
 *
 * Upsert rather than insert: reopening the sheet to change a note or narrow the
 * audience is the same act as publishing, and the unique constraint makes a
 * second insert an error the user did not cause.
 */
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
  const { error } = await supabase.from("night_posts").delete().eq("id", postId);
  if (error) throw error;
}


/**
 * Someone else's nights, for their profile.
 *
 * Two sources, because a collab is meant to land here: posts they AUTHORED,
 * and posts they were TAGGED in and accepted ('tag' or 'collab'). Without the
 * second half, approving a collab would have no visible effect anywhere, which
 * is the whole payoff of the feature.
 *
 * RLS does the filtering. Every row returned is one the CALLER is allowed to
 * see, so this shows a different set to different viewers by design — a
 * friends-only post is simply absent for a stranger. There is deliberately no
 * client-side audience check to disagree with the policy.
 */
export async function listProfilePosts(profileUserId: string, limit = 20): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const [mine, tagged] = await Promise.all([
    supabase
      .from("night_posts")
      .select(POST_SELECT)
      .eq("user_id", profileUserId)
      .order("night_date", { ascending: false })
      .limit(limit),
    // !inner so the join FILTERS. Without it every post comes back with a null
    // tag embed rather than only the tagged ones.
    supabase
      .from("night_posts")
      .select(PROFILE_TAGGED_SELECT)
      .eq("tag.tagged_user_id", profileUserId)
      .in("tag.state", ["tag", "collab"])
      .order("night_date", { ascending: false })
      .limit(limit),
  ]);
  if (mine.error) throw mine.error;
  if (tagged.error) throw tagged.error;

  const rows = [
    ...((mine.data ?? []) as unknown as DbPost[]),
    ...((tagged.data ?? []) as unknown as DbPost[]),
  ];
  // A post can arrive from both queries only if someone tagged themselves,
  // which the INSERT policy forbids — but dedupe anyway rather than trust it,
  // because a duplicate here is a React key collision.
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  return unique
    .map(toFeedPost)
    .sort((a, b) => (a.nightDate < b.nightDate ? 1 : a.nightDate > b.nightDate ? -1 : 0))
    .slice(0, limit);
}
