import { describe, it, expect } from "vitest";
import { toTaggedFeedPost, type DbTaggedPost } from "./posts";

/**
 * A post row as PostgREST hands it back for the Tagged tab: the post's own
 * `score` is the AUTHOR's, and the embedded tag's `score` is the tagged
 * person's. Which one wins is the whole point of the feature.
 */
const row = (over: Partial<DbTaggedPost> = {}): DbTaggedPost => ({
  id: "p1",
  venue_id: "v1",
  night_date: "2026-08-09",
  note: null,
  visibility: "friends",
  score: 9.2, // the author's
  created_at: "2026-08-09T04:00:00Z",
  author: { id: "kev", username: "kev", display_name: null, avatar_url: null },
  tag: [{ tagged_user_id: "me", state: "collab", score: 7 }],
  ...over,
});

describe("toTaggedFeedPost", () => {
  it("takes the score from the tag, not the post", () => {
    // The bug this guards: showing 9.2 — Kevin's opinion — on your profile.
    expect(toTaggedFeedPost(row()).score).toBe(7);
  });

  it("reads an embed returned as a bare object", () => {
    // night_post_tags is to-many, so the embed is normally an array; a single
    // object would silently become undefined under [0] and lose every score.
    const r = row({ tag: { tagged_user_id: "me", state: "tag", score: 4.5 } });
    expect(toTaggedFeedPost(r).score).toBe(4.5);
  });

  it("converts a numeric arriving as a string", () => {
    // Postgres numeric comes through PostgREST as a string.
    const r = row({ tag: [{ tagged_user_id: "me", state: "tag", score: "8.1" }] });
    expect(toTaggedFeedPost(r).score).toBe(8.1);
  });

  it("is null when the tag carries no score, even though the post has one", () => {
    // Accepted but never rated. PostCard renders this as "went to", no ring —
    // it must NOT fall back to the author's score.
    const r = row({ tag: [{ tagged_user_id: "me", state: "tag", score: null }] });
    expect(toTaggedFeedPost(r).score).toBeNull();
  });

  it("is null when the embed is missing entirely", () => {
    expect(toTaggedFeedPost(row({ tag: null })).score).toBeNull();
    expect(toTaggedFeedPost(row({ tag: [] })).score).toBeNull();
  });

  it("carries the tag state through for the management menu", () => {
    expect(toTaggedFeedPost(row()).tagState).toBe("collab");
    const r = row({ tag: [{ tagged_user_id: "me", state: "tag", score: 1 }] });
    expect(toTaggedFeedPost(r).tagState).toBe("tag");
  });

  it("keeps the author, so the card still says whose night it was", () => {
    expect(toTaggedFeedPost(row()).author.username).toBe("kev");
  });

  it("treats a zero score as a score, not as absent", () => {
    const r = row({ tag: [{ tagged_user_id: "me", state: "tag", score: 0 }] });
    expect(toTaggedFeedPost(r).score).toBe(0);
  });
});
