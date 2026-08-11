import { describe, it, expect } from "vitest";
import { myTagOn, tagsByPost, withLine, type PostTag } from "./tags";

const t = (postId: string, name: string, state: PostTag["state"] = "tag"): PostTag => ({
  postId, state,
  person: { id: name, username: name, display_name: null, avatar_url: null },
});

describe("tagsByPost", () => {
  it("groups by post", () => {
    const out = tagsByPost([t("p1", "a"), t("p1", "b"), t("p2", "c")]);
    expect(out.get("p1")!.length).toBe(2);
    expect(out.get("p2")!.length).toBe(1);
  });
  it("has no entry for an untagged post", () => {
    expect(tagsByPost([]).get("p1")).toBeUndefined();
  });
});

describe("withLine", () => {
  it("names one person", () => expect(withLine([t("p", "sam")])).toBe("with sam"));
  it("names two", () => expect(withLine([t("p","sam"), t("p","alex")])).toBe("with sam and alex"));
  it("counts the rest beyond two", () => {
    expect(withLine([t("p","sam"), t("p","alex"), t("p","jo")])).toBe("with sam and 2 others");
  });
  it("renders nothing when there are no tags", () => {
    expect(withLine([])).toBeNull();
    expect(withLine(undefined)).toBeNull();
  });
});

describe("pending tags render like any other (2026-08-11)", () => {
  // Being NAMED on a post rides the post's audience; ACCEPTING is what makes it
  // a mutual post on the tagged person's profile. These two assert the first
  // half — the half that used to be invisible to everyone, including the person
  // who created the tag.
  it("names a pending person on the with-line", () => {
    expect(withLine([t("p", "will", "pending")])).toBe("with will");
  });

  it("does not distinguish pending from accepted in the line", () => {
    const mixed = [t("p", "will", "pending"), t("p", "sam", "collab")];
    expect(withLine(mixed)).toBe("with will and sam");
  });

  it("groups pending tags onto their post", () => {
    const out = tagsByPost([t("p1", "will", "pending")]);
    expect(out.get("p1")).toHaveLength(1);
  });
});

describe("myTagOn — who gets tag controls", () => {
  const sam = t("p1", "sam");
  const me = t("p1", "me", "pending");

  it("finds my own tag among several", () => {
    expect(myTagOn([sam, me], "me")?.person.id).toBe("me");
  });

  it("finds it whatever state it is in", () => {
    // Pending especially: an unanswered tag is the case where you most want
    // to be able to remove yourself.
    for (const st of ["pending", "tag", "collab"] as const) {
      expect(myTagOn([t("p1", "me", st)], "me")?.state).toBe(st);
    }
  });

  it("is undefined when I am not tagged", () => {
    expect(myTagOn([sam], "me")).toBeUndefined();
  });

  it("is undefined when signed out, rather than matching anyone", () => {
    expect(myTagOn([sam, me], undefined)).toBeUndefined();
  });

  it("is undefined when the post has no tags", () => {
    expect(myTagOn(undefined, "me")).toBeUndefined();
    expect(myTagOn([], "me")).toBeUndefined();
  });
});
