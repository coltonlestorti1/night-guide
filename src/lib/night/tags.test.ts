import { describe, it, expect } from "vitest";
import { tagsByPost, withLine, type PostTag } from "./tags";

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
