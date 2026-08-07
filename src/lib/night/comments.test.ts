import { describe, it, expect } from "vitest";
import { reduceCommentPreviews, canCommentOn, type NightComment } from "./comments";

const profile = (id: string) => ({
  id,
  username: `u_${id}`,
  display_name: null,
  avatar_url: null,
});

const c = (id: string, postId: string, createdAt: string): NightComment => ({
  id,
  postId,
  body: `body ${id}`,
  createdAt,
  author: profile(`author_${id}`),
});

describe("reduceCommentPreviews", () => {
  it("counts per post and keeps the NEWEST comment as the preview", () => {
    const out = reduceCommentPreviews([
      c("a", "p1", "2026-08-01T00:00:00Z"),
      c("b", "p1", "2026-08-03T00:00:00Z"),
      c("c", "p1", "2026-08-02T00:00:00Z"),
    ]);
    expect(out.get("p1")!.count).toBe(3);
    expect(out.get("p1")!.latest.id).toBe("b");
  });

  it("keeps posts separate", () => {
    const out = reduceCommentPreviews([
      c("a", "p1", "2026-08-01T00:00:00Z"),
      c("b", "p2", "2026-08-02T00:00:00Z"),
    ]);
    expect(out.get("p1")!.count).toBe(1);
    expect(out.get("p2")!.latest.id).toBe("b");
    expect(out.size).toBe(2);
  });

  it("does not invent an entry for a post with no comments", () => {
    const out = reduceCommentPreviews([]);
    expect(out.get("p1")).toBeUndefined();
    expect(out.size).toBe(0);
  });

  it("is order-independent — the caller must not have to pre-sort", () => {
    const ascending = reduceCommentPreviews([
      c("a", "p1", "2026-08-01T00:00:00Z"),
      c("b", "p1", "2026-08-02T00:00:00Z"),
    ]);
    const descending = reduceCommentPreviews([
      c("b", "p1", "2026-08-02T00:00:00Z"),
      c("a", "p1", "2026-08-01T00:00:00Z"),
    ]);
    expect(ascending.get("p1")!.latest.id).toBe("b");
    expect(descending.get("p1")!.latest.id).toBe("b");
  });
});

describe("canCommentOn", () => {
  const friends = new Set(["f1", "f2"]);

  it("lets a friend of the author comment", () => {
    expect(canCommentOn("f1", "me", friends)).toBe(true);
  });

  it("lets the author comment on their own post", () => {
    expect(canCommentOn("me", "me", friends)).toBe(true);
  });

  it("refuses a non-friend, even though they can SEE the post", () => {
    // The whole point of decision 1: reading and writing are different gates.
    expect(canCommentOn("stranger", "me", friends)).toBe(false);
  });

  it("refuses a signed-out viewer", () => {
    expect(canCommentOn("f1", undefined, friends)).toBe(false);
  });
});
