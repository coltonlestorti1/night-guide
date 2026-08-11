import { describe, it, expect } from "vitest";
import { embeddedSelects, plainColumns } from "./lib/select-parse.mjs";

// The real select that exposed the gap: night_post_tags.score did not exist,
// PostgREST rejected the query with 42703, and the guard printed `ok`.
const TAGGED = `id, venue_id, night_date, note, visibility, score, created_at,
   author:profiles!night_posts_user_id_fkey(id, username, display_name, avatar_url),
   tag:night_post_tags!inner(tagged_user_id, state, score)`;

describe("plainColumns", () => {
  it("keeps this relation's own columns", () => {
    expect(plainColumns("id, venue_id, night_date")).toEqual(["id", "venue_id", "night_date"]);
  });

  it("unwraps an alias to the underlying column", () => {
    expect(plainColumns("venue:venue_id")).toEqual(["venue_id"]);
  });

  it("excludes embeds — they are not columns of this relation", () => {
    expect(plainColumns(TAGGED)).toEqual([
      "id", "venue_id", "night_date", "note", "visibility", "score", "created_at",
    ]);
  });

  it("drops a bare star", () => {
    expect(plainColumns("*")).toEqual([]);
  });
});

describe("embeddedSelects", () => {
  it("finds every embed and resolves the real relation", () => {
    expect(embeddedSelects(TAGGED)).toEqual([
      {
        relation: "profiles",
        select: "id, username, display_name, avatar_url",
      },
      {
        relation: "night_post_tags",
        select: "tagged_user_id, state, score",
      },
    ]);
  });

  it("strips the alias, which names the result and not the schema", () => {
    expect(embeddedSelects("author:profiles!some_fkey(id)")[0].relation).toBe("profiles");
  });

  it("strips a join modifier as readily as a FK name", () => {
    expect(embeddedSelects("tag:night_post_tags!inner(state)")[0].relation).toBe("night_post_tags");
    expect(embeddedSelects("profiles!inner(id)")[0].relation).toBe("profiles");
    expect(embeddedSelects("plans(id)")[0].relation).toBe("plans");
  });

  it("recurses — an embed inside an embed is still checkable", () => {
    // This shape is live: night_post_tags embeds night_posts, which embeds profiles.
    const nested = `post_id, post:night_posts!inner(venue_id, author:profiles!fk(username))`;
    expect(embeddedSelects(nested)).toEqual([
      { relation: "night_posts", select: "venue_id, author:profiles!fk(username)" },
      { relation: "profiles", select: "username" },
    ]);
  });

  it("does not confuse a later embed's paren for this one's", () => {
    const two = `a:one(x), b:two(y)`;
    expect(embeddedSelects(two).map((e) => e.relation)).toEqual(["one", "two"]);
    expect(embeddedSelects(two).map((e) => e.select)).toEqual(["x", "y"]);
  });

  it("returns nothing when there are no embeds", () => {
    expect(embeddedSelects("id, venue_id")).toEqual([]);
  });

  it("ignores an unbalanced paren rather than reporting it as drift", () => {
    // A truncated or templated select must never manufacture a failure.
    expect(embeddedSelects("author:profiles!fk(id")).toEqual([]);
  });
});
