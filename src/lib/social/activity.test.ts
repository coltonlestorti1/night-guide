import { describe, it, expect } from "vitest";
import { mergeActivity, isNew, type ActivityItem } from "./activity";

const item = (id: string, actorId: string, createdAt: string, kind: "like" | "comment" = "like"): ActivityItem => ({
  id, kind,
  actor: { id: actorId, username: `u_${actorId}`, display_name: null, avatar_url: null },
  postId: "p1", venueId: "v1", nightDate: "2026-08-08", createdAt,
});

describe("mergeActivity", () => {
  it("interleaves both sources newest first", () => {
    const out = mergeActivity(
      [item("c1", "a", "2026-08-08T10:00:00Z", "comment")],
      [item("l1", "b", "2026-08-08T12:00:00Z"), item("l2", "c", "2026-08-08T08:00:00Z")],
      "me",
    );
    expect(out.map((i) => i.id)).toEqual(["l1", "c1", "l2"]);
  });

  it("drops your own reactions to your own post", () => {
    const out = mergeActivity(
      [item("c1", "me", "2026-08-08T10:00:00Z", "comment")],
      [item("l1", "me", "2026-08-08T12:00:00Z")],
      "me",
    );
    expect(out).toEqual([]);
  });

  it("keeps other people's reactions when yours are present", () => {
    const out = mergeActivity(
      [item("c1", "me", "2026-08-08T10:00:00Z", "comment")],
      [item("l1", "b", "2026-08-08T09:00:00Z")],
      "me",
    );
    expect(out.map((i) => i.id)).toEqual(["l1"]);
  });
});

describe("isNew", () => {
  const it0 = item("l1", "b", "2026-08-08T12:00:00Z");
  it("is new when it landed after the watermark", () => {
    expect(isNew(it0, "2026-08-08T11:00:00Z")).toBe(true);
  });
  it("is not new when it predates the watermark", () => {
    expect(isNew(it0, "2026-08-08T13:00:00Z")).toBe(false);
  });
  it("is never new with no watermark — a first-time user is not owed 40 dots", () => {
    expect(isNew(it0, null)).toBe(false);
  });
});
