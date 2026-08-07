import { describe, it, expect } from "vitest";
import { computeCanComment } from "./useComments";
import type { FriendshipRow } from "@/lib/friends";

const profile = (id: string) => ({
  id,
  username: `u_${id}`,
  display_name: null,
  avatar_url: null,
});

const acceptedRow = (myId: string, otherId: string): FriendshipRow => ({
  id: `row_${myId}_${otherId}`,
  user_id: myId,
  friend_id: otherId,
  status: "accepted",
  created_at: "2026-08-01T00:00:00Z",
  requester: profile(myId),
  recipient: profile(otherId),
});

// computeCanComment is the pure core of useCanCommentOn(authorId), split out
// so the loading/yes/no distinction is testable without mounting
// react-query. The bug it fixes: PostCard and CommentSheet used to each do
// `friendships && myId ? ... : []` inline, which reads a still-loading
// friendships query the same as "confirmed not a friend" — a friend opening
// the sheet while it's in flight briefly saw the refusal copy, which is
// simply false, not a neutral placeholder.
describe("computeCanComment", () => {
  it("is 'loading' while friendships is undefined, for a signed-in user", () => {
    expect(computeCanComment("author", "me", undefined)).toBe("loading");
  });

  it("is 'yes' once friendships has loaded and the viewer is an accepted friend", () => {
    const friendships = [acceptedRow("me", "author")];
    expect(computeCanComment("author", "me", friendships)).toBe("yes");
  });

  it("is 'yes' for the post's own author, even with an empty friendships list", () => {
    expect(computeCanComment("me", "me", [])).toBe("yes");
  });

  it("is 'no' once friendships has loaded and the viewer is not a friend", () => {
    expect(computeCanComment("author", "me", [])).toBe("no");
  });

  it("is 'no' for a signed-out viewer regardless of friendships' load state", () => {
    expect(computeCanComment("author", undefined, undefined)).toBe("no");
    expect(computeCanComment("author", undefined, [])).toBe("no");
  });
});
