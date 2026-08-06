/**
 * Who a night post is published to.
 *
 * Deliberately NOT CheckinVisibility. A live location and a next-day post are
 * different disclosures: presence is about where your body is right now, a post
 * is authored content you chose to publish. Sharing one union would eventually
 * drag one's default onto the other. Do not merge them.
 *
 * These values are the client's half of the contract; the SELECT policy on
 * night_posts is the half that actually enforces it. Nothing here filters.
 */
export type Audience = "everyone" | "school" | "friends" | "nobody";

/** Labels name the audience, not the setting — "Friends only", not "Friends". */
export const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: "Everyone on ENDZ",
  school: "People at my school",
  friends: "Friends only",
  nobody: "Just me",
};

/**
 * School unless there is no school to scope to.
 *
 * Measured against real signups on 2026-08-06: 36% of profiles had a null
 * college_slug, and nulls were still being created that day. A `school` post
 * from such a user matches nobody — the UI would promise an audience that does
 * not exist and the post would land in silence. Friends is the honest fallback.
 */
export function defaultAudience(collegeSlug: string | null | undefined): Audience {
  return collegeSlug ? "school" : "friends";
}

/**
 * Offered audiences, widest first. School is hidden entirely when it cannot
 * apply, rather than shown and silently doing nothing.
 */
export function audienceOptions(collegeSlug: string | null | undefined): Audience[] {
  return collegeSlug
    ? ["everyone", "school", "friends", "nobody"]
    : ["everyone", "friends", "nobody"];
}
