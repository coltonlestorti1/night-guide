import { describe, it, expect } from "vitest";
import { summarizeLikes, type LikeRow } from "./likes";

const r = (postId: string, userId: string): LikeRow => ({ postId, userId });

describe("summarizeLikes", () => {
  it("counts per post", () => {
    const out = summarizeLikes([r("p1", "a"), r("p1", "b"), r("p2", "a")], "me");
    expect(out.get("p1")!.count).toBe(2);
    expect(out.get("p2")!.count).toBe(1);
  });

  it("flags the caller's own like", () => {
    const out = summarizeLikes([r("p1", "me"), r("p1", "b")], "me");
    expect(out.get("p1")!.likedByMe).toBe(true);
    expect(out.get("p1")!.count).toBe(2);
  });

  it("does not flag likedByMe for someone else's like", () => {
    const out = summarizeLikes([r("p1", "b")], "me");
    expect(out.get("p1")!.likedByMe).toBe(false);
  });

  it("never claims likedByMe when signed out", () => {
    // undefined must not accidentally match an undefined user_id.
    const out = summarizeLikes([r("p1", "b")], undefined);
    expect(out.get("p1")!.likedByMe).toBe(false);
  });

  it("returns no entry for a post with no likes", () => {
    expect(summarizeLikes([], "me").get("p1")).toBeUndefined();
  });
});
