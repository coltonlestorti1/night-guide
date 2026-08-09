import { describe, it, expect } from "vitest";
import { badgeCount, badgeLabel } from "./unread";

describe("badgeCount", () => {
  it("adds the three sources", () => {
    expect(badgeCount({ newPosts: 2, friendRequests: 1, planAlerts: 3 })).toBe(6);
  });

  it("is zero when nothing is waiting", () => {
    expect(badgeCount({ newPosts: 0, friendRequests: 0, planAlerts: 0 })).toBe(0);
  });

  it("still counts requests and plans when there are no new posts", () => {
    // The tab must not go quiet just because nobody posted — a friend request
    // is the more urgent of the two.
    expect(badgeCount({ newPosts: 0, friendRequests: 1, planAlerts: 0 })).toBe(1);
  });
});

describe("badgeLabel", () => {
  it("shows the number up to 9", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(9)).toBe("9");
  });

  it("caps at 9+ so the pill cannot grow the tab", () => {
    expect(badgeLabel(10)).toBe("9+");
    expect(badgeLabel(148)).toBe("9+");
  });
});
